import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { recordAudit } from "@/lib/audit";

/**
 * Runs the three seeded automation rules.
 *
 * There is no separate detection engine here: `attention_items` already
 * computes exactly these three conditions (no external open after N days, a
 * low rating, a client gone quiet) for the Overview "Needs attention" panel,
 * and re-deriving the same thresholds a second time is how the two would
 * quietly drift apart. This route reads that view and, for whichever rules
 * are `is_active`, writes an audit-log entry per newly-seen violation — the
 * nearest thing this schema has to a notification, since there is no task or
 * alert table (yet) to hand the finding to.
 *
 * KNOWN GAP, deliberate: `attention_items`'s thresholds are the SQL literals
 * 3 days / rating ≤ 3 / 45 days, not `automation_rules.threshold`. Editing a
 * rule's threshold in Settings does not currently reach the view either — this
 * predates this route and is not something a cron job should silently paper
 * over by re-implementing detection with a second set of numbers.
 *
 * Idempotent by construction: a rule already recorded for the same entity in
 * the last 24 hours is skipped, so a five-minute tick does not spam the audit
 * log with the same open-report reminder every five minutes.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_PER_RUN = 100;
const DEDUP_WINDOW_HOURS = 24;

const RULE_KIND: Record<string, string> = {
  no_open_after_days: "no_external_open",
  low_rating: "low_rating",
  client_idle: "client_idle",
};

const RULE_ACTION: Record<string, string> = {
  no_open_after_days: "automation.notify_owner",
  low_rating: "automation.create_task",
  client_idle: "automation.flag_at_risk",
};

function authorized(request: Request): boolean {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

type Row = Record<string, unknown>;

async function handle(request: Request): Promise<Response> {
  if (!authorized(request)) {
    console.warn("[cron/run-rules] rejected an unauthenticated invocation");
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const summary = { rulesActive: 0, examined: 0, notified: 0, alreadyNotified: 0 };

  try {
    const { data: rules, error: rulesError } = await admin
      .from("automation_rules")
      .select("id, name, trigger, action, is_active")
      .eq("is_active", true);
    if (rulesError) return Response.json({ ok: false, error: rulesError.message }, { status: 500 });

    const activeRules = (rules ?? []) as unknown as Row[];
    summary.rulesActive = activeRules.length;

    const since = new Date(Date.now() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    for (const rule of activeRules) {
      const trigger = String(rule.trigger);
      const kind = RULE_KIND[trigger];
      const auditAction = RULE_ACTION[trigger];
      if (!kind || !auditAction) continue; // An unrecognised trigger is skipped, not guessed at.

      const { data: items, error: itemsError } = await admin
        .from("attention_items")
        .select("kind, ref_id, campaign_id, client_id, summary, occurred_at")
        .eq("kind", kind)
        .order("occurred_at", { ascending: false, nullsFirst: false })
        .limit(MAX_PER_RUN);
      if (itemsError) {
        console.error("[cron/run-rules] couldn't read attention_items for %s: %s", trigger, itemsError.message);
        continue;
      }

      for (const item of (items ?? []) as unknown as Row[]) {
        summary.examined += 1;
        const entityId = String(item.ref_id ?? "");
        if (entityId === "") continue;

        const { count, error: dedupError } = await admin
          .from("audit_log")
          .select("id", { count: "exact", head: true })
          .eq("action", auditAction)
          .eq("entity_id", entityId)
          .gte("created_at", since);
        if (dedupError) {
          console.error("[cron/run-rules] dedup check failed: %s", dedupError.message);
          continue;
        }
        if ((count ?? 0) > 0) {
          summary.alreadyNotified += 1;
          continue;
        }

        await recordAudit({
          action: auditAction,
          entityType: kind === "client_idle" ? "clients" : "campaigns",
          entityId,
          summary: `${String(rule.name)}: ${String(item.summary)}`,
          diff: {
            rule_id: String(rule.id),
            trigger,
            campaign_id: item.campaign_id ? String(item.campaign_id) : null,
            client_id: item.client_id ? String(item.client_id) : null,
          },
        });
        summary.notified += 1;
      }
    }

    return Response.json({ ok: true, ...summary });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "unknown failure";
    console.error("[cron/run-rules] unhandled: %s", message);
    return Response.json({ ok: false, error: message, ...summary }, { status: 500 });
  }
}

// Vercel Cron always issues GET. POST is kept for a manual or curl-driven
// trigger during setup and incident response — see docs/GO-LIVE.md.
export const GET = handle;
export const POST = handle;
