"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import {
  parseRating,
  recordComment,
  recordRating,
  resolveRecipient,
} from "@/lib/email/tracking";

/**
 * The public form's only server entry point.
 *
 * There is no session here, so the token IS the authorisation: it is 48 hex
 * characters, unique, and scoped to exactly one recipient of exactly one
 * campaign. It can change that recipient's own rating and comment and nothing
 * else in the system.
 */

export type PublicFeedbackState = {
  status: "idle" | "saved" | "error";
  message: string;
  rating: number | null;
  comment: string;
};

export async function submitPublicFeedback(
  _previous: PublicFeedbackState,
  formData: FormData,
): Promise<PublicFeedbackState> {
  // Everything the person typed is preserved on every path out of here.
  const comment = String(formData.get("comment") ?? "");
  const rating = parseRating(formData.get("rating"));
  const token = String(formData.get("token") ?? "");

  if (rating === null) {
    return {
      status: "error",
      message: "Choose a rating from one to five stars, then send.",
      rating: null,
      comment,
    };
  }

  try {
    const recipient = await resolveRecipient(token);
    if (!recipient) {
      return {
        status: "error",
        message:
          "This link is no longer active. Reply to the report email instead — it reaches the same person.",
        rating,
        comment,
      };
    }

    const outcome = await recordRating(recipient, rating);
    if (!outcome.ok) {
      return {
        status: "error",
        message:
          "We could not save that just now — the fault is ours. Your words are still here; try sending again in a moment.",
        rating,
        comment,
      };
    }

    if (comment.trim().length > 0 || recipient.comment) {
      await recordComment(recipient, comment);
    }

    await recordAudit({
      actorEmail: recipient.email,
      action: outcome.created ? "feedback.rated" : "feedback.rating_changed",
      entityType: "feedback",
      entityId: recipient.recipient_id,
      summary: `${recipient.email} rated ${recipient.report_number ?? recipient.campaign_title} ${rating}/5`,
      diff: {
        campaign_id: recipient.campaign_id,
        rating,
        previous_rating: recipient.rating,
        has_comment: comment.trim().length > 0,
      },
    });

    revalidatePath(`/f/${token}`);

    return {
      status: "saved",
      message:
        comment.trim().length > 0
          ? "Thank you — your rating and your comment are with the team."
          : "Thank you — your rating is with the team.",
      rating,
      comment,
    };
  } catch (cause) {
    console.error("[f/token] submit failed", cause);
    return {
      status: "error",
      message:
        "We could not save that just now — the fault is ours. Your words are still here; try sending again in a moment.",
      rating,
      comment,
    };
  }
}
