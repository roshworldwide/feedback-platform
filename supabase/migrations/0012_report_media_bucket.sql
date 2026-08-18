-- ============================================================================
-- The `report-media` bucket `uploadMediaAction` (src/app/(app)/compose/
-- actions.ts) has always uploaded to — every table and view this app needs
-- got a migration; storage didn't, because a bucket isn't a table, it's a
-- row in `storage.buckets` plus RLS on `storage.objects`, both of which are
-- plain Postgres and belong here the same as anything else.
--
-- Public, because an inbox fetches an image or an attachment from a public
-- URL with no session to present — the same reasoning `getPublicUrl()` in
-- the action already assumes. Anyone signed in may upload; nothing in the
-- product restricts who can attach a file to a report, so the RLS policy
-- doesn't invent a restriction the app doesn't have.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('report-media', 'report-media', true)
on conflict (id) do nothing;

create policy "report-media public read" on storage.objects
  for select to public
  using (bucket_id = 'report-media');

create policy "report-media authenticated upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'report-media');
