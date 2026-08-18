/**
 * The atomic claim.
 *
 * A scheduled-send cron route can be invoked more than once for the same due
 * campaign — a slow prior run still finishing, a retried request, two
 * schedulers pointed at the same secret. Claiming is one conditional UPDATE
 * (`status = 'sending' WHERE id = ? AND status = 'scheduled'`), which
 * Postgres itself serialises: the second of two concurrent statements against
 * the same row waits on the first's row lock, then re-evaluates its WHERE
 * clause against the now-committed row and matches nothing. The caller never
 * decides "I own this" — the database does, and a lost claim is "someone
 * else has it," not an error.
 *
 * This file is dependency-free on purpose: the real implementation (a
 * Supabase conditional update) lives beside the cron route that uses it, and
 * this pure core is what `claim.test.ts` exercises against a fake store that
 * models the same compare-and-swap semantics without a live database.
 */

export type ClaimStore = {
  /** Atomically moves a row from `from` to `to`. False means it wasn't there to move. */
  claim(id: string, from: string, to: string): Promise<boolean>;
};

export type SendOutcome = { ok: true } | { ok: false; reason: string };

export type DispatchResult = "sent" | "failed" | "skipped";

/**
 * Claims one due campaign and, only if the claim wins, calls `send`. A lost
 * claim calls `send` zero times. `send` throwing is treated the same as it
 * returning `{ok:false}` — the row still moves to `failed` rather than being
 * left stuck in `sending` forever.
 */
export async function claimAndSend(
  store: ClaimStore,
  id: string,
  send: (id: string) => Promise<SendOutcome>,
): Promise<DispatchResult> {
  const claimed = await store.claim(id, "scheduled", "sending");
  if (!claimed) return "skipped";

  try {
    const outcome = await send(id);
    await store.claim(id, "sending", outcome.ok ? "sent" : "failed");
    return outcome.ok ? "sent" : "failed";
  } catch {
    await store.claim(id, "sending", "failed");
    return "failed";
  }
}
