-- ============================================================================
-- The provider's own message id, captured at send time. The Resend webhook
-- (0009+ application code, see src/app/api/webhooks/resend) reports delivery
-- and bounce events keyed by this id — without it there is no way to map an
-- asynchronous "email.bounced" event back to the recipient it happened to.
-- ============================================================================

alter table public.campaign_recipients
  add column provider_message_id text;

create index campaign_recipients_provider_message_id_idx
  on public.campaign_recipients (provider_message_id)
  where provider_message_id is not null;
