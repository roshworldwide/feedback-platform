"use client";

/**
 * The client list, as a table or as a grid.
 *
 * Both layouts read the same server page and state the same true total. The
 * grid is not a shorter list — it is the same list, laid out differently, with
 * its own honest footer.
 *
 * An average rating never appears bare: it always carries how many ratings it
 * is the mean of and how many reports those ratings came from.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronLeft, ChevronRight, SearchX, User2 } from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  DataTable,
  EmptyState,
  Pill,
  Select,
  StarRating,
  type Column,
} from "@/components/ui";
import { fmtDate, fmtInt } from "@/lib/utils";
import type { ClientListRow } from "@/lib/queries/clients";
import { HealthPill } from "./health-pill";
import {
  CLIENT_PAGE_SIZES,
  CLIENT_STATUS_LABEL,
  clientQueryString,
  hasActiveClientFilters,
  type ClientFilters,
} from "./vocabulary";

export type ClientsViewProps = {
  rows: ClientListRow[];
  /** The true total for the current filter set, from the server. */
  total: number;
  filters: ClientFilters;
  /**
   * The server's clock at render time. "N days ago" is measured against this
   * rather than against `Date.now()` in the browser, so the figure the server
   * printed and the figure the browser hydrates are the same figure.
   */
  now: number;
};

function lastSendLabel(row: ClientListRow, now: number): string {
  const last = row.health?.lastSentAt ?? null;
  if (!last) return "Never";
  const at = new Date(last).getTime();
  if (Number.isNaN(at)) return "Date not recorded";
  const days = Math.floor((now - at) / 86_400_000);
  if (days <= 0) return `${fmtDate(last)} · today`;
  return `${fmtDate(last)} · ${days} ${days === 1 ? "day" : "days"} ago`;
}

function ratingCaption(row: ClientListRow): string {
  const health = row.health;
  if (!health || health.ratings === 0) return "No ratings yet";
  return `${fmtInt(health.ratings)} ${
    health.ratings === 1 ? "rating" : "ratings"
  } across ${fmtInt(health.campaignsSent)} ${
    health.campaignsSent === 1 ? "report" : "reports"
  }`;
}

export function ClientsView({ rows, total, filters, now }: ClientsViewProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const apply = React.useCallback(
    (patch: Partial<ClientFilters>) => {
      startTransition(() => {
        router.replace(`/clients${clientQueryString(filters, patch)}`, {
          scroll: false,
        });
      });
    },
    [filters, router],
  );

  const empty = (
    <EmptyState
      icon={hasActiveClientFilters(filters) ? SearchX : Building2}
      title={
        hasActiveClientFilters(filters)
          ? "No client matches these filters"
          : "No clients yet"
      }
      description={
        hasActiveClientFilters(filters)
          ? "The filters above match 0 of the client records. Clear one and try again."
          : "Once a client account exists it will appear here with its contacts, its send history and its health."
      }
    />
  );

  const columns: Column<ClientListRow>[] = [
    {
      id: "company",
      header: "Company",
      required: true,
      render: (row) => (
        <span
          className="inline-flex items-center"
          style={{ gap: "var(--space-3)" }}
        >
          <Avatar name={row.name} size={32} />
          <span className="flex flex-col" style={{ gap: "var(--space-1)" }}>
            <span style={{ color: "var(--content-primary)" }}>{row.name}</span>
            <span
              className="t-micro"
              style={{ color: "var(--content-tertiary)" }}
            >
              {CLIENT_STATUS_LABEL[row.status]}
              {row.tags.length > 0 ? ` · ${row.tags.join(", ")}` : ""}
            </span>
          </span>
        </span>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      render: (row) =>
        row.ownerName ? (
          <span style={{ color: "var(--content-secondary)" }}>{row.ownerName}</span>
        ) : (
          <span style={{ color: "var(--content-tertiary)" }}>Unassigned</span>
        ),
    },
    {
      id: "contacts",
      header: "Contacts",
      numeric: true,
      render: (row) =>
        row.health ? (
          <span className="flex flex-col items-end" style={{ gap: "var(--space-1)" }}>
            <span>{fmtInt(row.health.externalContacts)}</span>
            <span className="t-micro" style={{ color: "var(--content-tertiary)" }}>
              {row.health.internalContacts === 0
                ? "no internal"
                : `+${fmtInt(row.health.internalContacts)} internal`}
            </span>
          </span>
        ) : (
          "—"
        ),
    },
    {
      id: "campaigns",
      header: "Reports sent",
      numeric: true,
      render: (row) => (row.health ? fmtInt(row.health.campaignsSent) : "—"),
    },
    {
      id: "lastSend",
      header: "Last send",
      render: (row) => (
        <span
          className="tabular"
          style={{
            color: row.health?.lastSentAt
              ? "var(--content-secondary)"
              : "var(--content-tertiary)",
          }}
        >
          {lastSendLabel(row, now)}
        </span>
      ),
    },
    {
      id: "rating",
      header: "Avg rating",
      render: (row) => (
        <span className="flex flex-col" style={{ gap: "var(--space-1)" }}>
          <StarRating value={row.health?.avgRating ?? null} size="s" showValue />
          <span className="t-micro" style={{ color: "var(--content-tertiary)" }}>
            {ratingCaption(row)}
          </span>
        </span>
      ),
    },
    {
      id: "health",
      header: "Health",
      required: true,
      render: (row) => <HealthPill health={row.health?.health ?? null} />,
    },
  ];

  return (
    <div
      style={{
        opacity: pending ? 0.72 : 1,
        transition: "opacity var(--dur-glide) var(--ease-glide)",
      }}
    >
      {filters.view === "table" ? (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          caption="Clients, with owner, contacts, reports sent, last send, average rating and health."
          total={total}
          page={filters.page}
          onPageChange={(page) => apply({ page })}
          pageSize={filters.pageSize}
          onPageSizeChange={(size) => apply({ pageSize: size, page: 1 })}
          pageSizeOptions={[...CLIENT_PAGE_SIZES]}
          onRowClick={(row) => router.push(`/clients/${row.slug}`)}
          emptyState={empty}
        />
      ) : (
        <ClientGrid
          rows={rows}
          total={total}
          filters={filters}
          apply={apply}
          empty={empty}
          ratingCaption={ratingCaption}
          lastSendLabel={(row) => lastSendLabel(row, now)}
        />
      )}
    </div>
  );
}

/* ── Grid ─────────────────────────────────────────────────────────────────── */

function ClientGrid({
  rows,
  total,
  filters,
  apply,
  empty,
  ratingCaption: caption,
  lastSendLabel: lastSend,
}: {
  rows: ClientListRow[];
  total: number;
  filters: ClientFilters;
  apply: (patch: Partial<ClientFilters>) => void;
  empty: React.ReactNode;
  ratingCaption: (row: ClientListRow) => string;
  lastSendLabel: (row: ClientListRow) => string;
}) {
  const sizeSelectId = React.useId();
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
  const page = Math.min(Math.max(1, filters.page), pageCount);
  const first = total === 0 ? 0 : (page - 1) * filters.pageSize + 1;
  const last = total === 0 ? 0 : first + rows.length - 1;

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      {rows.length === 0 ? (
        <Card>{empty}</Card>
      ) : (
        <ul
          className="grid"
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            gap: "var(--space-4)",
            gridTemplateColumns: "repeat(auto-fill, minmax(288px, 1fr))",
          }}
        >
          {rows.map((row) => (
            <li key={row.id} style={{ display: "flex" }}>
              <Card style={{ flex: "1 1 auto", padding: "var(--space-5)" }}>
                <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
                  <div className="flex items-start" style={{ gap: "var(--space-3)" }}>
                    <Avatar name={row.name} size={40} />
                    <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                      <Link
                        href={`/clients/${row.slug}`}
                        className="t-headline"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          minHeight: "44px",
                          color: "var(--content-primary)",
                          textDecoration: "none",
                        }}
                      >
                        {row.name}
                      </Link>
                      <p
                        className="t-caption"
                        style={{ margin: 0, color: "var(--content-tertiary)" }}
                      >
                        {row.ownerName
                          ? `Owned by ${row.ownerName}`
                          : "No owner assigned"}
                      </p>
                      {row.primaryContactName ? (
                        <p
                          className="t-caption flex items-center"
                          style={{ margin: 0, gap: "var(--space-1)", color: "var(--content-tertiary)" }}
                        >
                          <User2 size={11} strokeWidth={1.75} aria-hidden="true" />
                          {row.primaryContactName}
                          {row.health ? ` · ${fmtInt(row.health.campaignsSent)} reports` : ""}
                        </p>
                      ) : null}
                    </div>
                    <HealthPill health={row.health?.health ?? null} />
                  </div>

                  <dl
                    className="grid"
                    style={{
                      margin: 0,
                      gap: "var(--space-3)",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    }}
                  >
                    <GridFact label="Contacts">
                      {row.health
                        ? `${fmtInt(row.health.externalContacts)}${
                            row.health.internalContacts > 0
                              ? ` (+${fmtInt(row.health.internalContacts)} internal)`
                              : ""
                          }`
                        : "—"}
                    </GridFact>
                    <GridFact label="Reports sent">
                      {row.health ? fmtInt(row.health.campaignsSent) : "—"}
                    </GridFact>
                    <GridFact label="Last send">{lastSend(row)}</GridFact>
                    <GridFact label="Status">
                      {CLIENT_STATUS_LABEL[row.status]}
                    </GridFact>
                  </dl>

                  <div className="flex flex-col" style={{ gap: "var(--space-1)" }}>
                    <StarRating
                      value={row.health?.avgRating ?? null}
                      size="s"
                      showValue
                    />
                    <span
                      className="t-micro"
                      style={{ color: "var(--content-tertiary)" }}
                    >
                      {caption(row)}
                    </span>
                  </div>

                  {row.tags.length > 0 ? (
                    <div className="flex flex-wrap" style={{ gap: "var(--space-2)" }}>
                      {row.tags.map((tag) => (
                        <Pill key={tag}>{tag}</Pill>
                      ))}
                    </div>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* The grid states the true total too — a card wall is still a list. */}
      <div
        className="flex flex-wrap items-center justify-between"
        style={{ gap: "var(--space-3)" }}
      >
        <p
          className="t-footnote tabular"
          aria-live="polite"
          style={{ margin: 0, color: "var(--content-secondary)" }}
        >
          Showing {first}–{last} of {total}
        </p>

        <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
          <label
            className="t-footnote"
            htmlFor={sizeSelectId}
            style={{ color: "var(--content-secondary)" }}
          >
            Cards
          </label>
          <Select
            id={sizeSelectId}
            aria-label="Cards per page"
            value={String(filters.pageSize)}
            onChange={(event) =>
              apply({ pageSize: Number(event.currentTarget.value), page: 1 })
            }
            options={CLIENT_PAGE_SIZES.map((option) => ({
              value: String(option),
              label: String(option),
            }))}
            style={{ width: "auto", minWidth: "96px" }}
          />
          <div className="flex items-center" style={{ gap: "var(--space-1)" }}>
            <Button
              size="s"
              variant="plain"
              leadingIcon={ChevronLeft}
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => apply({ page: page - 1 })}
            />
            <span
              className="t-footnote tabular"
              style={{ color: "var(--content-secondary)" }}
            >
              Page {page} of {pageCount}
            </span>
            <Button
              size="s"
              variant="plain"
              leadingIcon={ChevronRight}
              aria-label="Next page"
              disabled={page >= pageCount}
              onClick={() => apply({ page: page + 1 })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function GridFact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-1)" }}>
      <dt className="t-overline" style={{ color: "var(--content-secondary)" }}>
        {label}
      </dt>
      <dd
        className="t-footnote tabular"
        style={{ margin: 0, color: "var(--content-primary)" }}
      >
        {children}
      </dd>
    </div>
  );
}
