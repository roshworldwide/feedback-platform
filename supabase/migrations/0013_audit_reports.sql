-- ============================================================================
-- Call Audit Reports.
--
-- Replaces a manual loop the team ran entirely outside the platform: audit a
-- call in a spreadsheet, export a CSV, paste it into Claude by hand, ask for a
-- report, email the result. An audit run is now a first-class record here,
-- and sending one creates a real campaigns row — so an audit report gets the
-- same open/click tracking, star rating and feedback loop as every other
-- report the platform sends, instead of being a one-off email nobody can
-- trace afterward.
--
-- audit_rows.raw is the verbatim uploaded row, keyed by the original CSV
-- header, kept so every figure in the report can be traced back to the row
-- that produced it — the same reasoning campaign_recipients keeps a token
-- per row rather than trusting an aggregate.
-- ============================================================================

create type audit_run_status as enum ('uploaded', 'mapped', 'computed', 'sent', 'failed');

-- ── Audit runs ───────────────────────────────────────────────────────────────
create table public.audit_runs (
  id               uuid              primary key default gen_random_uuid(),
  client_id        uuid              not null references public.clients (id) on delete restrict,
  name             text              not null default 'Untitled audit',
  source_filename  text              not null default '',
  -- Object key in the private audit-uploads bucket, so a signed URL can be
  -- re-derived on demand and a malformed file re-parsed without a re-upload.
  source_path      text,
  -- Provenance only, when the CSV came from a pasted Google Sheets URL rather
  -- than a direct upload.
  sheets_url       text,
  period_label     text              not null default '',
  row_count        integer           not null default 0,
  status           audit_run_status  not null default 'uploaded',
  -- { role: sourceHeader } for the 8 required roles. Reused as the next
  -- upload's default for the same client, so a second upload from the same
  -- source needs no remapping.
  column_map       jsonb             not null default '{}'::jsonb,
  -- Sections 1-5, the arithmetic and taxonomy tiers. Recomputed whenever a
  -- row's fatal flag or issue tags are edited; never hand-edited directly.
  metrics          jsonb             not null default '{}'::jsonb,
  -- Sections 6-7, the AI/judgement tier, plus the human edits made to it on
  -- the Review step. { fatalErrors, observations, available: boolean }.
  narrative        jsonb             not null default '{}'::jsonb,
  campaign_id      uuid              references public.campaigns (id) on delete set null,
  created_by       uuid              references public.profiles (id) on delete set null,
  created_at       timestamptz       not null default now(),
  updated_at       timestamptz       not null default now()
);

-- Backs both the list page's "most recent per client" sort and the Map
-- step's "reuse this client's last mapping" lookup.
create index audit_runs_client_idx on public.audit_runs (client_id, created_at desc);
create index audit_runs_status_idx on public.audit_runs (status);

-- ── Audit rows ───────────────────────────────────────────────────────────────
create table public.audit_rows (
  id                     uuid        primary key default gen_random_uuid(),
  run_id                 uuid        not null references public.audit_runs (id) on delete cascade,
  row_index              integer     not null,
  -- The uploaded row exactly as parsed, keyed by original CSV header. Never
  -- logged, never transformed — the traceability anchor for every figure.
  raw                    jsonb       not null,
  disposition            text        not null default '',
  qa_name                text        not null default '',
  accurate               boolean,
  corrected_disposition  text        not null default '',
  issue_tags             text[]      not null default '{}',
  is_fatal               boolean     not null default false,
  fatal_reason           text        not null default '',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint audit_rows_unique_index unique (run_id, row_index)
);

create index audit_rows_run_idx on public.audit_rows (run_id, row_index);

-- ── Taxonomy ─────────────────────────────────────────────────────────────────
-- Global, not per-client — the same ten call-quality parameters apply across
-- every campaign audited. Editable from the app so a new parameter never
-- waits on a developer.
create table public.audit_taxonomy (
  id         uuid        primary key default gen_random_uuid(),
  label      text        not null,
  patterns   text[]      not null default '{}',
  sort_order integer     not null default 0,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index audit_taxonomy_label_key on public.audit_taxonomy (lower(btrim(label)));

-- ── updated_at maintenance ───────────────────────────────────────────────────
-- Reuses the touch_updated_at() function 0001_schema.sql already defined.
do $$
declare t text;
begin
  foreach t in array array['audit_runs', 'audit_rows', 'audit_taxonomy']
  loop
    execute format(
      'create trigger %I_touch before update on public.%I
       for each row execute function public.touch_updated_at()', t, t);
  end loop;
end;
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- The exact staff-read / staff-write / staff-update / manager-delete shape
-- 0003_rls.sql uses for clients/contacts/report_series, reusing its
-- is_staff()/is_manager() helpers rather than redefining them.
alter table public.audit_runs     enable row level security;
alter table public.audit_rows     enable row level security;
alter table public.audit_taxonomy enable row level security;

create policy audit_runs_read on public.audit_runs
  for select to authenticated using (public.is_staff());
create policy audit_runs_write on public.audit_runs
  for insert to authenticated with check (public.is_staff());
create policy audit_runs_update on public.audit_runs
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy audit_runs_delete on public.audit_runs
  for delete to authenticated using (public.is_manager());

create policy audit_rows_read on public.audit_rows
  for select to authenticated using (public.is_staff());
create policy audit_rows_write on public.audit_rows
  for insert to authenticated with check (public.is_staff());
create policy audit_rows_update on public.audit_rows
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy audit_rows_delete on public.audit_rows
  for delete to authenticated using (public.is_manager());

-- Deactivation (is_active = false) is an update, so staff can retire a
-- parameter themselves; only a hard row delete needs a manager.
create policy audit_taxonomy_read on public.audit_taxonomy
  for select to authenticated using (public.is_staff());
create policy audit_taxonomy_write on public.audit_taxonomy
  for insert to authenticated with check (public.is_staff());
create policy audit_taxonomy_update on public.audit_taxonomy
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy audit_taxonomy_delete on public.audit_taxonomy
  for delete to authenticated using (public.is_manager());

-- 0003_rls.sql's blanket grant only covers tables that existed when it ran;
-- these three need the same table-level grant explicitly.
grant select, insert, update, delete on public.audit_runs, public.audit_rows, public.audit_taxonomy
  to authenticated;

-- ── Taxonomy seed ────────────────────────────────────────────────────────────
-- The ten parameters from the reference report. Patterns are a reasonable
-- starting keyword set, not a finished taxonomy — staff refine them from the
-- app as real observation text reveals gaps.
insert into public.audit_taxonomy (label, patterns, sort_order) values
  ('STT / Transcript issue',        array['stt', 'transcript', 'transcription', 'mishear', 'misheard'], 1),
  ('Latency',                       array['latency', 'slow', 'delay', 'lag'], 2),
  ('Flow issue',                    array['flow', 'script', 'derail'], 3),
  ('Interruption handling',        array['interrupt', 'cut off', 'talk over', 'overlap'], 4),
  ('Pronunciation issue',          array['pronoun', 'pronunciation', 'accent'], 5),
  ('Bot repeated responses',       array['repeat', 'repeated', 're-ask', 'reask'], 6),
  ('Context passed incorrectly',   array['context', 'wrong context', 'incorrect context'], 7),
  ('Repeated calls to customer',   array['repeated call', 'multiple call', 'called again', 'back to back call'], 8),
  ('Language switch issue',        array['language', 'hindi', 'switch language'], 9),
  ('NBA / Follow-up failure',      array['follow-up', 'followup', 'nba', 'next best action'], 10);

-- ── Storage ──────────────────────────────────────────────────────────────────
-- Private, unlike report-media: a raw upload is client call-audit data
-- (phone numbers, lead links), so it is never public-read. Access is only
-- ever through a short-lived signed URL generated server-side on demand.
-- Generated PDFs are uploaded to the existing report-media bucket instead —
-- a recipient must be able to open one from an email with no login, which
-- report-media already solves for every other campaign attachment; a second
-- bucket here would just reinvent that with an expiry-management problem the
-- rest of the product doesn't have.
insert into storage.buckets (id, name, public)
values ('audit-uploads', 'audit-uploads', false)
on conflict (id) do nothing;

create policy "audit-uploads staff read" on storage.objects
  for select to authenticated using (bucket_id = 'audit-uploads' and public.is_staff());

create policy "audit-uploads staff upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'audit-uploads' and public.is_staff());

create policy "audit-uploads manager delete" on storage.objects
  for delete to authenticated using (bucket_id = 'audit-uploads' and public.is_manager());
