"use client";

/**
 * The audit log.
 *
 * v1 had one shared "Admin" identity, so every question that began "who
 * changed…" ended in a shrug. Every row here names an actor, an action, the
 * thing it landed on and the moment it happened. The log is written by the
 * service role and can be edited by nobody, including the people reading it.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { DataTable, Field, Pill, SearchInput, Select, type Column } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import type { AuditEntryRow } from "./vocabulary";

export type AuditFilters = { q: string; action: string | null; page: number };

export type AuditPanelProps = {
  rows: AuditEntryRow[];
  total: number;
  pageSize: number;
  filters: AuditFilters;
  /** The actions actually present in the log, so the filter cannot be empty. */
  actions: string[];
  /** Stated when the log itself could not be read. */
  reason?: string | null;
};

function queryString(filters: AuditFilters, patch: Partial<AuditFilters>): string {
  const next = {
    ...filters,
    ...patch,
    page: patch.page ?? (Object.keys(patch).length > 0 ? 1 : filters.page),
  };
  const params = new URLSearchParams();
  params.set("tab", "audit");
  if (next.q) params.set("q", next.q);
  if (next.action) params.set("action", next.action);
  if (next.page > 1) params.set("page", String(next.page));
  return `/settings?${params.toString()}`;
}

export function AuditPanel({
  rows,
  total,
  pageSize,
  filters,
  actions,
  reason,
}: AuditPanelProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState(filters.q);
  const [urlQuery, setUrlQuery] = React.useState(filters.q);
  const [pending, startTransition] = React.useTransition();

  // The URL stays the source of truth; the box follows it when it changes.
  // Adjusted during render rather than in an effect, so the field never shows
  // a term the address bar has already dropped.
  if (urlQuery !== filters.q) {
    setUrlQuery(filters.q);
    setQuery(filters.q);
  }

  const apply = React.useCallback(
    (patch: Partial<AuditFilters>) => {
      startTransition(() => {
        router.replace(queryString(filters, patch), { scroll: false });
      });
    },
    [filters, router],
  );

  React.useEffect(() => {
    if (query.trim() === filters.q) return;
    const timer = window.setTimeout(() => apply({ q: query.trim() }), 320);
    return () => window.clearTimeout(timer);
  }, [query, filters.q, apply]);

  const columns: Column<AuditEntryRow>[] = [
    {
      id: "actor",
      header: "Actor",
      required: true,
      render: (row) => (
        <span style={{ color: "var(--content-primary)" }}>{row.actor}</span>
      ),
    },
    {
      id: "action",
      header: "Action",
      render: (row) => <Pill tone="neutral">{row.action}</Pill>,
    },
    {
      id: "target",
      header: "Target",
      render: (row) => (
        <div className="flex flex-col" style={{ gap: "2px" }}>
          <span className="t-footnote" style={{ color: "var(--content-primary)" }}>
            {row.target}
          </span>
          {row.summary ? (
            <span className="t-caption" style={{ color: "var(--content-tertiary)" }}>
              {row.summary}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "when",
      header: "When",
      render: (row) => <span className="tabular">{fmtDateTime(row.createdAt)}</span>,
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
      <div
        className="grid"
        style={{
          gap: "var(--space-4)",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <Field label="Search" hint="Actor, action or summary.">
          <SearchInput
            value={query}
            aria-label="Search the audit log"
            placeholder="feedback.reviewed, priya@convin.ai…"
            onSearch={setQuery}
          />
        </Field>

        <Field label="Action">
          <Select
            value={filters.action ?? ""}
            aria-label="Filter by action"
            options={[
              { value: "", label: "Every action" },
              ...actions.map((action) => ({ value: action, label: action })),
            ]}
            onChange={(event) => apply({ action: event.currentTarget.value || null })}
          />
        </Field>
      </div>

      {reason ? (
        <p className="t-footnote" style={{ margin: 0, color: "var(--signal-caution)" }}>
          The log could not be read — {reason}. Only admins and team leads may
          read it.
        </p>
      ) : null}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => String(row.id)}
        caption="Who did what, to which record, and when"
        total={total}
        page={filters.page}
        pageSize={pageSize}
        pageSizeOptions={[pageSize]}
        onPageChange={(page) => apply({ page })}
        columnToggle={false}
      />
    </div>
  );
}
