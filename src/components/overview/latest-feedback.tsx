/**
 * The three most recent ratings, as quotations.
 *
 * A rating is never rendered without the campaign it belongs to. In v1 the
 * ratings were real and the reports they belonged to were unknowable, which
 * made honest data look like corruption; here the report is the first line of
 * every card, and there is no code path that omits it.
 */

import Link from "next/link";
import { MessageSquareQuote } from "lucide-react";
import { EmptyState, Pill, StarRating } from "@/components/ui";
import type { FeedbackRow } from "@/app/(app)/overview/data";
import { fmtDateTime } from "@/lib/utils";

export type LatestFeedbackProps = {
  rows: FeedbackRow[];
  clientNames: Record<string, string>;
};

export function LatestFeedback({ rows, clientNames }: LatestFeedbackProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquareQuote size={22} strokeWidth={1.5} />}
        title="No ratings in this period"
        description="Nobody has rated a report sent in this window yet. Ratings appear here the moment one arrives."
      />
    );
  }

  return (
    <ul
      className="grid"
      style={{
        gap: "var(--space-3)",
        margin: 0,
        padding: 0,
        listStyle: "none",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
      }}
    >
      {rows.map((row) => {
        const clientName = row.clientId ? clientNames[row.clientId] : undefined;
        return (
          <li
            key={row.id}
            className="flex flex-col"
            style={{
              gap: "var(--space-3)",
              padding: "var(--space-4)",
              borderRadius: "calc(var(--radius-lg) - var(--space-3))",
              background: "var(--fill-quiet)",
              border: "1px solid var(--stroke-hairline)",
            }}
          >
            {/* The campaign, first and unconditionally. */}
            {row.campaignId ? (
              <Link
                href={`/campaigns/${row.campaignId}`}
                className="t-footnote"
                style={{ color: "var(--content-accent)", textDecoration: "none" }}
              >
                {row.campaignLabel || "Untitled report"}
              </Link>
            ) : (
              <span
                className="t-footnote"
                style={{ color: "var(--content-secondary)" }}
              >
                {row.campaignLabel || "Report not resolved"}
              </span>
            )}

            <StarRating value={row.rating} size="m" showValue />

            {row.comment ? (
              <blockquote
                className="t-body prose-measure"
                style={{
                  margin: 0,
                  paddingLeft: "var(--space-3)",
                  borderLeft: "2px solid var(--stroke-rim)",
                  color: "var(--content-primary)",
                }}
              >
                &ldquo;{row.comment}&rdquo;
              </blockquote>
            ) : (
              <p
                className="t-subhead"
                style={{ margin: 0, color: "var(--content-tertiary)" }}
              >
                Rated without a comment.
              </p>
            )}

            <div
              className="flex flex-wrap items-center"
              style={{ gap: "var(--space-2)", marginTop: "auto" }}
            >
              <span
                className="t-caption"
                style={{ color: "var(--content-secondary)" }}
              >
                {row.author}
              </span>
              {row.clientId ? (
                <Pill tone="neutral">{clientName ?? "Client not resolved"}</Pill>
              ) : null}
              <span
                className="t-caption tabular"
                style={{ color: "var(--content-tertiary)", marginLeft: "auto" }}
              >
                {fmtDateTime(row.createdAt)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
