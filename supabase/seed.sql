-- ============================================================================
-- Optional seed — the client roster and report cadence only.
--
-- This is a FRESH START by design. It creates no campaigns, no recipients, no
-- events and no ratings, because carrying v1's engagement history forward would
-- import numbers produced by the double-counting bug and quietly re-contaminate
-- every average on the dashboard. Real figures begin with the first real send.
--
-- What it does seed is the structure that is expensive to retype and cheap to
-- verify: fifteen clients, their report series, and the cadence each one runs
-- on. Contacts are deliberately NOT seeded — email addresses are client PII and
-- belong in the app, entered by someone who can confirm they are current.
--
-- Run after 0001–0003. Safe to re-run.
-- ============================================================================

insert into public.clients (name, slug, status, tags, timezone) values
  ('Thyrocare',      'thyrocare',      'active', '{diagnostics,farming-team}', 'Asia/Kolkata'),
  ('Myntra',         'myntra',         'active', '{retail}',                   'Asia/Kolkata'),
  ('Cleartrip',      'cleartrip',      'active', '{travel}',                   'Asia/Kolkata'),
  ('Housing',        'housing',        'active', '{proptech}',                 'Asia/Kolkata'),
  ('Metropolis',     'metropolis',     'active', '{diagnostics}',              'Asia/Kolkata'),
  ('Flipkart',       'flipkart',       'active', '{e-commerce}',               'Asia/Kolkata'),
  ('SBI Life',       'sbi-life',       'active', '{insurance}',                'Asia/Kolkata'),
  ('Fyers',          'fyers',          'active', '{fintech}',                  'Asia/Kolkata'),
  ('Apna',           'apna',           'active', '{jobs}',                     'Asia/Kolkata'),
  ('Physics Wallah', 'physics-wallah', 'active', '{edtech}',                   'Asia/Kolkata'),
  ('Allen',          'allen',          'active', '{edtech}',                   'Asia/Kolkata'),
  ('Red Taxi',       'red-taxi',       'active', '{mobility}',                 'Asia/Kolkata'),
  ('Livpure',        'livpure',        'active', '{consumer}',                 'Asia/Kolkata'),
  ('Niva Bupa',      'niva-bupa',      'active', '{insurance}',                'Asia/Kolkata'),
  ('Realme',         'realme',         'active', '{devices}',                  'Asia/Kolkata')
on conflict (slug) do nothing;

-- ── Report series ────────────────────────────────────────────────────────────
-- The DL-nnn numbering was always a cadence. v1 left it implicit in a subject
-- line, which is why DL-034 could exist three times over. Here it is a row.
insert into public.report_series (client_id, name, frequency)
select c.id, s.name, s.frequency::series_frequency
from (values
  ('thyrocare',      'DeGrowth Analysis — Farming Teams', 'monthly'),
  ('thyrocare',      'Competitors & Reasons',             'monthly'),
  ('housing',        'Agent Training Plan',               'monthly'),
  ('housing',        'Agent Related Issues',              'monthly'),
  ('fyers',          'Prime Plan VOC',                    'fortnightly'),
  ('myntra',         'Customer Pain Points',              'monthly'),
  ('metropolis',     'Non-Conversion Reasons',            'monthly'),
  ('metropolis',     'Test Booking Drivers',              'monthly'),
  ('cleartrip',      'Check-in Denial',                   'adhoc'),
  ('cleartrip',      'Repeat Calls Analysis',             'monthly'),
  ('flipkart',       'Escalation Analysis',               'monthly'),
  ('sbi-life',       'Customer VOC — Loan Queries',       'monthly'),
  ('apna',           'Win Behaviour Analysis',            'monthly'),
  ('allen',          'Top SAs Playbook',                  'monthly'),
  ('physics-wallah', 'Win Loss Analysis',                 'quarterly'),
  ('red-taxi',       'Business Leakage Issues',           'monthly'),
  ('livpure',        'Retention Trend Analysis',          'monthly'),
  ('niva-bupa',      'Long AHT Reasons',                  'quarterly'),
  ('realme',         'Customer VOC — Escalation',         'quarterly')
) as s(slug, name, frequency)
join public.clients c on c.slug = s.slug
on conflict do nothing;

-- ── Draft gallery ────────────────────────────────────────────────────────────
-- Ten starter drafts, one per intent v1's gallery covered. v1's own ten were
-- Sense Audit copy (Bot Score, Auto-Fail, Tier-1 parameters) addressed to
-- fictional clients and dated Q1 2025 — porting that verbatim would put copy
-- in the gallery that has to be deleted before it's useful. These are written
-- fresh, in the DL insights-report voice, against the real clients and report
-- series seeded above. `owner_id` is the earliest profile on record, if one
-- exists yet, so the gallery is editable rather than permanently "not yours";
-- it is null (and therefore read-only until duplicated) on a install with no
-- signed-up user yet, which is the correct degraded behaviour, not a bug.
insert into public.drafts (name, client_id, series_id, owner_id, payload)
select
  g.name,
  c.id,
  s.id,
  (select id from public.profiles order by created_at asc limit 1),
  jsonb_build_object(
    'clientId', c.id,
    'seriesId', s.id,
    'reportNumber', g.report_number,
    'title', g.title,
    'periodLabel', g.period_label,
    'subject', g.subject,
    'bodyMd', g.body_md,
    'templateKey', g.template_key
  )
from (values
  (
    'Executive report — Thyrocare farming teams',
    'thyrocare', 'DeGrowth Analysis — Farming Teams',
    'DL-041', 'DL-041 || Convin Data Insights || Farming-team attrition drivers || Thyrocare ||',
    'August 2026', 'Thyrocare: farming-team attrition, at a glance', 'executive-brief',
    E'## Farming-team attrition, at a glance\n\n- Attrition held at 6.2%, flat quarter over quarter\n- Two new exit reasons entered the top five: shift scheduling and incentive clarity\n- No single branch accounts for more than 18% of departures\n\nFull breakdown is in the linked report.'
  ),
  (
    'Campaign deep dive — Housing agent training',
    'housing', 'Agent Training Plan',
    'DL-018', 'DL-018 || Convin Data Insights || Training refresh, module drop-off || Housing ||',
    'July 2026', 'Housing: how the training refresh landed', 'convin-signature',
    E'## How the training refresh landed\n\n- 214 agents completed the refreshed onboarding module this cycle\n- Call-handling time fell 11% for agents who finished all four modules\n- Completion stalled at 61% — the drop-off concentrates in module 3\n\nModule-3 drop-off by team is broken out below.'
  ),
  (
    'Weekly digest — Metropolis non-conversion',
    'metropolis', 'Non-Conversion Reasons',
    'DL-027', 'DL-027 || Convin Data Insights || Weekly non-conversion digest || Metropolis ||',
    'Week of 11 Aug 2026', 'Metropolis: this week in non-conversion', 'convin-premium',
    E'## This week in non-conversion\n\n- 1,180 booking attempts logged, 74% converted\n- Price sensitivity remains the top decline reason, 31% of the 306 that did not convert\n- Slot unavailability rose 4 points week over week\n\nDetail and verbatims are in the linked report.'
  ),
  (
    'Client success — Cleartrip repeat calls',
    'cleartrip', 'Repeat Calls Analysis',
    'DL-052', 'DL-052 || Convin Data Insights || Repeat calls, three months down || Cleartrip ||',
    'July 2026', 'Cleartrip: repeat calls are down again', 'sunrise',
    E'## Repeat calls are down again\n\n- Repeat-call rate fell to 8.3%, the third straight month of improvement\n- The refund-status intent alone dropped from 19% to 11% of repeats\n- Nothing in this period needs escalation — a rare fully green month\n\nWorth sharing with the account team as a win.'
  ),
  (
    'Performance alert — Fyers Prime plan CSAT',
    'fyers', 'Prime Plan VOC',
    'DL-009', 'DL-009 || Convin Data Insights || Prime plan CSAT below floor || Fyers ||',
    'August 2026', 'Fyers: a threshold was crossed', 'alert',
    E'## A threshold was crossed\n\n- Prime-plan CSAT fell to 3.6, below the 4.0 floor for the first time this year\n- The drop concentrates in withdrawal-related contacts, up from 14% to 27% of volume\n- This report exists because the rule fired — not a routine send\n\nRecommend a same-week call with the Prime product owner.'
  ),
  (
    'QBR — Thyrocare Q3',
    'thyrocare', 'Competitors & Reasons',
    'DL-044', 'DL-044 || Convin Data Insights || Q3 quarterly business review || Thyrocare ||',
    'Q3 2026', 'Thyrocare: Q3 in review', 'forest',
    E'## Q3 in review\n\n- 42 reports sent this quarter, 3 more than Q2\n- Average rating held at 4.4, with 61% of ratings carrying a comment\n- Competitor mentions concentrate on two named labs, consistent with last quarter\n\nFull quarter numbers are in the linked deck.'
  ),
  (
    'New series launch — Housing agent issues',
    'housing', 'Agent Related Issues',
    'DL-001', 'DL-001 || Convin Data Insights || Agent-related issues, the first cut || Housing ||',
    'August 2026', 'Housing: a new recurring report starts here', 'convin-pro',
    E'## A new recurring report starts here\n\nThis is the first send in what will become a monthly series tracking agent-related issues raised by clients — response time, escalation handling, and repeat complaints against the same agent.\n\nThe cut below covers the last 30 days as a baseline; every future send compares against it.'
  ),
  (
    'Insights roundup — Metropolis test bookings',
    'metropolis', 'Test Booking Drivers',
    'DL-031', 'DL-031 || Convin Data Insights || What is driving test bookings || Metropolis ||',
    'August 2026', 'Metropolis: what is driving test bookings this month', 'classic',
    E'## What is driving test bookings this month\n\n- Referral-led bookings grew to 34% of the total, up from 28%\n- The at-home collection option is now requested on 1 of every 5 calls\n- Corporate wellness packages remain flat — worth a closer look next month\n\nFull driver breakdown follows.'
  ),
  (
    'Onboarding — Cleartrip check-in denials',
    'cleartrip', 'Check-in Denial',
    'DL-002', 'DL-002 || Convin Data Insights || Check-in denial baseline || Cleartrip ||',
    'Last 90 days', 'Cleartrip: welcome — here is how these reports work', 'convin-light',
    E'## Welcome — here is how these reports work\n\nThis series tracks check-in denials: how often they happen, the stated reason, and whether the traveller was rebooked same-day. It runs ad hoc, whenever a review is requested, rather than on a fixed date.\n\nThe section below is a baseline read of the last 90 days.'
  ),
  (
    'Month-end wrap — Metropolis',
    'metropolis', 'Non-Conversion Reasons',
    'DL-028', 'DL-028 || Convin Data Insights || Month-end non-conversion wrap || Metropolis ||',
    'August 2026', 'Metropolis: closing out the month', 'carbon',
    E'## Closing out the month\n\n- 4,760 booking attempts across the month, 76% converted — in line with the trailing three-month average\n- Price sensitivity and slot unavailability remain the top two decline reasons, unchanged in rank\n- One branch (Andheri) accounts for a disproportionate 22% of all declines\n\nFull branch-level table is in the linked report.'
  )
) as g(name, client_slug, series_name, report_number, title, period_label, subject, template_key, body_md)
join public.clients c on c.slug = g.client_slug
join public.report_series s on s.client_id = c.id and s.name = g.series_name
where not exists (select 1 from public.drafts d where d.name = g.name);

-- ── Automation rules ─────────────────────────────────────────────────────────
-- Stated as plain sentences in the UI. These three encode the follow-up loop
-- that v1 had no mechanism for at all: a bad rating simply sat there.
insert into public.automation_rules (name, trigger, threshold, action) values
  ('Chase unopened reports',  'no_open_after_days', 3,  'notify_owner'),
  ('Follow up weak ratings',  'low_rating',         3,  'create_task'),
  ('Flag quiet accounts',     'client_idle',        45, 'flag_at_risk')
on conflict do nothing;
