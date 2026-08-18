-- ============================================================================
-- Creating a client with no way to reach it was the thing the parity audit
-- flagged: a company gets added, and mailing it needs a second trip through a
-- Contacts UI. This function inserts the client and its starting contacts in
-- one statement, so the two either both happen or neither does — a plain
-- sequence of two round trips from the server action could leave a client
-- behind with no contact if the second insert failed.
--
-- `security invoker` (the default) means it runs as the calling role, so
-- `clients_write` / `contacts_write` RLS still gates it exactly as if the two
-- inserts had been issued directly — this adds atomicity, not privilege.
-- ============================================================================

create or replace function public.create_client_with_contacts(
  p_name              text,
  p_contact_name      text,
  p_emails            text[],
  p_tags              text[] default '{}',
  p_internal_domains  text[] default '{}'
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
  v_slug              text;
  v_base_slug         text;
  v_suffix            int := 1;
  v_client_id         uuid;
  v_email             text;
  v_domain            text;
  v_is_internal       boolean;
  v_contact_id        uuid;
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

  insert into public.clients (name, slug, tags)
  values (btrim(p_name), v_slug, coalesce(p_tags, '{}'))
  returning clients.id into v_client_id;

  for i in 1 .. coalesce(array_length(p_emails, 1), 0) loop
    v_email := lower(btrim(p_emails[i]));
    continue when v_email = '';

    v_domain := split_part(v_email, '@', 2);
    v_is_internal := exists (
      select 1 from unnest(coalesce(p_internal_domains, '{}')) d
      where v_domain = d or v_domain like ('%.' || d)
    );

    insert into public.contacts (client_id, email, full_name, is_internal)
    values (v_client_id, v_email, coalesce(btrim(p_contact_name), ''), v_is_internal)
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

grant execute on function public.create_client_with_contacts(text, text, text[], text[], text[]) to authenticated;
