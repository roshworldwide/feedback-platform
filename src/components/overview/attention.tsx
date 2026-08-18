/**
 * Needs attention — the panel that tells a human what to do today.
 *
 * Ranked by the view: critical before warning, newest first. Each row states
 * one thing that has gone wrong, the client it belongs to, and the single link
 * that acts on it. The list never truncates silently — the footer states the
 * true total and the page it is showing.
 */

import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { EmptyState, Pill } from "@/components/ui";
import type { AttentionRow } from "@/app/(app)/overview/data";
import { fmtDateTime } from "@/lib/utils";

export type AttentionListProps = {
  rows: AttentionRow[];
  total: number;
  page: number;
  pageSize: number;
  /** clientId → name, from `client_health`. */
  clientNames: Record<string, string>;
  /** Preserves the period and exclusion state when paging. */
  hrefForPage: (page: number) => string;
};

type Action = { href: string; label: string };

/** Where each kind of problem is actually resolved. */
function actionFor(row: AttentionRow): Action {
  switch (row.kind) {
    case "low_rating":
      return {
        href: row.campaignId
          ? `/feedback?campaign=${row.campaignId}&unreviewed=1`
          : "/feedback?unreviewed=1",
        label: "Review rating",
      };
    case "no_external_open":
      return {
        href: row.campaignId ? `/campaigns/${row.campaignId}` : "/campaigns",
        label: "Open report",
      };
    case "client_idle":
      return { href: "/clients", label: "Open client" };
    case "bounce":
      return {
        href: row.campaignId ? `/campaigns/${row.campaignId}` : "/campaigns",
        label: "Fix address",
      };
    default:
      return { href: "/campaigns", label: "Open" };
  }
}

const SEVERITY_INK = {
  critical: "var(--signal-abort)",
  warning: "var(--signal-caution)",
} as const;

export function AttentionList({
  rows,
  total,
  page,
  pageSize,
  clientNames,
  hrefForPage,
}: AttentionListProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck size={22} strokeWidth={1.5} />}
        title="Nothing needs attention"
        description="No unreviewed low ratings, no report that went unopened, no bounce in the last 30 days."
      />
    );
  }

  const first = (page - 1) * pageSize + 1;
  const last = first + rows.length - 1;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
      <ul
        className="flex flex-col"
        style={{ gap: "var(--space-2)", margin: 0, padding: 0, listStyle: "none" }}
      >
        {rows.map((row) => {
          const action = actionFor(row);
          const clientName = row.clientId ? clientNames[row.clientId] : undefined;
          return (
            <li
              key={row.key}
              className="flex flex-wrap items-center"
              style={{
                gap: "var(--space-3)",
                padding: "var(--space-3) var(--space-4)",
                // Concentric inside the card: the parent radius minus the gap.
                borderRadius: "calc(var(--radius-lg) - var(--space-3))",
                background: "var(--fill-quiet)",
                border: "1px solid var(--stroke-hairline)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "8px",
                  height: "8px",
                  flex: "none",
                  borderRadius: "var(--radius-capsule)",
                  background: SEVERITY_INK[row.severity],
                }}
              />
              <span className="sr-only">
                {row.severity === "critical" ? "Critical:" : "Warning:"}
              </span>

              <span
                className="t-subhead"
                style={{ flex: "1 1 320px", minWidth: 0, color: "var(--content-primary)" }}
              >
                {row.summary}
              </span>

              {row.clientId ? (
                <Pill tone="neutral">{clientName ?? "Client not resolved"}</Pill>
              ) : null}

              <span
                className="t-caption tabular"
                style={{ color: "var(--content-tertiary)", whiteSpace: "nowrap" }}
              >
                {fmtDateTime(row.occurredAt)}
              </span>

              <Link
                href={action.href}
                className="t-footnote inline-flex items-center"
                style={{
                  gap: "var(--space-1)",
                  minHeight: "44px",
                  paddingInline: "var(--space-3)",
                  borderRadius: "var(--radius-capsule)",
                  color: "var(--content-accent)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {action.label}
                <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>

      {/* A list never truncates silently. */}
      <div
        className="flex flex-wrap items-center justify-between"
        style={{ gap: "var(--space-3)" }}
      >
        <p
          className="t-footnote tabular"
          style={{ margin: 0, color: "var(--content-secondary)" }}
        >
          Showing {first}&ndash;{last} of {total}
        </p>
        <div className="flex items-center" style={{ gap: "var(--space-4)" }}>
          {page > 1 ? (
            <Link
              href={hrefForPage(page - 1)}
              className="t-footnote"
              style={{
                color: "var(--content-accent)",
                textDecoration: "none",
                lineHeight: "44px",
              }}
            >
              Previous
            </Link>
          ) : null}
          {page < pageCount ? (
            <Link
              href={hrefForPage(page + 1)}
              className="t-footnote"
              style={{
                color: "var(--content-accent)",
                textDecoration: "none",
                lineHeight: "44px",
              }}
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
