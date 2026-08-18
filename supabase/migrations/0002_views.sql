-- ============================================================================
-- Metric layer.
--
-- Every number the product displays is defined exactly once, here. No route,
-- component or report is permitted to recompute an engagement figure in
-- application code — that is how v1 ended up with an open rate that counted
-- each click twice.
-- ============================================================================

-- ── Recipient engagement ─────────────────────────────────────────────────────
-- The single source of truth for "did this person engage".
--
-- `opened` is EXISTS(open OR click), evaluated per recipient. A click implies
-- an open — but implication is not addition. Because this is a set-membership
-- test rather than a row count, a recipient who clicks nine times still
-- contributes exactly one open and one opener. This is the C2 fix, expressed
-- structurally so no caller can get it wrong.
create or replace view public.recipient_engagement as
select
  r.id                                   as recipient_id,
  r.campaign_id,
  c.client_id,
  c.is_test,
  c.sent_at,
  r.email,
  r.full_name,
  r.is_internal,
  (r.delivered_at is not null)           as delivered,
  (r.bounced_at   is not null)           as bounced,
  exists (
    select 1 from public.email_events e
    where e.recipient_id = r.id and e.type in ('open', 'click')
  )                                      as opened,
  exists (
    select 1 from public.email_events e
    where e.recipient_id = r.id and e.type = 'click'
  )                                      as clicked,
  (
    select min(e.occurred_at) from public.email_events e
    where e.recipient_id = r.id and e.type in ('open', 'click')
  )                                      as first_opened_at,
  f.rating,
  f.comment,
  (f.comment is not null and length(btrim(f.comment)) > 0) as has_comment,
  -- Added for the Overview email-activity table and drill-downs: the report a
  -- row belongs to, and when its rating was given. Identifying data, not a
  -- computed metric, but it belongs here rather than a per-caller join so
  -- every reader names the same report the same way.
  c.report_number,
  c.title,
  f.created_at as rated_at
from public.campaign_recipients r
join public.campaigns c on c.id = r.campaign_id
left join public.feedback f on f.recipient_id = r.id;

-- ── Campaign rollup ──────────────────────────────────────────────────────────
-- Headline figures exclude internal recipients. The internal columns are kept
-- alongside so the UI can state exactly what it excluded rather than hiding it.
create or replace view public.campaign_stats as
select
  c.id                                    as campaign_id,
  c.client_id,
  c.series_id,
  c.report_number,
  c.title,
  c.status,
  c.is_test,
  c.sent_at,

  count(e.recipient_id)                                        as recipients_total,
  count(e.recipient_id) filter (where e.is_internal)           as recipients_internal,
  count(e.recipient_id) filter (where not e.is_internal)       as recipients_external,

  -- Attempted vs delivered are distinct numbers and are never conflated.
  count(e.recipient_id) filter (where not e.is_internal and e.delivered) as delivered,
  count(e.recipient_id) filter (where not e.is_internal and e.bounced)   as bounced,

  count(e.recipient_id) filter (where not e.is_internal and e.opened)    as unique_opens,
  count(e.recipient_id) filter (where not e.is_internal and e.clicked)   as unique_clicks,
  count(e.recipient_id) filter (where not e.is_internal and e.rating is not null) as ratings,
  avg(e.rating) filter (where not e.is_internal)                as avg_rating,
  count(e.recipient_id) filter (where not e.is_internal and e.has_comment) as comments
from public.campaigns c
left join public.recipient_engagement e on e.campaign_id = c.id
group by c.id;

-- ── Period rollup ────────────────────────────────────────────────────────────
-- The dashboard's only aggregate entry point.
--
-- Both exclusions default to true: a caller must opt *in* to polluted numbers,
-- and the UI states the exclusion on screen. In v1 both were opt-out in
-- practice — the flags existed and nothing consulted them.
create or replace function public.period_stats(
  p_from            timestamptz,
  p_to              timestamptz,
  p_client_id       uuid    default null,
  p_exclude_internal boolean default true,
  p_exclude_test     boolean default true
)
returns table (
  campaigns_sent       bigint,
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

-- ── Client health ────────────────────────────────────────────────────────────
-- FIX: v1's "At Risk" card was hard-wired to 0 and "Active" always equalled
-- "Total". Health is now a stated rule over real data.
create or replace view public.client_health as
select
  cl.id                                   as client_id,
  cl.name,
  cl.slug,
  cl.status,
  cl.owner_id,
  count(distinct ct.id) filter (where ct.is_active and not ct.is_internal) as external_contacts,
  count(distinct ct.id) filter (where ct.is_active and ct.is_internal)     as internal_contacts,
  count(distinct c.id) filter (where c.status = 'sent' and not c.is_test)  as campaigns_sent,
  max(c.sent_at) filter (where c.status = 'sent' and not c.is_test)        as last_sent_at,
  round(avg(f.rating)::numeric, 2)                                        as avg_rating,
  count(f.id)                                                             as ratings,
  case
    when cl.status <> 'active' then 'inactive'
    when max(c.sent_at) filter (where c.status = 'sent' and not c.is_test)
         is null then 'no-sends'
    when max(c.sent_at) filter (where c.status = 'sent' and not c.is_test)
         < now() - interval '45 days' then 'at-risk'
    when avg(f.rating) is not null and avg(f.rating) < 3.5 then 'at-risk'
    when max(c.sent_at) filter (where c.status = 'sent' and not c.is_test)
         < now() - interval '30 days' then 'watch'
    when avg(f.rating) is not null and avg(f.rating) < 4.0 then 'watch'
    else 'healthy'
  end                                     as health
from public.clients cl
left join public.contacts  ct on ct.client_id = cl.id
left join public.campaigns c  on c.client_id  = cl.id
left join public.feedback  f  on f.campaign_id = c.id
group by cl.id;

-- ── Needs attention ──────────────────────────────────────────────────────────
-- The Overview panel that tells a human what to do today.
create or replace view public.attention_items as
  -- Reports rated poorly and not yet reviewed
  select
    'low_rating'::text                       as kind,
    'critical'::text                         as severity,
    f.id::text                               as ref_id,
    c.id                                     as campaign_id,
    c.client_id,
    format('%s rated %s/5 — %s',
           coalesce(nullif(r.full_name, ''), r.email),
           f.rating,
           coalesce(c.report_number, c.title))  as summary,
    f.created_at                             as occurred_at
  from public.feedback f
  join public.campaigns c on c.id = f.campaign_id
  join public.campaign_recipients r on r.id = f.recipient_id
  where f.rating <= 3 and f.reviewed_at is null

union all
  -- Sent campaigns where no external stakeholder ever opened
  select
    'no_external_open', 'warning',
    s.campaign_id::text, s.campaign_id, s.client_id,
    format('No external opens on %s', coalesce(s.report_number, s.title)),
    s.sent_at
  from public.campaign_stats s
  where s.status = 'sent'
    and not s.is_test
    and s.recipients_external > 0
    and s.unique_opens = 0
    and s.sent_at < now() - interval '3 days'

union all
  -- Clients that have gone quiet
  select
    'client_idle', 'warning',
    h.client_id::text, null::uuid, h.client_id,
    format('%s — no report in %s days', h.name,
           extract(day from now() - h.last_sent_at)::int),
    h.last_sent_at
  from public.client_health h
  where h.health = 'at-risk' and h.last_sent_at is not null

union all
  -- Addresses that need correcting
  select
    'bounce', 'warning',
    r.id::text, r.campaign_id, c.client_id,
    format('%s bounced — %s', r.email, coalesce(r.bounce_reason, 'no reason given')),
    r.bounced_at
  from public.campaign_recipients r
  join public.campaigns c on c.id = r.campaign_id
  where r.bounced_at is not null
    and r.bounced_at > now() - interval '30 days';
