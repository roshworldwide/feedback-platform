"use client";

import * as React from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Button, Field, StarRatingInput, TextArea } from "@/components/ui";
import { submitPublicFeedback, type PublicFeedbackState } from "./actions";

/**
 * The rating card.
 *
 * The campaign is stated above the stars and stays on screen through every
 * state, because a rating detached from the thing it rated is the exact
 * ambiguity that made v1's honest data look corrupt — nobody could tell what
 * "4 stars" had been about.
 *
 * A person who arrives with `?r=4` has already rated: the stars come up set,
 * the heading thanks them, and the only remaining ask is the optional comment.
 * Changing the rating is always available and always says so.
 */

const COMMENT_LIMIT = 2000;

export type FeedbackPanelProps = {
  token: string;
  reportTitle: string;
  clientName: string;
  reportNumber: string | null;
  periodLabel: string;
  question: string;
  askComment: boolean;
  /** The rating already on file, if any. */
  initialRating: number | null;
  initialComment: string;
  /** True when this render is the one that recorded the rating from the email. */
  justSubmitted: boolean;
};

export function FeedbackPanel({
  token,
  reportTitle,
  clientName,
  reportNumber,
  periodLabel,
  question,
  askComment,
  initialRating,
  initialComment,
  justSubmitted,
}: FeedbackPanelProps) {
  const [state, formAction, pending] = React.useActionState<PublicFeedbackState, FormData>(
    submitPublicFeedback,
    {
      status: "idle",
      message: "",
      rating: initialRating,
      comment: initialComment,
    },
  );

  const [rating, setRating] = React.useState<number | null>(initialRating);
  const [comment, setComment] = React.useState(initialComment);
  const [dirty, setDirty] = React.useState(false);

  // The action is the source of truth once it has answered.
  const effectiveRating = state.status === "saved" ? state.rating : rating;
  const saved = state.status === "saved";
  const acknowledged = saved || justSubmitted || initialRating !== null;

  const heading = !acknowledged
    ? question
    : `Thanks — you rated this report ${"★".repeat(effectiveRating ?? 0)}${"☆".repeat(Math.max(0, 5 - (effectiveRating ?? 0)))}`;

  const subheading = !acknowledged
    ? "Takes 15 seconds."
    : saved
      ? state.message
      : justSubmitted
        ? "That is recorded. If you have 20 more seconds, tell us what would have made it better."
        : "You have already rated this report. You can change your rating below at any time.";

  return (
    <section
      aria-labelledby="feedback-heading"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--stroke-rim)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--e3)",
        overflow: "hidden",
      }}
    >
      {/* The campaign. Never omitted, in any state. */}
      <div
        style={{
          padding: "var(--space-5) var(--space-6)",
          borderBottom: "1px solid var(--stroke-hairline)",
          background: "var(--surface-grouped)",
        }}
      >
        <p
          className="t-overline"
          style={{ margin: 0, color: "var(--content-tertiary)" }}
        >
          Prepared for {clientName}
        </p>
        <h1
          className="t-title-3"
          style={{ margin: "var(--space-1) 0 0", color: "var(--content-primary)" }}
        >
          {reportTitle}
        </h1>
        {(reportNumber || periodLabel) && (
          <p
            className="t-footnote tabular"
            style={{ margin: "var(--space-1) 0 0", color: "var(--content-secondary)" }}
          >
            {[reportNumber, periodLabel].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      <form action={formAction} style={{ padding: "var(--space-6)" }}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="rating" value={effectiveRating ?? ""} />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <h2
            id="feedback-heading"
            className="t-title-3"
            style={{ margin: 0, color: "var(--content-primary)" }}
          >
            {heading}
          </h2>
          <p
            className="t-subhead"
            style={{
              margin: 0,
              color: saved ? "var(--signal-nominal)" : "var(--content-secondary)",
            }}
            aria-live="polite"
          >
            {subheading}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "var(--space-1)",
            margin: "var(--space-5) 0 var(--space-2)",
          }}
        >
          <StarRatingInput
            label={`${question} — ${reportTitle} for ${clientName}`}
            value={effectiveRating}
            onValueChange={(next) => {
              setRating(next);
              setDirty(true);
            }}
          />
          <p
            className="t-caption"
            style={{ margin: 0, color: "var(--content-tertiary)" }}
          >
            {acknowledged
              ? "Tap a different star to change your rating."
              : "1 is not useful, 5 is exactly what I needed."}
          </p>
        </div>

        {askComment ? (
          <div style={{ marginTop: "var(--space-4)" }}>
            <Field
              label="Anything you would change? (optional)"
              hint={`${comment.length} of ${COMMENT_LIMIT} characters`}
              error={state.status === "error" ? state.message : null}
            >
              <TextArea
                name="comment"
                rows={4}
                maxLength={COMMENT_LIMIT}
                value={comment}
                placeholder="The cohort split was useful. The revenue chart needed a comparison to last quarter."
                onChange={(event) => {
                  setComment(event.currentTarget.value);
                  setDirty(true);
                }}
              />
            </Field>
          </div>
        ) : (
          <input type="hidden" name="comment" value="" />
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            marginTop: "var(--space-5)",
            flexWrap: "wrap",
          }}
        >
          <Button
            type="submit"
            variant="metal"
            size="l"
            loading={pending}
            leadingIcon={saved && !dirty ? CheckCircle2 : Send}
            disabled={effectiveRating === null}
          >
            {saved && !dirty ? "Sent" : acknowledged ? "Update my feedback" : "Send feedback"}
          </Button>

          {effectiveRating === null ? (
            <span
              className="t-footnote"
              style={{ color: "var(--content-tertiary)" }}
            >
              Pick a star first.
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
