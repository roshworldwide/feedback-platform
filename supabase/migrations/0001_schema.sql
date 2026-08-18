-- ============================================================================
-- Convin Data Labs v2 — core schema
--
-- Every constraint in this file exists because v1 got the same thing wrong by
-- convention rather than by structure. Where a comment says FIX, it names the
-- defect it makes impossible.
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ── Enums ────────────────────────────────────────────────────────────────────
create type user_role        as enum ('admin', 'team_lead', 'analyst');
create type client_status    as enum ('active', 'paused', 'churned');
create type campaign_status  as enum ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled');
create type event_type       as enum ('delivered', 'bounced', 'open', 'click', 'unsubscribe');
create type series_frequency as enum ('weekly', 'fortnightly', 'monthly', 'quarterly', 'adhoc');

-- ── Profiles ─────────────────────────────────────────────────────────────────
-- FIX: v1 hard-coded 17 four-digit PINs in a public repo, seven of them
-- belonging to departed staff who could still sign in. Identity now lives in
-- auth.users; deactivation is a real, auditable state.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       citext      not null unique,
  full_name   text        not null default '',
  role        user_role   not null default 'analyst',
  is_active   boolean     not null default true,
  last_seen_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Clients ──────────────────────────────────────────────────────────────────
create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  name       text          not null,
  slug       citext        not null unique,
  owner_id   uuid          references public.profiles (id) on delete set null,
  status     client_status not null default 'active',
  tags       text[]        not null default '{}',
  notes      text          not null default '',
  timezone   text          not null default 'Asia/Kolkata',
  created_at timestamptz   not null default now(),
  updated_at timestamptz   not null default now(),
  constraint clients_name_not_blank check (length(btrim(name)) > 0)
);

-- FIX: "cleartrip" and "Cleartrip" were two different clients in v1, which is
-- why send history silently reported zero. One name, case-insensitively.
create unique index clients_name_lower_key on public.clients (lower(btrim(name)));

-- ── Contacts ─────────────────────────────────────────────────────────────────
-- FIX: v1 stored recipients as a pipe-separated text blob, so nothing could be
-- deduplicated, attributed or marked internal. People are rows now.
create table public.contacts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid    not null references public.clients (id) on delete cascade,
  email       citext  not null,
  full_name   text    not null default '',
  title       text    not null default '',
  -- FIX: internal @convin.ai CCs were counted as client engagement in v1.
  is_internal boolean not null default false,
  is_active   boolean not null default true,
  bounced_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint contacts_email_shape check (position('@' in email) > 1),
  -- FIX: Thyrocare carried rohit.kumarsingh@thyrocare.com twice.
  constraint contacts_unique_per_client unique (client_id, email)
);

create index contacts_client_idx on public.contacts (client_id) where is_active;

-- ── Report series ────────────────────────────────────────────────────────────
-- The DL-nnn numbering was always a cadence; v2 makes it explicit.
create table public.report_series (
  id           uuid             primary key default gen_random_uuid(),
  client_id    uuid             not null references public.clients (id) on delete cascade,
  name         text             not null,
  frequency    series_frequency not null default 'monthly',
  template_key text             not null default 'convin-premium',
  owner_id     uuid             references public.profiles (id) on delete set null,
  is_active    boolean          not null default true,
  next_run_at  timestamptz,
  created_at   timestamptz      not null default now(),
  updated_at   timestamptz      not null default now()
);

create unique index report_series_name_key
  on public.report_series (client_id, lower(btrim(name)));

-- ── Campaigns ────────────────────────────────────────────────────────────────
-- FIX (the big one): in v1 a campaign was a free-text subject line, and the
-- link to a client was written only when someone remembered to type the client
-- name. client_id is NOT NULL and a real foreign key, so an unattributed
-- campaign cannot be persisted at all.
create table public.campaigns (
  id              uuid            primary key default gen_random_uuid(),
  client_id       uuid            not null references public.clients (id) on delete restrict,
  series_id       uuid            references public.report_series (id) on delete set null,
  report_number   text,
  title           text            not null,
  period_label    text            not null default '',
  subject         text            not null,
  body_md         text            not null default '',
  template_key    text            not null default 'convin-premium',
  report_url      text,
  attachment_name text,
  attachment_url  text,
  feedback_enabled boolean        not null default true,
  feedback_question text          not null default 'Was this report helpful?',
  feedback_ask_comment boolean    not null default true,
  status          campaign_status not null default 'draft',
  -- FIX: v1 recorded is_test correctly and then never filtered on it, so a
  -- one-recipient test defined the whole Daily dashboard.
  is_test         boolean         not null default false,
  scheduled_for   timestamptz,
  sent_at         timestamptz,
  created_by      uuid            references public.profiles (id) on delete set null,
  created_at      timestamptz     not null default now(),
  updated_at      timestamptz     not null default now(),
  constraint campaigns_title_not_blank check (length(btrim(title)) > 0),
  constraint campaigns_sent_has_timestamp
    check (status <> 'sent' or sent_at is not null),
  constraint campaigns_scheduled_has_time
    check (status <> 'scheduled' or scheduled_for is not null)
);

-- FIX: DL-034 existed simultaneously for Housing, Fyers and Metropolis, and
-- twice within Metropolis. Unique per client.
create unique index campaigns_report_number_key
  on public.campaigns (client_id, upper(btrim(report_number)))
  where report_number is not null and btrim(report_number) <> '';

create index campaigns_client_sent_idx on public.campaigns (client_id, sent_at desc);
create index campaigns_status_idx      on public.campaigns (status, scheduled_for);

-- ── Recipients ───────────────────────────────────────────────────────────────
create table public.campaign_recipients (
  id            uuid    primary key default gen_random_uuid(),
  campaign_id   uuid    not null references public.campaigns (id) on delete cascade,
  contact_id    uuid    references public.contacts (id) on delete set null,
  email         citext  not null,
  full_name     text    not null default '',
  -- Snapshotted at send time: a contact reclassified later must not silently
  -- rewrite the history of a campaign that already went out.
  is_internal   boolean not null default false,
  delivered_at  timestamptz,
  bounced_at    timestamptz,
  bounce_reason text,
  -- Opaque, unguessable, per-recipient. Every tracking URL keys off this.
  token         text    not null default encode(gen_random_bytes(24), 'hex'),
  created_at    timestamptz not null default now(),
  constraint recipients_unique_per_campaign unique (campaign_id, email),
  constraint recipients_not_both_states
    check (delivered_at is null or bounced_at is null)
);

create unique index campaign_recipients_token_key on public.campaign_recipients (token);
create index campaign_recipients_campaign_idx on public.campaign_recipients (campaign_id);

-- ── Email events ─────────────────────────────────────────────────────────────
-- FIX (C2): v1 wrote a synthetic 'open' row on every click AND then computed
-- opens as len(opens) + len(clicks), counting each click twice. Here a click is
-- never written as an open; "opened" is derived in the view as (open OR click),
-- deduplicated per recipient. The partial unique index makes a second open row
-- for the same recipient physically impossible.
create table public.email_events (
  id           bigint generated always as identity primary key,
  recipient_id uuid       not null references public.campaign_recipients (id) on delete cascade,
  campaign_id  uuid       not null references public.campaigns (id) on delete cascade,
  type         event_type not null,
  occurred_at  timestamptz not null default now(),
  user_agent   text,
  ip_hash      text
);

create unique index email_events_one_open_per_recipient
  on public.email_events (recipient_id) where type = 'open';

create unique index email_events_one_delivered_per_recipient
  on public.email_events (recipient_id) where type = 'delivered';

create index email_events_campaign_type_idx on public.email_events (campaign_id, type);
create index email_events_occurred_idx      on public.email_events (occurred_at desc);

-- ── Feedback ─────────────────────────────────────────────────────────────────
-- FIX: ratings are one row per recipient per campaign and are upserted, so a
-- second star click corrects rather than duplicates. The campaign is part of
-- the record, so the UI can always state which report was rated — the thing
-- that made v1's honest data look corrupt.
create table public.feedback (
  id           uuid       primary key default gen_random_uuid(),
  recipient_id uuid       not null unique references public.campaign_recipients (id) on delete cascade,
  campaign_id  uuid       not null references public.campaigns (id) on delete cascade,
  rating       smallint   not null check (rating between 1 and 5),
  comment      text,
  sentiment    text check (sentiment in ('positive', 'neutral', 'critical')),
  reviewed_at  timestamptz,
  reviewed_by  uuid       references public.profiles (id) on delete set null,
  assigned_to  uuid       references public.profiles (id) on delete set null,
  internal_note text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index feedback_campaign_idx on public.feedback (campaign_id);
create index feedback_rating_idx   on public.feedback (rating, created_at desc);
create index feedback_unreviewed_idx on public.feedback (created_at desc) where reviewed_at is null;

-- ── Drafts ───────────────────────────────────────────────────────────────────
-- FIX: v1 had exactly three global draft slots, unnamed and unowned, and the
-- gallery could only load into two of them.
create table public.drafts (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null default 'Untitled draft',
  client_id    uuid        references public.clients (id) on delete set null,
  series_id    uuid        references public.report_series (id) on delete set null,
  payload      jsonb       not null default '{}'::jsonb,
  owner_id     uuid        references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index drafts_owner_idx on public.drafts (owner_id, updated_at desc);

-- ── Automation rules ─────────────────────────────────────────────────────────
create table public.automation_rules (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  trigger     text        not null,     -- 'no_open_after_days' | 'low_rating' | 'client_idle'
  threshold   integer     not null default 3,
  action      text        not null,     -- 'notify_owner' | 'create_task' | 'flag_at_risk'
  is_active   boolean     not null default true,
  created_by  uuid        references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Audit log ────────────────────────────────────────────────────────────────
-- FIX: v1 had one shared "Admin" identity and no record of who did anything.
create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid        references public.profiles (id) on delete set null,
  actor_email citext,
  action      text        not null,
  entity_type text        not null,
  entity_id   text,
  summary     text        not null default '',
  diff        jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_entity_idx  on public.audit_log (entity_type, entity_id);

-- ── updated_at maintenance ───────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'clients', 'contacts', 'report_series',
    'campaigns', 'feedback', 'drafts', 'automation_rules'
  ]
  loop
    execute format(
      'create trigger %I_touch before update on public.%I
       for each row execute function public.touch_updated_at()', t, t);
  end loop;
end;
$$;

-- ── New auth users get a profile ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
