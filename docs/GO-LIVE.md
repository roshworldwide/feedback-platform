# Going live

This is the checklist between "the app builds green" and "a real client
receives a real email." Every item here exists because skipping it fails
quietly — a missing DKIM record doesn't error, it just lands in spam; a
missing webhook secret doesn't error, it just means bounces are never
recorded. Work through it in order.

## 1 · Resend domain verification

Mail sent from an unverified domain is either rejected outright or landed in
spam by every major provider — this is not a Resend-specific rule, it's how
SPF/DKIM/DMARC work everywhere.

1. In the Resend dashboard, add the domain that appears after the `@` in
   `EMAIL_FROM` (`convin.ai` for the default `Convin Data Labs
   <convinlabs@convin.ai>`).
2. Resend gives you three DNS records to add at your registrar:
   - **SPF** (a `TXT` record) — lists Resend as allowed to send for the domain.
   - **DKIM** (one or more `CNAME`/`TXT` records) — lets a receiving server
     verify the message wasn't altered in transit and really came from
     Resend on your behalf.
   - **DMARC** (a `TXT` record, usually on `_dmarc.<domain>`) — states what a
     receiving server should do with mail that fails SPF/DKIM. Start with
     `p=none` to observe without risk, tighten later.
3. Wait for DNS propagation (minutes to a few hours), then click "Verify" in
   Resend. Do not send real mail before this shows verified — every message
   sent from an unverified domain is training every major provider's spam
   filter against you before you've sent a single real report.
4. **`EMAIL_FROM` must be an address on the verified domain.** Setting it to
   anything else (a personal Gmail address, a domain you haven't verified)
   defeats the whole point — SPF/DKIM alignment is checked against the
   `From` header specifically.

## 2 · `NEXT_PUBLIC_APP_URL`

Every tracking pixel (`/api/t/o/[token]`), click redirect (`/api/t/c/[token]`),
rating link (`/f/[token]?r=N`) and unsubscribe link (`/u/[token]`) in a sent
email is built from this one value (`src/lib/email/render.ts`). If it's still
`http://localhost:3000` when a real send goes out, every one of those links
in every email points at a developer's laptop.

Set it to the real production origin (`https://reports.convin.ai`, or
whatever the deployed domain is) in the production environment **before** the
first real send, not after — a report already delivered cannot have its links
rewritten.

## 3 · Webhook endpoint

1. In the Resend dashboard, add a webhook endpoint pointing at
   `https://<your-domain>/api/webhooks/resend`.
2. Subscribe it to `email.delivered`, `email.bounced`, `email.complained`,
   `email.delivery_delayed`.
3. Resend shows a signing secret starting `whsec_` the moment the endpoint is
   created — set it as `RESEND_WEBHOOK_SECRET` in the production environment.
   The route (`src/app/api/webhooks/resend/route.ts`) refuses every event
   with a 503 until this is set — it never falls back to trusting an
   unverified body.
4. Resend's dashboard has a "send test event" button for each endpoint. Use
   it and confirm the route returns `200` — check the deployment's function
   logs for `[webhooks/resend]` lines if it doesn't.

## 4 · Cron

Two routes exist to be called on a schedule:

| Route | Intended schedule | Does |
|---|---|---|
| `/api/cron/send-scheduled` | every 5 minutes | Sends every campaign whose `scheduled_for` has passed |
| `/api/cron/run-rules` | every 15 minutes | Evaluates the three automation rules, records a finding per new violation |

**`vercel.json` currently declares no `crons` block.** Vercel's Hobby plan
only permits cron jobs that run at most once a day, which the 5-minute
schedule above violates outright — a deploy with that `crons` entry present
is rejected before it ever builds. Nothing calls these routes right now.
Pick one before relying on scheduled sends:

- **Upgrade the Vercel project to Pro**, then add back:
  ```json
  { "crons": [
    { "path": "/api/cron/send-scheduled", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/run-rules",       "schedule": "*/15 * * * *" }
  ]}
  ```
- **An external scheduler** — a GitHub Actions workflow on a `schedule:`
  trigger, cron-job.org, or Supabase `pg_cron` calling `net.http_post` — each
  hitting the two routes on the cadence above.

Either way, both authenticate with `CRON_SECRET` as a bearer token — set it
in the production environment. Vercel's own Cron Jobs (Pro path) automatically
send `Authorization: Bearer $CRON_SECRET` when the env var of that exact name
is set, so no header configuration is needed beyond setting the variable. An
external scheduler needs that header configured explicitly: `curl -X POST -H
"Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/send-scheduled`
— both routes accept GET (what Vercel Cron sends) and POST (convenient for a
manual trigger or most third-party schedulers) identically.

**How to verify it ran:** both routes return a JSON summary
(`{claimed, sent, failed, skipped}` for send-scheduled;
`{rulesActive, examined, notified, alreadyNotified}` for run-rules) — check
the function's own logs for `[cron/send-scheduled]` / `[cron/run-rules]`
lines (on the Pro/Vercel-Cron path, also check the deployment's Cron Jobs tab
for delivery failures). A campaign that should have sent but shows
`scheduled_for` in the past and `status = 'scheduled'` means either the
scheduler isn't reaching the route at all, or no scheduler is configured yet
— see the two options above.

## 5 · First-send checklist

Do this against the real production deployment, with real DNS verified,
before telling anyone the system is live.

1. **Send to yourself.** From Compose, add yourself as an ad-hoc recipient
   (or send a test from the Review step) and confirm the email actually
   arrives — not just that the app reports success.
2. **Confirm open tracking fires.** Open the email (images/remote content
   enabled). Refresh the campaign screen and confirm the open count moved
   from 0 to 1.
3. **Confirm a click is recorded once, and only once.** Click "Open full
   report." Confirm the campaign's click count reads 1. Click it two more
   times from the same email — the count must still read 1
   (`email_events_one_open_per_recipient`/click dedup is enforced at the
   database, not merely in the UI — this step is checking that enforcement,
   not the UI's arithmetic).
4. **Confirm a rating writes.** Click a star from the email. Confirm the
   Feedback tab shows the rating against the correct campaign.
5. **Confirm the unsubscribe link works end to end.** Click "Unsubscribe" in
   the footer, confirm the page, then open that client's Contacts tab and
   confirm the address now shows "Inactive." Send a second test to the same
   client and confirm that address is not selectable/is excluded.
6. **Confirm the webhook is live**, not just configured: after step 1's send,
   check the deployment logs for a `[webhooks/resend]` line, or check that
   `campaign_recipients.provider_message_id` is populated for that recipient
   (it's set at send time regardless of the webhook, but its presence is what
   lets a later bounce/complaint event find the right row).

Only after all six pass should a real client be added and a real report sent.

## 6 · Rolling back a bad send

There is no "unsend" — once `sendEmail()` returns success the message is in
Resend's hands. What's available:

- **A recurring series about to fire again wrongly:** pause it. On the
  client's page or the series list, turning a series's Active toggle off
  stops its next scheduled run; it does not touch anything already sent
  (`src/app/(app)/automation/page.tsx`).
- **A scheduled campaign that hasn't gone out yet, but shouldn't:** change its
  status to `cancelled` before `scheduled_for` arrives — once `run-scheduled`
  claims it (status moves to `sending`), it's past the point of no return for
  that invocation.
- **A campaign that sent with wrong content:** there's no retroactive fix to
  what already arrived. Mark it `failed` if it was sent to nobody who should
  have received it (a test-data mixup, sent to the wrong client entirely) so
  it's visibly flagged in the Campaigns list rather than silently reading as
  a normal successful send; otherwise, the honest move is a prompt follow-up
  correction, not a database edit that pretends the mistake never went out.
- **An address is bouncing repeatedly or complained:** the webhook already
  handles this automatically (`email.bounced` records the bounce;
  `email.complained` deactivates the contact outright, per
  `src/app/api/webhooks/resend/route.ts`) — no manual action needed for a
  single bad address. For a client-wide pause, set the client's status to
  `paused`.
