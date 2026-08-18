/**
 * The last five reports, each with the figures that matter at a glance.
 *
 * Delivered and attempted are distinct numbers and are labelled as such.
 * A rating never appears without the report it belongs to — here the report is
 * the card itself.
 */

import Link from "next/link";
import { Send } from "lucide-react";
import { EmptyState, Pill, StarRating } from "@/components/ui";
import type { CampaignRow } from "@/app/(app)/overview/data";
import { fmtDate, fmtInt, fmtPct, pct } from "@/lib/utils";

export type RecentCampaignsProps = {
  rows: CampaignRow[];
  clientNames: Record<string, string>;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col" style={{ gap: "2px", minWidth: 0 }}>
      <span className="t-overline" style={{ color: "var(--content-tertiary)" }}>
        {label}
      </span>
      <span
        className="t-subhead tabular"
        style={{ color: "var(--content-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}

export function RecentCampaigns({ rows, clientNames }: RecentCampaignsProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Send size={22} strokeWidth={1.5} />}
        title="No reports were sent in this period"
        description="Widen the period, or write the next report from Compose."
        action={{ label: "Write a report", href: "/compose" }}
      />
    );
  }

  return (
    <ul
      className="flex flex-col"
      style={{ gap: "var(--space-3)", margin: 0, padding: 0, listStyle: "none" }}
    >
      {rows.map((row) => {
        const openRate = pct(row.uniqueOpens, row.delivered);
        const clientName = row.clientId ? clientNames[row.clientId] : undefined;
        return (
          <li
            key={row.campaignId}
            className="flex flex-col"
            style={{
              gap: "var(--space-3)",
              padding: "var(--space-4)",
              // Concentric inside the card body.
              borderRadius: "calc(var(--radius-lg) - var(--space-3))",
              background: "var(--fill-quiet)",
              border: "1px solid var(--stroke-hairline)",
            }}
          >
            <div
              className="flex flex-wrap items-center"
              style={{ gap: "var(--space-3)" }}
            >
              {row.reportNumber ? (
                <Pill tone="neutral">{row.reportNumber}</Pill>
              ) : null}
              <Link
                href={`/campaigns/${row.campaignId}`}
                className="t-headline"
                style={{
                  color: "var(--content-primary)",
                  textDecoration: "none",
                  flex: "1 1 240px",
                  minWidth: 0,
                }}
              >
                {row.title || "Untitled report"}
              </Link>
              {row.clientId ? (
                <Pill tone="neutral">{clientName ?? "Client not resolved"}</Pill>
              ) : null}
              <span
                className="t-caption tabular"
                style={{ color: "var(--content-tertiary)", whiteSpace: "nowrap" }}
              >
                {fmtDate(row.sentAt)}
              </span>
            </div>

            <div
              className="flex flex-wrap"
              style={{ gap: "var(--space-6)", rowGap: "var(--space-3)" }}
            >
              <Stat label="Delivered" value={fmtInt(row.delivered)} />
              <Stat label="Attempted" value={fmtInt(row.recipientsExternal)} />
              <Stat
                label="Opened"
                value={`${fmtInt(row.uniqueOpens)} · ${fmtPct(openRate)}`}
              />
              <Stat label="Clicked" value={fmtInt(row.uniqueClicks)} />
              <Stat label="Ratings" value={fmtInt(row.ratings)} />
              <div className="flex flex-col" style={{ gap: "2px" }}>
                <span
                  className="t-overline"
                  style={{ color: "var(--content-tertiary)" }}
                >
                  Average rating
                </span>
                <StarRating value={row.avgRating} size="s" showValue />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
