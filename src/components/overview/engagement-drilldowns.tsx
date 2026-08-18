"use client";

/**
 * Who opened / who clicked / report ratings.
 *
 * "Who opened" is read straight from `recipient_engagement.opened` — a
 * set-membership flag, never opens + clicks — so a nine-time clicker still
 * appears exactly once. Every row carries the campaign it belongs to; v1
 * hardcoded that column to "—", which is what made two legitimate same-day
 * ratings on different reports look like one contradictory duplicate.
 *
 * Panel open/closed state lives in the URL so a refresh doesn't collapse it.
 */

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Avatar, EmptyState, Pill, StarRating } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import type { EngagementDetail, EngagementPersonRow } from "@/app/(app)/overview/data";
import { DRILLDOWN_KEYS, type DrilldownKey } from "@/app/(app)/overview/activity-vocabulary";

export type EngagementDrilldownsProps = {
  detail: EngagementDetail;
  initialOpen: DrilldownKey[];
};

function Row({ row, showRating }: { row: EngagementPersonRow; showRating: boolean }) {
  return (
    <li
      className="flex items-start"
      style={{
        gap: "var(--space-3)",
        padding: "var(--space-3) 0",
        borderTop: "1px solid var(--stroke-hairline)",
      }}
    >
      <Avatar name={row.fullName || row.email} size={32} />
      <div className="flex flex-col" style={{ flex: 1, gap: "var(--space-1)" }}>
        <div className="flex flex-wrap items-center" style={{ gap: "var(--space-2)" }}>
          <span className="t-subhead" style={{ color: "var(--content-primary)" }}>
            {row.fullName || row.email}
          </span>
          <Pill tone={row.isInternal ? "accent" : "neutral"}>
            {row.isInternal ? "Internal" : "Client"}
          </Pill>
        </div>
        <span className="t-footnote" style={{ color: "var(--content-tertiary)" }}>
          {row.email}
        </span>
        <div className="flex flex-wrap items-center" style={{ gap: "var(--space-2)" }}>
          <Link
            href={`/campaigns/${row.campaignId}`}
            className="t-footnote"
            style={{ color: "var(--signal-link)", textDecoration: "none" }}
          >
            {row.campaignLabel}
          </Link>
          <span className="t-footnote tabular" style={{ color: "var(--content-tertiary)" }}>
            {row.occurredAt ? fmtDateTime(row.occurredAt) : "—"}
          </span>
        </div>
        {showRating ? (
          <div className="flex flex-col" style={{ gap: "var(--space-1)", marginTop: "var(--space-1)" }}>
            <StarRating value={row.rating} size="s" showValue />
            {row.comment ? (
              <p className="t-footnote prose-measure" style={{ margin: 0, color: "var(--content-secondary)" }}>
                “{row.comment}”
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function Section({
  panelKey,
  label,
  rows,
  total,
  showRating,
  open,
  onToggle,
}: {
  panelKey: DrilldownKey;
  label: string;
  rows: EngagementPersonRow[];
  total: number;
  showRating: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const contentId = `drilldown-${panelKey}`;
  return (
    <div
      style={{
        border: "1px solid var(--stroke-hairline)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={onToggle}
        className="flex items-center justify-between t-headline"
        style={{
          width: "100%",
          minHeight: "44px",
          padding: "var(--space-4)",
          background: "var(--surface-raised)",
          border: "none",
          color: "var(--content-primary)",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {label}
        <ChevronDown
          size={18}
          strokeWidth={1.75}
          aria-hidden="true"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform var(--dur-standard) var(--ease-standard)",
            color: "var(--content-tertiary)",
          }}
        />
      </button>

      {open ? (
        <div id={contentId} style={{ padding: "0 var(--space-4) var(--space-4)" }}>
          {rows.length === 0 ? (
            <EmptyState
              icon={<ChevronDown size={22} strokeWidth={1.5} />}
              title="Nothing here yet"
              description="Nothing has happened for this group in the selected period."
            />
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {rows.map((row) => (
                <Row key={row.recipientId} row={row} showRating={showRating} />
              ))}
            </ul>
          )}
          {total > rows.length ? (
            <p
              className="t-caption"
              style={{ margin: "var(--space-3) 0 0", color: "var(--content-tertiary)" }}
            >
              Showing the most recent {rows.length} of {total}. Narrow the period to see
              the rest.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function EngagementDrilldowns({ detail, initialOpen }: EngagementDrilldownsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState<Set<DrilldownKey>>(new Set(initialOpen));

  function toggle(key: DrilldownKey) {
    const next = new Set(open);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpen(next);

    const ordered = DRILLDOWN_KEYS.filter((candidate) => next.has(candidate));
    const params = new URLSearchParams(searchParams.toString());
    if (ordered.length > 0) params.set("panels", ordered.join(","));
    else params.delete("panels");
    const qs = params.toString();
    router.replace(qs ? `/overview?${qs}` : "/overview", { scroll: false });
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
      <Section
        panelKey="opened"
        label={`Who opened (${detail.opened.total})`}
        rows={detail.opened.rows}
        total={detail.opened.total}
        showRating={false}
        open={open.has("opened")}
        onToggle={() => toggle("opened")}
      />
      <Section
        panelKey="clicked"
        label={`Who clicked (${detail.clicked.total})`}
        rows={detail.clicked.rows}
        total={detail.clicked.total}
        showRating={false}
        open={open.has("clicked")}
        onToggle={() => toggle("clicked")}
      />
      <Section
        panelKey="ratings"
        label={`Report ratings (${detail.ratings.total})`}
        rows={detail.ratings.rows}
        total={detail.ratings.total}
        showRating
        open={open.has("ratings")}
        onToggle={() => toggle("ratings")}
      />
    </div>
  );
}
