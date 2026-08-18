-- ============================================================================
-- "New client" moves from a fixed Primary/Email 2/Email 3 to an open-ended
-- list, and `is_internal` per address is decided where the Contacts feature
-- already decides it — client-side, pre-filled from the domain via
-- `isInternalEmail()` and always overridable — rather than re-derived here
-- from a domain list. `p_internal_domains` is dropped; `p_is_internal`
-- arrives instead, one flag per email, same order.
--
-- CREATE OR REPLACE FUNCTION cannot change a parameter list, so this is a
-- drop-and-recreate, same as 0005 and 0009.
-- ============================================================================

drop function if exists public.create_client_with_contacts(text, text, text[], text[], text[], text);

create function public.create_client_with_contacts(
  p_name         text,
  p_contact_name text,
  p_emails       text[],
  p_is_internal  boolean[],
  p_tags         text[] default '{}',
  p_notes        text default ''
)
returns table (
  out_id                 uuid,
  out_slug               text,
  out_name               text,
  out_primary_contact_id uuid
)
language plpgsql
as $$
declare
  v_slug               text;
  v_base_slug          text;
  v_suffix             int := 1;
  v_client_id          uuid;
  v_email              text;
  v_contact_id         uuid;
  v_primary_contact_id uuid;
begin
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'A client needs a name.';
  end if;

  v_base_slug := trim(both '-' from lower(regexp_replace(btrim(p_name), '[^a-zA-Z0-9]+', '-', 'g')));
  if v_base_slug = '' then v_base_slug := 'client'; end if;

  v_slug := v_base_slug;
  while exists (select 1 from public.clients c where c.slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  end loop;

  insert into public.clients (name, slug, tags, notes)
  values (btrim(p_name), v_slug, coalesce(p_tags, '{}'), coalesce(p_notes, ''))
  returning clients.id into v_client_id;

  for i in 1 .. coalesce(array_length(p_emails, 1), 0) loop
    v_email := lower(btrim(p_emails[i]));
    continue when v_email = '';

    insert into public.contacts (client_id, email, full_name, is_internal)
    values (v_client_id, v_email, coalesce(btrim(p_contact_name), ''), coalesce(p_is_internal[i], false))
    on conflict (client_id, email) do nothing
    returning contacts.id into v_contact_id;

    if v_primary_contact_id is null and v_contact_id is not null then
      v_primary_contact_id := v_contact_id;
    end if;
  end loop;

  if v_primary_contact_id is not null then
    update public.clients set primary_contact_id = v_primary_contact_id where clients.id = v_client_id;
  end if;

  return query select v_client_id, v_slug, btrim(p_name), v_primary_contact_id;
end;
$$;

grant execute on function public.create_client_with_contacts(text, text, text[], boolean[], text[], text) to authenticated;
