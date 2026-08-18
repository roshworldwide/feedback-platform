import { createHash } from "node:crypto";
import { createAdminClient, isUniqueViolation, row } from "@/lib/supabase/admin";

/**
 * Everything the tracking surface is allowed to write.
 *
 * RLS denies `anon` all access, so these run through the service role inside a
 * server route. Each function swallows its own failures and reports an outcome:
 * a recipient must never see a 500 because our database was busy, and a lost
 * open is a smaller harm than a broken image in a client's inbox.
 *
 * The rule this module exists to enforce: `recordClick` does NOT write an open
 * row. "Opened" is derived in `recipient_engagement` as EXISTS(open OR click).
 * v1 wrote a synthetic open on every click and then summed opens and clicks,
 * counting every clicker twice; that arithmetic is now structurally impossible.
 */

export type TrackedRecipient = {
  recipient_id: string;
  campaign_id: string;
  contact_id: string | null;
  email: string;
  full_name: string;
  is_internal: boolean;
  campaign_title: string;
  campaign_subject: string;
  report_number: string | null;
  period_label: string;
  report_url: string | null;
  sent_at: string | null;
  status: string;
  feedback_question: string;
  feedback_ask_comment: boolean;
  client_name: string;
  rating: number | null;
  comment: string | null;
};

type RecipientQueryRow = {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  email: string;
  full_name: string;
  is_internal: boolean;
  campaigns: {
    title: string;
    subject: string;
    report_number: string | null;
    period_label: string;
    report_url: string | null;
    sent_at: string | null;
    status: string;
    feedback_question: string;
    feedback_ask_comment: boolean;
    clients: { name: string } | null;
  } | null;
  feedback: { rating: number; comment: string | null }[] | null;
};

/** A token is 48 hex characters from `gen_random_bytes(24)`. */
export function isTokenShaped(token: string): boolean {
  return /^[0-9a-f]{16,128}$/i.test(token);
}

/**
 * Resolves a token to everything the public page and the tracking routes need,
 * in one round trip. Returns null for an unknown, malformed or expired token —
 * the caller renders a calm state, never an error.
 */
export async function resolveRecipient(token: string): Promise<TrackedRecipient | null> {
  if (!isTokenShaped(token)) return null;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("campaign_recipients")
      .select(
        `id, campaign_id, contact_id, email, full_name, is_internal,
         campaigns:campaign_id (
           title, subject, report_number, period_label, report_url, sent_at, status,
           feedback_question, feedback_ask_comment,
           clients:client_id ( name )
         ),
         feedback ( rating, comment )`,
      )
      .eq("token", token)
      .maybeSingle();

    if (error) return null;
    const found = row<RecipientQueryRow>(data);
    if (!found || !found.campaigns) return null;

    const feedback = found.feedback?.[0] ?? null;

    return {
      recipient_id: found.id,
      campaign_id: found.campaign_id,
      contact_id: found.contact_id,
      email: found.email,
      full_name: found.full_name,
      is_internal: found.is_internal,
      campaign_title: found.campaigns.title,
      campaign_subject: found.campaigns.subject,
      report_number: found.campaigns.report_number,
      period_label: found.campaigns.period_label,
      report_url: found.campaigns.report_url,
      sent_at: found.campaigns.sent_at,
      status: found.campaigns.status,
      feedback_question: found.campaigns.feedback_question,
      feedback_ask_comment: found.campaigns.feedback_ask_comment,
      client_name: found.campaigns.clients?.name ?? "your organisation",
      rating: feedback?.rating ?? null,
      comment: feedback?.comment ?? null,
    };
  } catch {
    return null;
  }
}

/** An IP is never stored. This is a one-way digest for de-duplication only. */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`cdl:${ip}`).digest("hex").slice(0, 32);
}

export function clientIpFrom(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return headers.get("x-real-ip");
}

export type TrackOutcome = "recorded" | "duplicate" | "unknown-token" | "failed";

async function recordEvent(
  recipient: TrackedRecipient,
  type: "open" | "click",
  headers: Headers,
): Promise<TrackOutcome> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("email_events").insert({
      recipient_id: recipient.recipient_id,
      campaign_id: recipient.campaign_id,
      type,
      user_agent: headers.get("user-agent")?.slice(0, 400) ?? null,
      ip_hash: hashIp(clientIpFrom(headers)),
    });
    if (!error) return "recorded";
    // `email_events_one_open_per_recipient` makes a second open impossible.
    // A repeat open is a fact about the reader, not an error to report.
    if (isUniqueViolation(error)) return "duplicate";
    console.error("[track] %s insert failed: %s", type, error.message);
    return "failed";
  } catch (cause) {
    console.error("[track] %s insert threw", type, cause);
    return "failed";
  }
}

export function recordOpen(recipient: TrackedRecipient, headers: Headers) {
  return recordEvent(recipient, "open", headers);
}

/**
 * Records a click and NOTHING ELSE.
 *
 * Do not add an open here. The view already treats a click as an open exactly
 * once; writing one would restore the defect this rebuild exists to remove.
 */
export function recordClick(recipient: TrackedRecipient, headers: Headers) {
  return recordEvent(recipient, "click", headers);
}

export type RatingOutcome =
  | { ok: true; rating: number; created: boolean }
  | { ok: false; reason: "invalid-rating" | "unknown-token" | "failed" };

export function parseRating(input: unknown): number | null {
  const value = typeof input === "number" ? input : Number.parseInt(String(input ?? ""), 10);
  if (!Number.isInteger(value) || value < 1 || value > 5) return null;
  return value;
}

/**
 * Upserts on `recipient_id`, which carries a UNIQUE constraint — so a second
 * star click corrects the rating rather than adding a second one. Only the
 * rating is written, so a comment left earlier survives a change of mind.
 */
export async function recordRating(
  recipient: TrackedRecipient,
  rating: number,
): Promise<RatingOutcome> {
  const value = parseRating(rating);
  if (value === null) return { ok: false, reason: "invalid-rating" };

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("feedback").upsert(
      {
        recipient_id: recipient.recipient_id,
        campaign_id: recipient.campaign_id,
        rating: value,
      },
      { onConflict: "recipient_id" },
    );
    if (error) {
      console.error("[track] rating upsert failed: %s", error.message);
      return { ok: false, reason: "failed" };
    }
    return { ok: true, rating: value, created: recipient.rating === null };
  } catch (cause) {
    console.error("[track] rating upsert threw", cause);
    return { ok: false, reason: "failed" };
  }
}

/** The comment is written separately, and only where a rating already exists. */
export async function recordComment(
  recipient: TrackedRecipient,
  comment: string,
): Promise<boolean> {
  const trimmed = comment.trim().slice(0, 2000);
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("feedback")
      .update({ comment: trimmed.length > 0 ? trimmed : null })
      .eq("recipient_id", recipient.recipient_id);
    if (error) {
      console.error("[track] comment update failed: %s", error.message);
      return false;
    }
    return true;
  } catch (cause) {
    console.error("[track] comment update threw", cause);
    return false;
  }
}

export type UnsubscribeOutcome = { ok: true; alreadyUnsubscribed: boolean } | { ok: false };

/**
 * Writes the `unsubscribe` event and, where the recipient is tied to a real
 * contact, deactivates it — `resolveRecipients` in Compose's send action only
 * ever selects `is_active` contacts, so this is what actually removes a
 * person from every recipient list, not merely a label. Checked before
 * writing rather than relying on a unique index (`email_events` has none for
 * this type), so clicking an already-processed link a second time changes
 * nothing rather than adding a second identical row.
 */
export async function recordUnsubscribe(recipient: TrackedRecipient): Promise<UnsubscribeOutcome> {
  try {
    const supabase = createAdminClient();

    const { count, error: existingError } = await supabase
      .from("email_events")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", recipient.recipient_id)
      .eq("type", "unsubscribe");
    if (existingError) {
      console.error("[track] unsubscribe lookup failed: %s", existingError.message);
      return { ok: false };
    }
    if ((count ?? 0) > 0) {
      return { ok: true, alreadyUnsubscribed: true };
    }

    const { error: eventError } = await supabase.from("email_events").insert({
      recipient_id: recipient.recipient_id,
      campaign_id: recipient.campaign_id,
      type: "unsubscribe",
    });
    if (eventError) {
      console.error("[track] unsubscribe event insert failed: %s", eventError.message);
      return { ok: false };
    }

    if (recipient.contact_id) {
      const { error: contactError } = await supabase
        .from("contacts")
        .update({ is_active: false })
        .eq("id", recipient.contact_id);
      if (contactError) {
        console.error("[track] unsubscribe contact update failed: %s", contactError.message);
        // The event is already recorded — a failed deactivation is reported,
        // not silently discarded, but it does not undo what did succeed.
        return { ok: false };
      }
    }

    return { ok: true, alreadyUnsubscribed: false };
  } catch (cause) {
    console.error("[track] unsubscribe threw", cause);
    return { ok: false };
  }
}
