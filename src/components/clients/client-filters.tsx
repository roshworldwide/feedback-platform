"use client";

/**
 * The client filter bar.
 *
 * Every control writes to the URL and the server re-queries, so a filtered
 * view is a shareable address and the total beneath it is the true total for
 * that filter. The current state arrives as a prop rather than from
 * `useSearchParams`, which keeps the server the single source of truth.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { FilterX } from "lucide-react";
import {
  Button,
  Field,
  SearchInput,
  Segmented,
  Select,
  type SelectOption,
} from "@/components/ui";
import {
  CLIENT_STATUSES,
  CLIENT_STATUS_LABEL,
  HEALTH_LABEL,
  HEALTH_RULE,
  HEALTH_VALUES,
  clientQueryString,
  hasActiveClientFilters,
  type ClientFilters,
  type ClientView,
} from "./vocabulary";

const ANY = "";

export type ClientFiltersBarProps = {
  filters: ClientFilters;
  /** Every tag in use across all clients. Null when the read failed. */
  tags: string[] | null;
  tagsReason?: string | null;
};

export function ClientFiltersBar({
  filters,
  tags,
  tagsReason,
}: ClientFiltersBarProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [query, setQuery] = React.useState(filters.q);
  const [urlQuery, setUrlQuery] = React.useState(filters.q);

  // The URL stays the source of truth; the box follows it when it changes.
  // Adjusted during render rather than in an effect, so the corrected value is
  // the one that paints — no flash of the stale term.
  if (urlQuery !== filters.q) {
    setUrlQuery(filters.q);
    setQuery(filters.q);
  }

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

  React.useEffect(() => {
    if (query.trim() === filters.q) return;
    const timer = window.setTimeout(() => apply({ q: query.trim() }), 320);
    return () => window.clearTimeout(timer);
  }, [query, filters.q, apply]);

  const statusOptions: SelectOption[] = [
    { value: ANY, label: "Any status" },
    ...CLIENT_STATUSES.map((status) => ({
      value: status,
      label: CLIENT_STATUS_LABEL[status],
    })),
  ];

  const healthOptions: SelectOption[] = [
    { value: ANY, label: "Any health" },
    ...HEALTH_VALUES.map((health) => ({
      value: health,
      label: HEALTH_LABEL[health],
    })),
  ];

  const tagOptions: SelectOption[] = [
    { value: ANY, label: "All tags" },
    ...(tags ?? []).map((tag) => ({ value: tag, label: tag })),
  ];

  const active = hasActiveClientFilters(filters);

  return (
    <section
      aria-label="Filter clients"
      className="flex flex-col"
      style={{
        gap: "var(--space-4)",
        padding: "var(--space-5)",
        background: "var(--surface-raised)",
        border: "1px solid var(--stroke-rim)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--e1)",
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
        <Field label="Search" hint="Company name or slug">
          <SearchInput
            value={query}
            placeholder="Acme, northwind-logistics…"
            aria-label="Search clients by name or slug"
            onSearch={setQuery}
          />
        </Field>

        <Field label="Status">
          <Select
            options={statusOptions}
            value={filters.status ?? ANY}
            aria-label="Filter by client status"
            onChange={(event) =>
              apply({
                status: (event.currentTarget.value as ClientFilters["status"]) || null,
              })
            }
          />
        </Field>

        <Field label="Tag">
          <Select
            options={tagOptions}
            value={filters.tag ?? ANY}
            aria-label="Filter by tag"
            onChange={(event) => apply({ tag: event.currentTarget.value || null })}
          />
        </Field>

        <Field label="Health" hint={HEALTH_RULE}>
          <Select
            options={healthOptions}
            value={filters.health ?? ANY}
            aria-label="Filter by account health"
            onChange={(event) =>
              apply({
                health: (event.currentTarget.value as ClientFilters["health"]) || null,
              })
            }
          />
        </Field>
      </div>

      <div
        className="flex flex-wrap items-center justify-between"
        style={{ gap: "var(--space-4)" }}
      >
        <Segmented
          label="How to lay the clients out"
          value={filters.view}
          onValueChange={(view: ClientView) => apply({ view, page: filters.page })}
          options={[
            { value: "table", label: "Table" },
            { value: "grid", label: "Grid" },
          ]}
        />

        <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
          {tagsReason ? (
            <span className="t-footnote" style={{ color: "var(--signal-caution)" }}>
              Tag list unavailable — {tagsReason}
            </span>
          ) : null}
          {active ? (
            <Button
              size="s"
              variant="plain"
              leadingIcon={FilterX}
              onClick={() => router.replace("/clients", { scroll: false })}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
