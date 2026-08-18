import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { claimAndSend, type ClaimStore } from "@/lib/cron/claim";
import { dispatchCampaign } from "@/lib/campaigns/dispatch";

/**
 * Fires every scheduled campaign whose time has come.
 *
 * `scheduled_for` being in the past used to mean nothing: nothing read the
 * column. This is the thing that reads it. `CRON_SECRET` as a bearer token is
 * the only way in — there is no session here, no browser, and an
 * unauthenticated caller must never be able to trigger a real send.
 *
 * Each due campaign is claimed (`scheduled → sending`) before it is sent, so
 * two overlapping invocations of this route — a slow prior run, a retried
 * request, a second scheduler pointed at the same secret — cannot send the
 * same campaign twice. See `src/lib/cron/claim.ts` for why the claim itself
 * is safe under concurrency.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** One invocation does not try to drain an unbounded backlog. */
const MAX_PER_RUN = 25;

function authorized(request: Request): boolean {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return false; // No secret configured means no caller is trusted.
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

function supabaseClaimStore(admin: ReturnType<typeof createAdminClient>): ClaimStore {
  return {
    async claim(id, from, to) {
      // `campaigns_sent_has_timestamp` requires `sent_at` in the very same
      // statement that sets status to 'sent' — a follow-up UPDATE would
      // violate the constraint for the instant between the two writes.
      const patch: Record<string, unknown> = { status: to };
      if (to === "sent") patch.sent_at = new Date().toISOString();

      const { data, error } = await admin
        .from("campaigns")
        .update(patch)
        .eq("id", id)
        .eq("status", from)
        .select("id");
      if (error) throw error;
      return (data ?? []).length > 0;
    },
  };
}

async function handle(request: Request): Promise<Response> {
  if (!authorized(request)) {
    console.warn("[cron/send-scheduled] rejected an unauthenticated invocation");
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const store = supabaseClaimStore(admin);

  const summary = { claimed: 0, sent: 0, failed: 0, skipped: 0 };

  try {
    const { data, error } = await admin
      .from("campaigns")
      .select("id")
      .eq("status", "scheduled")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(MAX_PER_RUN);

    if (error) {
      console.error("[cron/send-scheduled] could not read due campaigns: %s", error.message);
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    const due = (data ?? []) as { id: string }[];

    for (const { id } of due) {
      const result = await claimAndSend(store, id, async (campaignId) => {
        const outcome = await dispatchCampaign(admin, campaignId);
        if (!outcome.ok) return { ok: false, reason: outcome.reason };
        return outcome.accepted > 0
          ? { ok: true }
          : { ok: false, reason: `all ${outcome.attempted} recipients were rejected` };
      });

      if (result === "skipped") {
        summary.skipped += 1;
        continue;
      }
      summary.claimed += 1;
      if (result === "sent") summary.sent += 1;
      else summary.failed += 1;
    }

    return Response.json({ ok: true, ...summary, examined: due.length });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "unknown failure";
    console.error("[cron/send-scheduled] unhandled: %s", message);
    return Response.json({ ok: false, error: message, ...summary }, { status: 500 });
  }
}

// Vercel Cron always issues GET. POST is kept for a manual or curl-driven
// trigger during setup and incident response — see docs/GO-LIVE.md.
export const GET = handle;
export const POST = handle;
