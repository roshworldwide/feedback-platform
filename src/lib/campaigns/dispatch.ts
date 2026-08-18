/**
 * Sending an already-created campaign.
 *
 * `sendCampaignAction` (Compose's "send now") and the scheduled-send cron
 * route both end at the same place: a `campaigns` row with its
 * `campaign_recipients` already written, needing an email in each inbox.
 * This is that shared place, so a scheduled send and an immediate one go
 * through the same renderer and record outcomes the same way — never a
 * second, slightly different send path for "later."
 *
 * KNOWN GAP, deliberate: `campaigns.body_md` is the report body alone.
 * Compose's performance scoreboard and inline images are composed at send
 * time from the in-memory draft and were never persisted onto the campaign
 * row, for an immediate send or a scheduled one — this predates scheduled
 * sends actually firing at all. A scheduled dispatch therefore renders from
 * the body alone; it does not guess at a scoreboard or image list that
 * cannot be read back. Persisting them is a schema change outside this pass.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { renderReportEmail } from "@/lib/email/render";
import { emailProvider, sendEmail } from "@/lib/email/send";
import { toTemplateKey } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { recordAudit } from "@/lib/audit";

const ROLE_TITLE: Record<string, string> = {
  admin: "Head of Client Reporting",
  team_lead: "Client Reporting Lead",
  analyst: "Reporting Analyst",
};

function firstNameOf(fullName: string, email: string): string {
  const trimmed = fullName.trim();
  if (trimmed !== "") return trimmed.split(/\s+/)[0];
  const local = email.split("@")[0] ?? "";
  return local.split(/[._-]/)[0] ?? "";
}

type Row = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function nullableStr(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export type DispatchOutcome =
  | { ok: true; attempted: number; accepted: number; failed: number }
  | { ok: false; reason: string };

/**
 * Sends every recipient of one campaign and marks it `sent` (at least one
 * accepted) or `failed` (none were). Never throws — a bad address or a
 * provider error is a recorded outcome for that one recipient, not a reason
 * to abandon the rest of the run.
 */
export async function dispatchCampaign(
  admin: SupabaseClient,
  campaignId: string,
): Promise<DispatchOutcome> {
  const { data: campaignRow, error: campaignError } = await admin
    .from("campaigns")
    .select(
      "id, client_id, series_id, report_number, title, period_label, subject, body_md, " +
        "template_key, report_url, attachment_name, attachment_url, feedback_enabled, " +
        "feedback_question, feedback_ask_comment, created_by, clients:client_id ( name )",
    )
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError) return { ok: false, reason: campaignError.message };
  if (!campaignRow) return { ok: false, reason: "the campaign no longer exists" };

  const campaign = campaignRow as unknown as Row;
  const clientName = str((campaign.clients as Row | null)?.name) || null;
  if (!clientName) return { ok: false, reason: "the client on this campaign could not be read" };

  const creatorId = nullableStr(campaign.created_by);
  let signature = { name: "Convin Data Labs", title: "Client Reporting", org: "Convin Data Labs", replyTo: null as string | null };
  if (creatorId) {
    const { data: creator } = await admin
      .from("profiles")
      .select("full_name, email, role")
      .eq("id", creatorId)
      .maybeSingle();
    if (creator) {
      const c = creator as unknown as Row;
      signature = {
        name: str(c.full_name) || str(c.email),
        title: ROLE_TITLE[str(c.role)] ?? "Client Reporting",
        org: "Convin Data Labs",
        replyTo: str(c.email) || null,
      };
    }
  }

  const { data: recipientRows, error: recipientError } = await admin
    .from("campaign_recipients")
    .select("id, email, full_name, token")
    .eq("campaign_id", campaignId);

  if (recipientError) return { ok: false, reason: recipientError.message };
  const recipients = (recipientRows ?? []) as unknown as Row[];
  if (recipients.length === 0) return { ok: false, reason: "this campaign has no recipients" };

  let accepted = 0;
  let rejected = 0;

  for (const row of recipients) {
    const email = str(row.email);
    const rendered = renderReportEmail({
      templateKey: toTemplateKey(campaign.template_key),
      appUrl: env.NEXT_PUBLIC_APP_URL,
      token: str(row.token),
      clientName,
      contactFirstName: firstNameOf(str(row.full_name), email),
      reportNumber: nullableStr(campaign.report_number),
      reportTitle: str(campaign.title),
      periodLabel: str(campaign.period_label),
      subject: str(campaign.subject),
      bodyMd: str(campaign.body_md),
      reportUrl: nullableStr(campaign.report_url),
      attachment: campaign.attachment_name
        ? { name: str(campaign.attachment_name), url: nullableStr(campaign.attachment_url) }
        : null,
      feedback: {
        enabled: campaign.feedback_enabled === true,
        question: str(campaign.feedback_question),
        askComment: campaign.feedback_ask_comment === true,
      },
      signature,
      isTest: false,
    });

    const result = await sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: signature.replyTo,
      headers: { ...rendered.headers, "X-CDL-Campaign": campaignId },
    });

    if (result.ok) {
      accepted += 1;
      await admin
        .from("campaign_recipients")
        .update({ delivered_at: new Date().toISOString(), provider_message_id: result.id })
        .eq("id", str(row.id));
      await admin.from("email_events").insert({
        recipient_id: str(row.id),
        campaign_id: campaignId,
        type: "delivered",
      });
    } else {
      rejected += 1;
      await admin
        .from("campaign_recipients")
        .update({ bounced_at: new Date().toISOString(), bounce_reason: result.error.slice(0, 400) })
        .eq("id", str(row.id));
    }
  }

  await recordAudit({
    action: "campaign.sent",
    entityType: "campaigns",
    entityId: campaignId,
    summary: `Sent ${str(campaign.title)} to ${accepted} of ${recipients.length} for ${clientName}`,
    diff: { provider: emailProvider(), attempted: recipients.length, accepted, failed: rejected, via: "cron" },
  });

  return { ok: true, attempted: recipients.length, accepted, failed: rejected };
}
