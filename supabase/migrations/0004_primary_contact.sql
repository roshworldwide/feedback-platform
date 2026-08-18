-- ============================================================================
-- Primary contact on a client.
--
-- v1 showed "👤 Utsav Tiwari · 15 emails" under each client name — a nice-to-
-- have that v2 dropped structurally rather than by choice. This restores it as
-- a real FK, not a free-text guess: `primary_contact_id` must be a contact row
-- belonging to that same client, enforced below since a client's primary
-- contact working for a different client is not a state worth representing.
--
-- Named explicitly (`clients_primary_contact_fkey`) because `contacts` already
-- has one relationship to `clients` (`contacts.client_id`) — after this
-- migration it has two, and PostgREST needs the name to disambiguate an embed.
-- ============================================================================

alter table public.clients
  add column primary_contact_id uuid
    constraint clients_primary_contact_fkey
    references public.contacts (id) on delete set null;

-- A client's primary contact must be one of its own contacts. Enforced with a
-- trigger rather than a check constraint — a check constraint cannot see
-- another table's row, and this needs to.
create or replace function public.enforce_primary_contact_same_client()
returns trigger
language plpgsql
as $$
begin
  if new.primary_contact_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.contacts
    where id = new.primary_contact_id and client_id = new.id
  ) then
    raise exception 'primary_contact_id must reference a contact belonging to this client';
  end if;

  return new;
end;
$$;

create trigger clients_primary_contact_same_client
  before insert or update of primary_contact_id on public.clients
  for each row execute function public.enforce_primary_contact_same_client();
