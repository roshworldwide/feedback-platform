import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The audit trail.
 *
 * v1 had one shared "Admin" identity and no record of who did anything, so
 * every question that began "who changed…" ended in a shrug. Every mutation in
 * this application calls `recordAudit`, and the log is written by the service
 * role because `audit_log` grants INSERT to nobody — an audit trail its own
 * users can author is not an audit trail.
 *
 * It never throws. Losing the ability to write a log line must not roll back
 * the work the line describes; the failure is reported to the server console
 * and the caller carries on.
 */

export type AuditEntry = {
  actorId?: string | null;
  actorEmail?: string | null;
  /** Verb in past tense, dotted namespace — "campaign.sent", "profile.deactivated". */
  action: string;
  /** The table or concept the action landed on. */
  entityType: string;
  entityId?: string | null;
  /** One sentence a human can read in the log without opening the diff. */
  summary?: string;
  /** Before/after, or the parameters of the action. Never a password or a key. */
  diff?: Record<string, unknown>;
};

export async function recordAudit(entry: AuditEntry): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("audit_log").insert({
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      summary: entry.summary ?? "",
      diff: entry.diff ?? {},
    });
    if (error) {
      console.error("[audit] could not record %s: %s", entry.action, error.message);
      return false;
    }
    return true;
  } catch (cause) {
    console.error("[audit] could not record %s", entry.action, cause);
    return false;
  }
}

export type AuditRow = {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  created_at: string;
};
