-- ============================================================================
-- Adds `clients_reached` to period_stats: the distinct client count behind
-- `campaigns_sent`, scoped by the same window and the same two exclusions.
-- Overview's KPI row showed "Campaigns sent" with no answer to "how many
-- clients is that", which is exactly the question a caller reaches for next.
--
-- CREATE OR REPLACE cannot add a column to an existing return table, so the
-- function is dropped and recreated with the same signature.
-- ============================================================================

drop function if exists public.period_stats(timestamptz, timestamptz, uuid, boolean, boolean);

create function public.period_stats(
  p_from            timestamptz,
  p_to              timestamptz,
  p_client_id       uuid    default null,
  p_exclude_internal boolean default true,
  p_exclude_test     boolean default true
)
returns table (
  campaigns_sent       bigint,
  clients_reached      bigint,
  recipients_attempted bigint,
  delivered            bigint,
  bounced              bigint,
  unique_opens         bigint,
  unique_clicks        bigint,
  ratings              bigint,
  comments             bigint,
  avg_rating           numeric,
  excluded_internal    bigint,
  excluded_test_sends  bigint
)
language sql
stable
as $$
  with scoped as (
    select e.*
    from public.recipient_engagement e
    where e.sent_at >= p_from
      and e.sent_at <  p_to
      and (p_client_id is null or e.client_id = p_client_id)
  ),
  kept as (
    select * from scoped
    where (not p_exclude_internal or not is_internal)
      and (not p_exclude_test     or not is_test)
  )
  select
    (select count(distinct campaign_id) from kept)                    as campaigns_sent,
    (select count(distinct client_id) from kept)                      as clients_reached,
    (select count(*) from kept)                                       as recipients_attempted,
    (select count(*) from kept where delivered)                       as delivered,
    (select count(*) from kept where bounced)                         as bounced,
    -- Set membership, not row count. Never opens + clicks.
    (select count(*) from kept where opened)                          as unique_opens,
    (select count(*) from kept where clicked)                         as unique_clicks,
    (select count(*) from kept where rating is not null)              as ratings,
    (select count(*) from kept where has_comment)                     as comments,
    (select round(avg(rating)::numeric, 2) from kept where rating is not null) as avg_rating,
    (select count(*) from scoped where is_internal)                   as excluded_internal,
    (select count(distinct campaign_id) from scoped where is_test)    as excluded_test_sends;
$$;

grant execute on function public.period_stats(timestamptz, timestamptz, uuid, boolean, boolean) to authenticated;
