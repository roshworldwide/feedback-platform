# Convin Data Labs — Insights Dashboard v2

Internal platform for the Data Labs team: compose a numbered insights report,
send it to a client's stakeholders, and measure whether it landed — opens,
click-throughs, star ratings and written feedback, all attributed to a real
client and a real report.

Next.js 16 (App Router) · React 19 · TypeScript strict · Supabase (Postgres +
Auth + RLS) · Tailwind v4 · the AURUM design system.

---

## Getting it running

```bash
cp .env.example .env.local     # fill in the Supabase values
npm install
npm run dev
```

**Database.** In the Supabase SQL editor, run in order:

```
supabase/migrations/0001_schema.sql
supabase/migrations/0002_views.sql
supabase/migrations/0003_rls.sql
supabase/seed.sql              # optional — clients and report series only
```

**First user.** Create one in Supabase Auth, then promote them:

```sql
update public.profiles set role = 'admin' where email = 'you@convin.ai';
```

Everyone after that is invited from Settings → Team.

**Checks.**

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint, zero warnings tolerated
npm run test        # vitest — the metric arithmetic
npm run build       # production build
```

---

## What was wrong with v1, and where each fix lives

This is a rebuild, not a refactor. The table below is the audit trail — every
row is a defect that was live in the previous system.

| v1 defect | Fix | Where |
|---|---|---|
| Open rate inflated ~48%: the click handler wrote a synthetic `open` row, and the dashboard then computed `opens + clicks` on top of it | `opened` is `EXISTS(open OR click)` per recipient — set membership, never addition. A partial unique index makes a second open row physically impossible | `0002_views.sql` · `metrics.ts` · `metrics.test.ts` |
| Client history showed "0 emails" while the dashboard showed recent sends — the history row was written only if someone typed a client name, and matched on that free-text string | `campaigns.client_id` is `NOT NULL` and a real foreign key. Client is a searchable select in Compose. Case-insensitive unique index on client name | `0001_schema.sql` · `components/compose/client-select.tsx` |
| `is_test` existed in the schema and nothing ever filtered on it, so a one-recipient test defined the whole Daily tab | Excluded by default in `period_stats`; the caller must opt *in* to polluted numbers, and the UI states the exclusion on screen | `0002_views.sql` · `components/overview/controls.tsx` |
| Internal `@convin.ai` CCs counted as client engagement | `is_internal` on contacts, snapshotted onto each recipient at send time, excluded from every headline figure | `0001_schema.sql` · `compose/actions.ts` |
| RLS enabled on all seven tables, then defeated by `using (true) with check (true)` | Role-based policies. Deny by default, nothing granted to `anon`, writes to tracking tables only via the service role | `0003_rls.sql` |
| 17 four-digit PINs hard-coded in a public repo, seven belonging to departed staff who could still sign in | Supabase Auth. `is_active` is checked on every request in the app layout; deactivation is one click and is audited | `app/(app)/layout.tsx` · `settings/team-panel.tsx` |
| One shared "Admin" identity, no record of who did anything | Three roles and an append-only audit log that its own users cannot edit | `0003_rls.sql` · `lib/audit.ts` |
| A rating was displayed without saying which report it was for, making legitimate data look self-contradictory | Every rating renders with its campaign chip, everywhere. Where the campaign cannot be resolved it says so rather than dropping it | `components/feedback/feedback-card.tsx` |
| Email activity silently truncated at 40 rows against a total of 160 | `DataTable` always states the true total — "Showing 1–25 of 160" | `components/ui/table.tsx` |
| Three global, unnamed, unowned draft slots | `drafts` table — named, owned, searchable, duplicable | `queries/drafts.ts` |
| "At Risk" hard-wired to 0; "Active" always equalled "Total" | `client_health` view with a stated rule: no send in 45 days, or average rating below 3.5 | `0002_views.sql` |
| Delivered count labelled "Total Sent"; a 99.4% rate captioned "160 emails" when 161 were attempted | Attempted and delivered are separate columns and separate cards | `metrics.ts` |
| Expired AI key surfaced a raw provider 401 to end users | AI is optional. Absent key ⇒ the feature is disabled with an explanation; a provider error never reaches the UI | `lib/env.ts` |
| Debug panel exposing the Supabase URL shipped in production | Gone. Environment is validated at boot by Zod and never rendered | `lib/env.ts` |

Run `npm run test` to see the first row asserted directly: with 160 delivered,
23 openers and 11 of them clicking, v1 displayed 21.2%. The test pins it at
14.4% and fails if anyone reintroduces the addition.

---

## Architecture

```
src/
  app/
    (auth)/signin            magic-link sign-in
    (app)/                   authenticated shell — gate lives in layout.tsx
      overview               KPIs, engagement, CSAT, needs-attention
      campaigns/[id]         funnel · recipients · content · activity
      clients/[slug]         client 360
      compose/[draftId]      five-step authoring flow
      feedback               the inbox of what clients actually said
      automation             recurring series, schedule, readiness, rules
      settings               team · sender · appearance · data · audit
    f/[token]                public feedback page (client-facing)
    api/t/{o,c,r}/[token]    open pixel · click redirect · rating capture
  components/ui              AURUM primitives — capsules, controls, surfaces
  lib/
    metrics.ts               every rate, defined once, unit-tested
    queries/                 all reads, returning explicit ok/failure results
    email/                   one renderer, shared by preview and send
supabase/migrations/         schema · views · RLS
```

**Metrics are computed in the database**, in `campaign_stats`, `period_stats`
and `client_health`. No route or component recalculates an engagement figure —
that is precisely how v1 ended up with three different answers for the same
question. If you need a new number, add it to a view.

**Reads never fabricate.** Query functions return a discriminated result and
failures render an explicit "Couldn't load". A zero is a measurement; an
outage is not a zero.

---

## The design system

AURUM — titanium and champagne, capsule geometry, five finishes with full
light/dark parity. The token layer is `src/styles/aurum.css`; the rules for
building against it are in `DESIGN.md`. Read that before writing a component.

The short version: never write a hex in a component, one gold element per
screen, anything a finger touches is a capsule, every dimension is 4 × n, and
the fourteen type steps are a closed set.

**Dark mode** is in the top bar — it swaps the two default finishes (Black
Titanium ⇄ Natural Titanium). All five finishes are in Settings → Appearance.
Switching is a 320ms cross-fade of the token layer only; nothing relayouts.
The finish is written to `<html data-finish>` before first paint by a bootstrap
script, so there is no flash of the wrong theme.

---

## Deploying

Vercel, with the `.env.example` variables set in project settings. Two things
to get right:

- **`NEXT_PUBLIC_APP_URL` must be the public origin.** Every tracking pixel,
  click redirect and star-rating link in every sent email is built against it.
  Leave it as localhost and you post a dev URL to a client's inbox.
- **`SUPABASE_SERVICE_ROLE_KEY` is server-only.** `lib/env.ts` throws if it is
  read in the browser, so a mistake is a build error rather than a key leak.

Scheduled sends need a cron hitting `/api/cron/*` with `CRON_SECRET` as a
bearer token — `vercel.json` if you are on Vercel, any scheduler otherwise.

---

## Conventions

Server Components by default; `"use client"` only where interaction demands it.
Mutations are Server Actions, and every one that changes client-visible state
writes to the audit log. Never call `Date.now()` in a render — import
`serverNow()` from `@/lib/clock`, so the string the server printed and the
string the browser hydrates are the same string.
