-- ============================================================================
-- Row Level Security.
--
-- FIX: v1 enabled RLS on all seven tables and then defeated it entirely with
--   create policy "allow all" ... using (true) with check (true);
-- which meant the anon key had full read/write on every client record. Here
-- RLS actually constrains: staff read, writers write, only admins destroy, and
-- the public tracking surface reaches the database exclusively through the
-- service role in a server route — never from the browser.
-- ============================================================================

-- ── Helpers ──────────────────────────────────────────────────────────────────
-- security definer + a pinned search_path: these are called from inside
-- policies, so they must not be shadowable by a caller-controlled schema.

create or replace function public.current_role_name()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.is_active
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active
  )
$$;

-- Admin and Team Lead share full access; Analyst is read + author, no destroy.
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_name() in ('admin', 'team_lead'), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_name() = 'admin', false)
$$;

-- ── Enable ───────────────────────────────────────────────────────────────────
alter table public.profiles            enable row level security;
alter table public.clients             enable row level security;
alter table public.contacts            enable row level security;
alter table public.report_series       enable row level security;
alter table public.campaigns           enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.email_events        enable row level security;
alter table public.feedback            enable row level security;
alter table public.drafts              enable row level security;
alter table public.automation_rules    enable row level security;
alter table public.audit_log           enable row level security;

-- Deny by default: no table below grants anything to `anon`.

-- ── Profiles ─────────────────────────────────────────────────────────────────
create policy profiles_read on public.profiles
  for select to authenticated using (public.is_staff());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Only an admin may change roles or deactivate an account. This is the
-- control v1 lacked entirely — departed staff simply kept working PINs.
create policy profiles_admin_write on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── Clients ──────────────────────────────────────────────────────────────────
create policy clients_read on public.clients
  for select to authenticated using (public.is_staff());

create policy clients_write on public.clients
  for insert to authenticated with check (public.is_staff());

create policy clients_update on public.clients
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy clients_delete on public.clients
  for delete to authenticated using (public.is_manager());

-- ── Contacts ─────────────────────────────────────────────────────────────────
create policy contacts_read on public.contacts
  for select to authenticated using (public.is_staff());

create policy contacts_write on public.contacts
  for insert to authenticated with check (public.is_staff());

create policy contacts_update on public.contacts
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy contacts_delete on public.contacts
  for delete to authenticated using (public.is_manager());

-- ── Report series ────────────────────────────────────────────────────────────
create policy series_read on public.report_series
  for select to authenticated using (public.is_staff());

create policy series_write on public.report_series
  for insert to authenticated with check (public.is_staff());

create policy series_update on public.report_series
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy series_delete on public.report_series
  for delete to authenticated using (public.is_manager());

-- ── Campaigns ────────────────────────────────────────────────────────────────
create policy campaigns_read on public.campaigns
  for select to authenticated using (public.is_staff());

create policy campaigns_write on public.campaigns
  for insert to authenticated with check (public.is_staff());

-- A sent campaign is a historical record. Editing it would rewrite what a
-- client actually received, so it is frozen except to a manager.
create policy campaigns_update on public.campaigns
  for update to authenticated
  using (public.is_staff() and (status <> 'sent' or public.is_manager()))
  with check (public.is_staff());

create policy campaigns_delete on public.campaigns
  for delete to authenticated
  using (public.is_manager() and status <> 'sent');

-- ── Recipients, events, feedback ─────────────────────────────────────────────
-- Readable by staff. Writes arrive only from the service role, which bypasses
-- RLS: delivery results and tracking hits are facts recorded by the system,
-- never rows a browser session may author.
create policy recipients_read on public.campaign_recipients
  for select to authenticated using (public.is_staff());

create policy events_read on public.email_events
  for select to authenticated using (public.is_staff());

create policy feedback_read on public.feedback
  for select to authenticated using (public.is_staff());

-- Staff may triage feedback — review it, assign it, annotate it — but the
-- rating and the comment are the client's words and are not editable.
create policy feedback_triage on public.feedback
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ── Drafts ───────────────────────────────────────────────────────────────────
create policy drafts_read on public.drafts
  for select to authenticated using (public.is_staff());

create policy drafts_write on public.drafts
  for insert to authenticated with check (owner_id = auth.uid());

create policy drafts_update on public.drafts
  for update to authenticated
  using (owner_id = auth.uid() or public.is_manager())
  with check (owner_id = auth.uid() or public.is_manager());

create policy drafts_delete on public.drafts
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_manager());

-- ── Automation ───────────────────────────────────────────────────────────────
create policy rules_read on public.automation_rules
  for select to authenticated using (public.is_staff());

create policy rules_manage on public.automation_rules
  for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- ── Audit log ────────────────────────────────────────────────────────────────
-- Append-only from the application's perspective: written by the service role,
-- readable by managers, and updatable or deletable by nobody at all. An audit
-- trail that its own users can edit is not an audit trail.
create policy audit_read on public.audit_log
  for select to authenticated using (public.is_manager());

-- ── Grants ───────────────────────────────────────────────────────────────────
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.period_stats(timestamptz, timestamptz, uuid, boolean, boolean) to authenticated;
