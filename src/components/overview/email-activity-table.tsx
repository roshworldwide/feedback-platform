"use client";

/**
 * The Email Activity table.
 *
 * v1's version of this table capped at 40 rows against a total of 160 and
 * labelled the cap as if it were the count. Paging and sorting here are
 * server operations expressed in the URL, exactly like the Campaigns table —
 * the footer states the true total, never the size of the current page.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MailX } from "lucide-react";
import {
  DataTable,
  EmptyState,
  Pill,
  Segmented,
  StarRating,
  type Column,
  type SegmentedOption,
  type SortState,
} from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import type {
  EmailActivityEngagement,
  EmailActivityQuery,
  EmailActivityRow,
  EmailActivitySortId,
} from "@/app/(app)/overview/data";
import { DEFAULT_EMAIL_ACTIVITY_PAGE_SIZE, EMAIL_ACTIVITY_PAGE_SIZES } from "@/app/(app)/overview/data";

export type EmailActivityTableProps = {
  rows: EmailActivityRow[];
  total: number;
  query: EmailActivityQuery;
};

const ENGAGEMENT_OPTIONS: readonly SegmentedOption<EmailActivityEngagement>[] = [
  { value: "all", label: "All" },
  { value: "responded", label: "Responded only" },
  { value: "not_opened", label: "Not opened" },
];

function isSortId(value: string): value is EmailActivitySortId {
  return value === "sent_at" || value === "rating";
}

export function EmailActivityTable({ rows, total, query }: EmailActivityTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const apply = React.useCallback(
    (patch: Partial<EmailActivityQuery>) => {
      const next: EmailActivityQuery = {
        ...query,
        ...patch,
        page: patch.page ?? (Object.keys(patch).length > 0 ? 1 : query.page),
      };
      const params = new URLSearchParams(searchParams.toString());

      if (next.page > 1) params.set("activityPage", String(next.page));
      else params.delete("activityPage");

      if (next.pageSize !== DEFAULT_EMAIL_ACTIVITY_PAGE_SIZE)
        params.set("activitySize", String(next.pageSize));
      else params.delete("activitySize");

      if (next.sortId !== "sent_at") params.set("activitySort", next.sortId);
      else params.delete("activitySort");

      if (next.sortAsc) params.set("activityDir", "asc");
      else params.delete("activityDir");

      if (next.engagement !== "all") params.set("activityFilter", next.engagement);
      else params.delete("activityFilter");

      startTransition(() => {
        const qs = params.toString();
        router.replace(qs ? `/overview?${qs}` : "/overview", { scroll: false });
      });
    },
    [query, router, searchParams],
  );

  const sort: SortState = { id: query.sortId, direction: query.sortAsc ? "asc" : "desc" };

  const columns: Column<EmailActivityRow>[] = [
    {
      id: "recipient",
      header: "Recipient",
      required: true,
      render: (row) => (
        <span className="flex flex-col">
          <span style={{ color: "var(--content-primary)" }}>
            {row.fullName || row.email}
          </span>
          {row.fullName ? (
            <span className="t-footnote" style={{ color: "var(--content-tertiary)" }}>
              {row.email}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "campaign",
      header: "Campaign",
      render: (row) => (
        <Link
          href={`/campaigns/${row.campaignId}`}
          onClick={(event) => event.stopPropagation()}
          className="t-subhead"
          style={{ color: "var(--signal-link)", textDecoration: "none" }}
        >
          {row.campaignLabel}
        </Link>
      ),
    },
    {
      id: "internal",
      header: "Audience",
      render: (row) => (
        <Pill tone={row.isInternal ? "accent" : "neutral"}>
          {row.isInternal ? "Internal" : "Client"}
        </Pill>
      ),
    },
    {
      id: "delivered",
      header: "Delivered",
      render: (row) => (row.delivered ? "Yes" : "No"),
    },
    {
      id: "opened",
      header: "Opened",
      render: (row) => (row.opened ? "Yes" : "No"),
    },
    {
      id: "clicked",
      header: "Clicked",
      render: (row) => (row.clicked ? "Yes" : "No"),
    },
    {
      id: "responded",
      header: "Responded",
      render: (row) => (row.responded ? "Yes" : "No"),
    },
    {
      id: "rating",
      header: "Score",
      render: (row) => <StarRating value={row.rating} size="s" showValue />,
    },
    {
      id: "sent_at",
      header: "Date",
      render: (row) => (
        <span className="tabular" style={{ color: "var(--content-secondary)" }}>
          {row.sentAt ? fmtDateTime(row.sentAt) : "—"}
        </span>
      ),
    },
  ];

  return (
    <div
      className="flex flex-col"
      style={{
        gap: "var(--space-4)",
        opacity: pending ? 0.72 : 1,
        transition: "opacity var(--dur-glide) var(--ease-glide)",
      }}
    >
      <Segmented
        options={ENGAGEMENT_OPTIONS}
        value={query.engagement}
        label="Filter by engagement"
        onValueChange={(value) => apply({ engagement: value })}
      />

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.recipientId}
        caption="Per-recipient email activity for the selected period."
        total={total}
        page={query.page}
        onPageChange={(page) => apply({ page })}
        pageSize={query.pageSize}
        onPageSizeChange={(size) => apply({ pageSize: size, page: 1 })}
        pageSizeOptions={[...EMAIL_ACTIVITY_PAGE_SIZES]}
        sort={sort}
        onSortChange={(next) =>
          apply(
            next && isSortId(next.id)
              ? { sortId: next.id, sortAsc: next.direction === "asc", page: 1 }
              : { sortId: "sent_at", sortAsc: false, page: 1 },
          )
        }
        emptyState={
          <EmptyState
            icon={<MailX size={22} strokeWidth={1.5} />}
            title={
              query.engagement === "all"
                ? "No email activity in this period"
                : "No rows match this filter"
            }
            description={
              query.engagement === "all"
                ? "Nothing was sent in this window yet."
                : "Widen the period, or switch back to All."
            }
          />
        }
      />
    </div>
  );
}
