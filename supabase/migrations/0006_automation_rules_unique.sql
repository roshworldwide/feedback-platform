-- ============================================================================
-- `automation_rules` had no unique constraint, so seed.sql's
-- `on conflict do nothing` had nothing to conflict against — every re-run of
-- the seed inserted three more rows with the same name, and the Automation
-- page rendered each rule as many times as the seed had been run. This
-- dedupes what's already there (oldest row per name kept — nothing
-- references automation_rules.id by foreign key, so this is safe) and adds
-- the constraint the seed's own ON CONFLICT clause always assumed existed.
-- ============================================================================

delete from public.automation_rules a
using public.automation_rules b
where a.name = b.name
  and a.created_at > b.created_at;

alter table public.automation_rules
  add constraint automation_rules_name_key unique (name);
