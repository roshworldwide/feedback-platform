"use client";

/**
 * The campaign filter bar.
 *
 * Every control writes to the URL and the server re-queries — so a filtered
 * view is a shareable address, the totals under it are the true totals for
 * that filter, and nothing is narrowed client-side behind the count.
 *
 * The current filter state arrives as a prop rather than from
 * `useSearchParams`, which keeps this component out of a Suspense boundary and
 * keeps the server the single source of truth for what is being shown.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { FilterX } from "lucide-react";
import {
  Button,
  Field,
  SearchInput,
  Select,
  Switch,
  type SelectOption,
} from "@/components/ui";
import {
  CAMPAIGN_STATUSES,
  OPENED_LABEL,
  RATING_BANDS,
  STATUS_LABEL,
  campaignQueryString,
  hasActiveCampaignFilters,
  type CampaignFilters,
} from "./vocabulary";

export type CampaignFacetOptions = {
  clients: { id: string; name: string }[];
  series: { id: string; name: string; clientId: string }[];
  templates: string[];
};

export type CampaignFiltersBarProps = {
  filters: CampaignFilters;
  facets: CampaignFacetOptions | null;
  /** Stated when the facet lists themselves could not be read. */
  facetsReason?: string | null;
};

const ANY = "";

export function CampaignFiltersBar({
  filters,
  facets,
  facetsReason,
}: CampaignFiltersBarProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [query, setQuery] = React.useState(filters.q);
  const [urlQuery, setUrlQuery] = React.useState(filters.q);

  // The URL stays the source of truth; the box follows it when it changes.
  // Adjusted during render rather than in an effect, so the corrected value is
  // the one that paints and no stale term is ever shown.
  if (urlQuery !== filters.q) {
    setUrlQuery(filters.q);
    setQuery(filters.q);
  }

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

  React.useEffect(() => {
    if (query.trim() === filters.q) return;
    const timer = window.setTimeout(() => apply({ q: query.trim() }), 320);
    return () => window.clearTimeout(timer);
  }, [query, filters.q, apply]);

  const clientOptions: SelectOption[] = [
    { value: ANY, label: "All clients" },
    ...(facets?.clients ?? []).map((client) => ({
      value: client.id,
      label: client.name,
    })),
  ];

  // A series belongs to a client; showing another client's cadences would be
  // an invitation to build a filter that can never match.
  const seriesOptions: SelectOption[] = [
    { value: ANY, label: "All series" },
    ...(facets?.series ?? [])
      .filter((series) => !filters.clientId || series.clientId === filters.clientId)
      .map((series) => ({ value: series.id, label: series.name })),
  ];

  const templateOptions: SelectOption[] = [
    { value: ANY, label: "All templates" },
    ...(facets?.templates ?? []).map((key) => ({ value: key, label: key })),
  ];

  const statusOptions: SelectOption[] = [
    { value: ANY, label: "Any status" },
    ...CAMPAIGN_STATUSES.map((status) => ({
      value: status,
      label: STATUS_LABEL[status],
    })),
  ];

  const bandOptions: SelectOption[] = [
    { value: ANY, label: "Any rating" },
    ...RATING_BANDS.map((band) => ({ value: band.value, label: band.label })),
  ];

  const openedOptions: SelectOption[] = [
    { value: ANY, label: "Opened or not" },
    { value: "opened", label: OPENED_LABEL.opened },
    { value: "not-opened", label: OPENED_LABEL["not-opened"] },
  ];

  const active = hasActiveCampaignFilters(filters);

  return (
    <section
      aria-label="Filter campaigns"
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
        <Field label="Search" hint="Report title or DL number">
          <SearchInput
            value={query}
            placeholder="DL-034, Monthly quality review…"
            aria-label="Search campaigns by title or DL number"
            onSearch={setQuery}
          />
        </Field>

        <Field label="Client">
          <Select
            options={clientOptions}
            value={filters.clientId ?? ANY}
            aria-label="Filter by client"
            onChange={(event) =>
              apply({
                clientId: event.currentTarget.value || null,
                // A series from the previous client would match nothing.
                seriesId: null,
              })
            }
          />
        </Field>

        <Field label="Series">
          <Select
            options={seriesOptions}
            value={filters.seriesId ?? ANY}
            aria-label="Filter by report series"
            onChange={(event) =>
              apply({ seriesId: event.currentTarget.value || null })
            }
          />
        </Field>

        <Field label="Status">
          <Select
            options={statusOptions}
            value={filters.status ?? ANY}
            aria-label="Filter by status"
            onChange={(event) =>
              apply({
                status:
                  (event.currentTarget.value as CampaignFilters["status"]) || null,
              })
            }
          />
        </Field>

        <Field label="Sent from">
          <input
            type="date"
            value={filters.from ?? ""}
            aria-label="Sent on or after"
            max={filters.to ?? undefined}
            onChange={(event) => apply({ from: event.currentTarget.value || null })}
            className="t-subhead"
            style={{
              width: "100%",
              minHeight: "var(--cap-m-h)",
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-raised)",
              border: "1px solid var(--stroke-rim)",
              color: "var(--content-primary)",
              boxShadow: "var(--e1)",
            }}
          />
        </Field>

        <Field label="Sent to">
          <input
            type="date"
            value={filters.to ?? ""}
            aria-label="Sent on or before"
            min={filters.from ?? undefined}
            onChange={(event) => apply({ to: event.currentTarget.value || null })}
            className="t-subhead"
            style={{
              width: "100%",
              minHeight: "var(--cap-m-h)",
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-raised)",
              border: "1px solid var(--stroke-rim)",
              color: "var(--content-primary)",
              boxShadow: "var(--e1)",
            }}
          />
        </Field>

        <Field label="Template">
          <Select
            options={templateOptions}
            value={filters.templateKey ?? ANY}
            aria-label="Filter by email template"
            onChange={(event) =>
              apply({ templateKey: event.currentTarget.value || null })
            }
          />
        </Field>

        <Field label="Average rating" hint="Across external recipients only">
          <Select
            options={bandOptions}
            value={filters.band ?? ANY}
            aria-label="Filter by average rating band"
            onChange={(event) =>
              apply({ band: (event.currentTarget.value as CampaignFilters["band"]) || null })
            }
          />
        </Field>

        <Field label="Engagement">
          <Select
            options={openedOptions}
            value={filters.opened ?? ANY}
            aria-label="Filter by whether anyone opened"
            onChange={(event) =>
              apply({
                opened: (event.currentTarget.value as CampaignFilters["opened"]) || null,
              })
            }
          />
        </Field>
      </div>

      <div
        className="flex flex-wrap items-center justify-between"
        style={{ gap: "var(--space-4)" }}
      >
        <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
          <Switch
            checked={filters.includeTest}
            label="Include test sends"
            onCheckedChange={(checked) => apply({ includeTest: checked })}
          />
          <span className="t-footnote" style={{ color: "var(--content-secondary)" }}>
            {filters.includeTest
              ? "Test sends are included in this list."
              : "Test sends are excluded from this list."}
          </span>
        </div>

        <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
          {facetsReason ? (
            <span className="t-footnote" style={{ color: "var(--signal-caution)" }}>
              Filter options unavailable — {facetsReason}
            </span>
          ) : null}
          {active ? (
            <Button
              size="s"
              variant="plain"
              leadingIcon={FilterX}
              onClick={() => router.replace("/campaigns", { scroll: false })}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
