import { createAdminClient, isUniqueViolation } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { recordAudit } from "@/lib/audit";
import { svixHeadersFrom, verifySvixSignature } from "@/lib/webhooks/svix";

/**
 * Resend's delivery and bounce webhook.
 *
 * `bounced_at` was previously only ever set when Resend synchronously
 * rejected an address at send time — the normal kind of bounce, the
 * asynchronous kind a receiving server reports minutes later, was never
 * recorded at all. This is what records it.
 *
 * The signature is verified against the RAW body before anything is parsed
 * — an unverified webhook is an open write endpoint into engagement data,
 * and a forged "bounced" event could quietly stop mail to a real client.
 *
 * `delivered` and `bounced` are treated as authoritative for their own claim,
 * not merely a gap-filler: a message marked delivered at send time can still
 * be corrected to bounced by a later async report (delivered_at and
 * bounced_at are mutually exclusive by a table CHECK constraint, so a bounce
 * clears delivered_at rather than being rejected by it). Applying the same
 * event twice changes nothing the second time — see the delivered_at /
 * bounced_at writes below, which set an end state rather than incrementing
 * anything, and the `email_events` insert for "delivered" relies on
 * `email_events_one_delivered_per_recipient` to make a duplicate a no-op.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ResendWebhookPayload = {
  type?: string;
  data?: {
    email_id?: string;
    to?: string[];
    bounce?: { message?: string; type?: string };
    reason?: string;
  };
};

function reasonFrom(payload: ResendWebhookPayload): string {
  return (
    payload.data?.bounce?.message ??
    payload.data?.reason ??
    payload.type ??
    "no reason given by the provider"
  ).slice(0, 400);
}

export async function POST(request: Request): Promise<Response> {
  const secret = serverEnv().RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhooks/resend] RESEND_WEBHOOK_SECRET is not configured — refusing every event");
    return Response.json({ ok: false, error: "webhook not configured" }, { status: 503 });
  }

  const body = await request.text();
  const verification = verifySvixSignature(svixHeadersFrom(request.headers), body, secret);
  if (!verification.ok) {
    console.warn("[webhooks/resend] rejected an unverifiable event: %s", verification.reason);
    return Response.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  let payload: ResendWebhookPayload;
  try {
    payload = JSON.parse(body) as ResendWebhookPayload;
  } catch {
    return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const messageId = payload.data?.email_id;
  const type = payload.type;
  if (!messageId || !type) {
    // A verified but shapeless event — acknowledge it so Resend does not
    // retry forever, but there is nothing to attach it to.
    return Response.json({ ok: true, handled: false });
  }

  const admin = createAdminClient();

  try {
    const { data: recipientRow, error: findError } = await admin
      .from("campaign_recipients")
      .select("id, campaign_id, contact_id, email, bounced_at")
      .eq("provider_message_id", messageId)
      .maybeSingle();

    if (findError) {
      console.error("[webhooks/resend] lookup failed: %s", findError.message);
      return Response.json({ ok: false, error: findError.message }, { status: 500 });
    }
    if (!recipientRow) {
      // A message id this database never sent, or sent before this column
      // existed. Not an error — acknowledge so Resend stops retrying it.
      return Response.json({ ok: true, handled: false, reason: "unknown provider_message_id" });
    }

    const recipient = recipientRow as unknown as {
      id: string;
      campaign_id: string;
      contact_id: string | null;
      email: string;
      bounced_at: string | null;
    };

    switch (type) {
      case "email.delivered": {
        await admin
          .from("campaign_recipients")
          .update({ delivered_at: new Date().toISOString(), bounced_at: null, bounce_reason: null })
          .eq("id", recipient.id);

        const { error: eventError } = await admin.from("email_events").insert({
          recipient_id: recipient.id,
          campaign_id: recipient.campaign_id,
          type: "delivered",
        });
        // A repeat delivered webhook hits the same unique index a repeat
        // pixel load does — the fact is already recorded, so this is a
        // no-op, not a failure.
        if (eventError && !isUniqueViolation(eventError)) {
          console.error("[webhooks/resend] delivered event insert failed: %s", eventError.message);
        }
        break;
      }

      case "email.bounced":
      case "email.complained": {
        const reason =
          type === "email.complained" ? "Marked as spam by the recipient." : reasonFrom(payload);

        // Read-before-write, so a retried or re-delivered webhook — Resend
        // sends both — changes nothing the second time: neither the
        // recipient row nor the audit trail grows on a repeat of a state
        // that's already recorded. `wasAlreadyBounced` alone would miss a
        // "bounced" event that arrives, correctly, before a later
        // "complained" for the same message — that transition still needs
        // to land, so it's tracked separately from whether anything changed.
        const wasAlreadyBounced = recipient.bounced_at !== null;
        let contactWasAlreadyInactive = true;

        if (!wasAlreadyBounced) {
          await admin
            .from("campaign_recipients")
            .update({ delivered_at: null, bounced_at: new Date().toISOString(), bounce_reason: reason })
            .eq("id", recipient.id);
        }

        if (recipient.contact_id) {
          const { data: contactRow } = await admin
            .from("contacts")
            .select("is_active")
            .eq("id", recipient.contact_id)
            .maybeSingle();
          contactWasAlreadyInactive = contactRow
            ? (contactRow as { is_active: boolean }).is_active === false
            : true;

          const contactUpdate: Record<string, unknown> = {};
          if (!wasAlreadyBounced) contactUpdate.bounced_at = new Date().toISOString();
          // A spam complaint is a hard stop, not a warning — the contact is
          // excluded from every future recipient list, the same mechanism
          // an unsubscribe uses (`resolveRecipients` only ever selects
          // active contacts; see src/app/(app)/compose/actions.ts). Checked
          // even when the recipient was already bounced, since "bounced"
          // then "complained" for the same message is a real escalation,
          // not a repeat of the same event.
          if (type === "email.complained" && !contactWasAlreadyInactive) {
            contactUpdate.is_active = false;
          }
          if (Object.keys(contactUpdate).length > 0) {
            await admin.from("contacts").update(contactUpdate).eq("id", recipient.contact_id);
          }
        }

        if (wasAlreadyBounced && (type !== "email.complained" || contactWasAlreadyInactive)) {
          // Nothing changed — this exact outcome was already recorded.
          return Response.json({ ok: true, handled: true, alreadyRecorded: true });
        }

        await recordAudit({
          action: type === "email.complained" ? "recipient.complained" : "recipient.bounced",
          entityType: "campaign_recipients",
          entityId: recipient.id,
          summary: `${recipient.email} — ${reason}`,
          diff: { campaign_id: recipient.campaign_id, contact_id: recipient.contact_id },
        });
        break;
      }

      case "email.delivery_delayed": {
        // No dedicated column for this — it is transient by definition, and
        // `event_type` has no matching enum value to force in a row for. An
        // audit entry is the durable, honest record without widening the
        // schema for a status that resolves itself one way or the other.
        await recordAudit({
          action: "recipient.delivery_delayed",
          entityType: "campaign_recipients",
          entityId: recipient.id,
          summary: `${recipient.email} — delivery delayed by the provider`,
          diff: { campaign_id: recipient.campaign_id },
        });
        break;
      }

      default:
        return Response.json({ ok: true, handled: false, reason: `unrecognised type ${type}` });
    }

    return Response.json({ ok: true, handled: true });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "unknown failure";
    console.error("[webhooks/resend] unhandled: %s", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
