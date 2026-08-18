-- ============================================================================
-- Starter drafts — the ten seeded gallery entries stop being owned by
-- whichever profile happened to sign up first.
--
-- A starter is visible to every staff member (already true — `drafts_read`
-- is `is_staff()`) and editable by no one: `drafts_update` / `drafts_delete`
-- are narrowed so a starter can never be changed or removed in place, no
-- matter who owns the row. Opening one in the app creates a personal copy
-- instead (see `openStarterAction`) — the RLS rule is the backstop that
-- guarantees a starter can't drift out from under the people using it as a
-- reference.
-- ============================================================================

alter table public.drafts
  add column is_starter boolean not null default false;

update public.drafts
set is_starter = true
where name in (
  'Executive report — Thyrocare farming teams',
  'Campaign deep dive — Housing agent training',
  'Weekly digest — Metropolis non-conversion',
  'Client success — Cleartrip repeat calls',
  'Performance alert — Fyers Prime plan CSAT',
  'QBR — Thyrocare Q3',
  'New series launch — Housing agent issues',
  'Insights roundup — Metropolis test bookings',
  'Onboarding — Cleartrip check-in denials',
  'Month-end wrap — Metropolis'
);

drop policy if exists drafts_update on public.drafts;
create policy drafts_update on public.drafts
  for update to authenticated
  using (not is_starter and (owner_id = auth.uid() or public.is_manager()))
  with check (not is_starter and (owner_id = auth.uid() or public.is_manager()));

drop policy if exists drafts_delete on public.drafts;
create policy drafts_delete on public.drafts
  for delete to authenticated
  using (not is_starter and (owner_id = auth.uid() or public.is_manager()));
