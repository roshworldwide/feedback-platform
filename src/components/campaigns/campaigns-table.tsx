"use client";

/**
 * The campaign list.
 *
 * Paging and sorting are server operations expressed in the URL — the table
 * asks for a page, the server answers with that page and the TRUE total, and
 * the footer states both. Nothing is narrowed after the count is taken.
 *
 * Every rate here comes from `src/lib/metrics.ts`. Nothing on this screen
 * divides two numbers itself, and "Sent" and "Delivered" are separate columns
 * because they are separate facts.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SearchX } from "lucide-react";
import {
  DataTable,
  EmptyState,
  StarRating,
  type Column,
  type SortState,
} from "@/components/ui";
import { clickRate, uniqueOpenRate } from "@/lib/metrics";
import { fmtDateTime, fmtInt, fmtPct } from "@/lib/utils";
import type { CampaignListRow } from "@/lib/queries/campaigns";
import { StatusPill, TestSendPill } from "./status-pill";
import { periodOf } from "./stats-adapter";
import {
  CAMPAIGN_PAGE_SIZES,
  CAMPAIGN_SORT_COLUMN,
  campaignQueryString,
  hasActiveCampaignFilters,
  type CampaignFilters,
  type CampaignSortId,
} from "./vocabulary";

export type CampaignsTableProps = {
  rows: CampaignListRow[];
  /** The true total for the current filter set, from the server. */
  total: number;
  filters: CampaignFilters;
};

function isSortId(value: string): value is CampaignSortId {
  return value in CAMPAIGN_SORT_COLUMN;
}

export function CampaignsTable({ rows, total, filters }: CampaignsTableProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const apply = React.useCallback(
    (patch: Partial<CampaignFilters>) => {
      startTransition(() => {
        router.replace(`/campaigns${campaignQueryString(filters, patch)}`, {
          scroll: false,
        });
      });
    },
    [filters, router],
  );

  const sort: SortState = {
    id: filters.sortId,
    direction: filters.sortAsc ? "asc" : "desc",
  };

  const columns: Column<CampaignListRow>[] = [
    {
      id: "dl",
      header: "DL #",
      required: true,
      width: "108px",
      render: (row) => (
        <span
          className="t-footnote tabular"
          style={{
            fontFamily: "var(--font-mono)",
            color: row.reportNumber
              ? "var(--content-primary)"
              : "var(--content-tertiary)",
          }}
        >
          {row.reportNumber ?? "—"}
        </span>
      ),
    },
    {
      id: "title",
      header: "Title",
      required: true,
      render: (row) => (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
          }}
        >
          <span style={{ color: "var(--content-primary)" }}>{row.title}</span>
          {row.isTest ? <TestSendPill /> : null}
        </span>
      ),
    },
    {
      id: "client",
      header: "Client",
      render: (row) =>
        row.clientSlug && row.clientName ? (
          <Link
            href={`/clients/${row.clientSlug}`}
            onClick={(event) => event.stopPropagation()}
            className="t-subhead"
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: "44px",
              color: "var(--signal-link)",
              textDecoration: "none",
            }}
          >
            {row.clientName}
          </Link>
        ) : (
          <span style={{ color: "var(--content-tertiary)" }}>—</span>
        ),
    },
    {
      id: "series",
      header: "Series",
      render: (row) => (
        <span
          style={{
            color: row.seriesName
              ? "var(--content-secondary)"
              : "var(--content-tertiary)",
          }}
        >
          {row.seriesName ?? "Not in a series"}
        </span>
      ),
    },
    {
      id: "sent",
      header: "Sent",
      render: (row) => (
        <span
          className="tabular"
          style={{
            color: row.sentAt
              ? "var(--content-secondary)"
              : "var(--content-tertiary)",
          }}
        >
          {row.sentAt ? fmtDateTime(row.sentAt) : "Not sent"}
        </span>
      ),
    },
    {
      id: "recipients",
      header: "Recipients",
      numeric: true,
      render: (row) => fmtInt(row.stats.recipients_external),
    },
    {
      id: "delivered",
      header: "Delivered",
      numeric: true,
      render: (row) => fmtInt(row.stats.delivered),
    },
    {
      id: "open",
      header: "Open %",
      numeric: true,
      render: (row) => fmtPct(uniqueOpenRate(periodOf(row.stats))),
    },
    {
      id: "click",
      header: "Click %",
      numeric: true,
      render: (row) => fmtPct(clickRate(periodOf(row.stats))),
    },
    {
      id: "rating",
      header: "Avg rating",
      // The rating belongs to this row's campaign and is never shown apart
      // from it — the title sits three columns to the left of this figure.
      render: (row) => (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
          }}
        >
          <StarRating value={row.stats.avg_rating} size="s" showValue />
          <span className="t-micro tabular" style={{ color: "var(--content-tertiary)" }}>
            {row.stats.ratings === 1 ? "1 rating" : `${fmtInt(row.stats.ratings)} ratings`}
          </span>
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      required: true,
      render: (row) => <StatusPill status={row.status} />,
    },
  ];

  return (
    <div
      style={{
        opacity: pending ? 0.72 : 1,
        transition: "opacity var(--dur-glide) var(--ease-glide)",
      }}
    >
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Campaigns, with recipients, delivery, engagement and average rating for each."
        total={total}
        page={filters.page}
        onPageChange={(page) => apply({ page })}
        pageSize={filters.pageSize}
        onPageSizeChange={(size) => apply({ pageSize: size, page: 1 })}
        pageSizeOptions={[...CAMPAIGN_PAGE_SIZES]}
        sort={sort}
        onSortChange={(next) =>
          apply(
            next && isSortId(next.id)
              ? { sortId: next.id, sortAsc: next.direction === "asc", page: 1 }
              : { sortId: "sent", sortAsc: false, page: 1 },
          )
        }
        onRowClick={(row) => router.push(`/campaigns/${row.id}`)}
        emptyState={
          <EmptyState
            icon={SearchX}
            title={
              hasActiveCampaignFilters(filters)
                ? "No campaign matches these filters"
                : "No campaigns yet"
            }
            description={
              hasActiveCampaignFilters(filters)
                ? "The filters above match 0 of the campaigns on record. Widen the date range or clear a filter."
                : "Nothing has been written or scheduled yet. The first report will appear here the moment it is saved."
            }
          />
        }
      />
    </div>
  );
}
