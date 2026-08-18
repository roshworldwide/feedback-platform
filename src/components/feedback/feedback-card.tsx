"use client";

/**
 * One rating, with the report it belongs to.
 *
 * The campaign chip is not conditional on anything: a rating without its
 * report is the defect that made v1's honest feedback look like corruption, so
 * this card renders the report first and states plainly when the link could not
 * be resolved rather than dropping it.
 *
 * The three triage actions are server actions. Each one reports its own result
 * in place — a failed assignment says so next to the button that failed, and
 * every character the user typed survives it.
 */

import * as React from "react";
import Link from "next/link";
import { Check, MessageSquarePlus, UserPlus } from "lucide-react";
import { Button, Pill, Select, StarRating, TextArea } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { IDLE_TRIAGE, type Sentiment, type TriageState } from "./vocabulary";

export type InboxRow = {
  id: string;
  rating: number;
  comment: string | null;
  sentiment: Sentiment | null;
  createdAt: string | null;
  reviewedAt: string | null;
  /** The person who reviewed it, already resolved to a name. */
  reviewedByName: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  note: string | null;
  author: string;
  campaignId: string | null;
  /** "DL-034 · Monthly quality review". Never empty in practice, never dropped. */
  campaignLabel: string;
  clientName: string | null;
  isTest: boolean;
};

export type Person = { id: string; name: string };

export type TriageAction = (
  state: TriageState,
  formData: FormData,
) => Promise<TriageState>;

export type FeedbackCardProps = {
  row: InboxRow;
  people: Person[];
  markReviewed: TriageAction;
  assign: TriageAction;
  addNote: TriageAction;
};

const SENTIMENT_TONE = {
  positive: "nominal",
  neutral: "neutral",
  critical: "abort",
} as const;

const SENTIMENT_LABEL = {
  positive: "Positive",
  neutral: "Neutral",
  critical: "Critical",
} as const;

function Result({ state }: { state: TriageState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className="t-caption"
      style={{
        margin: 0,
        color: state.ok ? "var(--signal-nominal)" : "var(--signal-abort)",
      }}
    >
      {state.message}
    </p>
  );
}

export function FeedbackCard({
  row,
  people,
  markReviewed,
  assign,
  addNote,
}: FeedbackCardProps) {
  const [reviewState, reviewAction, reviewPending] = React.useActionState(
    markReviewed,
    IDLE_TRIAGE,
  );
  const [assignState, assignAction, assignPending] = React.useActionState(
    assign,
    IDLE_TRIAGE,
  );
  const [noteState, noteAction, notePending] = React.useActionState(
    addNote,
    IDLE_TRIAGE,
  );
  const [noteOpen, setNoteOpen] = React.useState(false);
  const noteFieldId = React.useId();

  const reviewed = row.reviewedAt !== null;

  return (
    <li
      className="flex flex-col"
      style={{
        gap: "var(--space-4)",
        padding: "var(--space-5)",
        background: "var(--surface-raised)",
        border: "1px solid var(--stroke-rim)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--e1)",
      }}
    >
      {/* ── The report, always ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center" style={{ gap: "var(--space-2)" }}>
        {row.campaignId ? (
          <Link
            href={`/campaigns/${row.campaignId}`}
            className="t-footnote"
            style={{ color: "var(--content-accent)", textDecoration: "none" }}
          >
            {row.campaignLabel || "Untitled report"}
          </Link>
        ) : (
          <Pill tone="caution">Report not resolved</Pill>
        )}
        {row.isTest ? <Pill tone="caution">Test send</Pill> : null}
        {row.clientName ? <Pill tone="neutral">{row.clientName}</Pill> : null}
        <span
          className="t-caption tabular"
          style={{ marginLeft: "auto", color: "var(--content-tertiary)" }}
        >
          {fmtDateTime(row.createdAt)}
        </span>
      </div>

      <div className="flex flex-wrap items-center" style={{ gap: "var(--space-3)" }}>
        <StarRating value={row.rating} size="l" showValue />
        {row.sentiment ? (
          <Pill tone={SENTIMENT_TONE[row.sentiment]} dot>
            {SENTIMENT_LABEL[row.sentiment]}
          </Pill>
        ) : (
          <Pill tone="neutral">Sentiment not set</Pill>
        )}
        {reviewed ? (
          <Pill tone="nominal" dot>
            Reviewed
          </Pill>
        ) : (
          <Pill tone="caution" dot>
            Unreviewed
          </Pill>
        )}
      </div>

      {row.comment ? (
        <blockquote
          className="t-body prose-measure"
          style={{
            margin: 0,
            paddingLeft: "var(--space-4)",
            borderLeft: "2px solid var(--stroke-rim)",
            color: "var(--content-primary)",
          }}
        >
          &ldquo;{row.comment}&rdquo;
        </blockquote>
      ) : (
        <p className="t-subhead" style={{ margin: 0, color: "var(--content-tertiary)" }}>
          Rated without a comment.
        </p>
      )}

      <p className="t-footnote" style={{ margin: 0, color: "var(--content-secondary)" }}>
        {row.author}
        {row.clientName ? ` · ${row.clientName}` : ""}
      </p>

      {row.note ? (
        <p
          className="t-caption prose-measure"
          style={{
            margin: 0,
            padding: "var(--space-3)",
            borderRadius: "calc(var(--radius-lg) - var(--space-3))",
            background: "var(--fill-quiet)",
            color: "var(--content-secondary)",
          }}
        >
          <span style={{ color: "var(--content-tertiary)" }}>Internal note: </span>
          {row.note}
        </p>
      ) : null}

      {reviewed ? (
        <p className="t-caption" style={{ margin: 0, color: "var(--content-tertiary)" }}>
          Reviewed {fmtDateTime(row.reviewedAt)}
          {row.reviewedByName ? ` by ${row.reviewedByName}` : ""}
          {row.assignedToName ? ` · assigned to ${row.assignedToName}` : ""}
        </p>
      ) : row.assignedToName ? (
        <p className="t-caption" style={{ margin: 0, color: "var(--content-tertiary)" }}>
          Assigned to {row.assignedToName}
        </p>
      ) : null}

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-end"
        style={{
          gap: "var(--space-3)",
          paddingTop: "var(--space-3)",
          borderTop: "1px solid var(--stroke-hairline)",
        }}
      >
        <form action={reviewAction}>
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="reviewed" value={reviewed ? "0" : "1"} />
          <Button
            type="submit"
            size="s"
            variant={reviewed ? "plain" : "tinted"}
            leadingIcon={Check}
            loading={reviewPending}
          >
            {reviewed ? "Mark unreviewed" : "Mark reviewed"}
          </Button>
        </form>

        <form
          action={assignAction}
          className="flex items-end"
          style={{ gap: "var(--space-2)" }}
        >
          <input type="hidden" name="id" value={row.id} />
          <Select
            name="assignee"
            aria-label={`Assign this rating of ${row.campaignLabel}`}
            defaultValue={row.assignedTo ?? ""}
            options={[
              { value: "", label: "Nobody" },
              ...people.map((person) => ({ value: person.id, label: person.name })),
            ]}
            style={{ width: "auto", minWidth: "180px" }}
          />
          <Button
            type="submit"
            size="s"
            variant="plain"
            leadingIcon={UserPlus}
            loading={assignPending}
          >
            Assign
          </Button>
        </form>

        <Button
          size="s"
          variant="plain"
          leadingIcon={MessageSquarePlus}
          aria-expanded={noteOpen}
          aria-controls={noteFieldId}
          onClick={() => setNoteOpen((open) => !open)}
        >
          {row.note ? "Edit note" : "Add note"}
        </Button>
      </div>

      {noteOpen ? (
        <form
          id={noteFieldId}
          action={noteAction}
          className="flex flex-col"
          style={{ gap: "var(--space-2)" }}
        >
          <input type="hidden" name="id" value={row.id} />
          <TextArea
            name="note"
            rows={3}
            defaultValue={row.note ?? ""}
            aria-label={`Internal note on the rating of ${row.campaignLabel}`}
            placeholder="What was done about this, and what happens next."
          />
          <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
            <Button type="submit" size="s" variant="tinted" loading={notePending}>
              Save note
            </Button>
            <Button size="s" variant="plain" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <Result state={reviewState} />
      <Result state={assignState} />
      <Result state={noteState} />
    </li>
  );
}
