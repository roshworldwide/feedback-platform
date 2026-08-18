"use client";

/**
 * The filter rail.
 *
 * Every control writes to the URL and the server re-queries, so a filtered
 * inbox is a shareable address and the count under the feed is the true count
 * for that filter — nothing is narrowed client-side behind a total.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { FilterX } from "lucide-react";
import {
  Button,
  Field,
  Pill,
  Select,
  Switch,
  type SelectOption,
} from "@/components/ui";
import {
  RATING_BANDS,
  feedbackExclusionCaption,
  feedbackQueryString,
  hasActiveFeedbackFilters,
  type FeedbackFilters,
} from "./vocabulary";

export type FeedbackFacets = {
  clients: { id: string; name: string }[];
  series: { id: string; name: string; clientId: string }[];
};

export type FeedbackFilterRailProps = {
  filters: FeedbackFilters;
  facets: FeedbackFacets;
  /** Stated when the facet lists themselves could not be read. */
  facetsReason?: string | null;
  /** Names the campaign when the inbox was opened from a single report. */
  campaignLabel?: string | null;
};

const ANY = "";

const dateStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "var(--cap-m-h)",
  padding: "var(--space-3) var(--space-4)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-raised)",
  border: "1px solid var(--stroke-rim)",
  color: "var(--content-primary)",
  boxShadow: "var(--e1)",
};

function SwitchRow({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = React.useId();
  return (
    <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
      <Switch id={id} checked={checked} label={label} onCheckedChange={onCheckedChange} />
      <label
        htmlFor={id}
        className="t-subhead"
        style={{ color: "var(--content-primary)", cursor: "pointer" }}
      >
        {label}
      </label>
    </div>
  );
}

export function FeedbackFilterRail({
  filters,
  facets,
  facetsReason,
  campaignLabel,
}: FeedbackFilterRailProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const apply = React.useCallback(
    (patch: Partial<FeedbackFilters>) => {
      startTransition(() => {
        router.replace(`/feedback${feedbackQueryString(filters, patch)}`, {
          scroll: false,
        });
      });
    },
    [filters, router],
  );

  const bandOptions: SelectOption[] = [
    { value: ANY, label: "Any rating" },
    ...RATING_BANDS.map((band) => ({ value: band.value, label: band.label })),
  ];

  const clientOptions: SelectOption[] = [
    { value: ANY, label: "All clients" },
    ...facets.clients.map((client) => ({ value: client.id, label: client.name })),
  ];

  // A series belongs to a client; offering another client's cadences would be
  // an invitation to build a filter that can never match.
  const seriesOptions: SelectOption[] = [
    { value: ANY, label: "All series" },
    ...facets.series
      .filter((series) => !filters.clientId || series.clientId === filters.clientId)
      .map((series) => ({ value: series.id, label: series.name })),
  ];

  return (
    <aside
      aria-label="Filter feedback"
      className="flex flex-col"
      style={{
        gap: "var(--space-4)",
        padding: "var(--space-5)",
        background: "var(--surface-raised)",
        border: "1px solid var(--stroke-rim)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--e1)",
        alignSelf: "start",
        position: "sticky",
        top: "var(--space-6)",
        opacity: pending ? 0.72 : 1,
        transition: "opacity var(--dur-glide) var(--ease-glide)",
      }}
    >
      <h2 className="t-overline" style={{ margin: 0, color: "var(--content-secondary)" }}>
        Filters
      </h2>

      {filters.campaignId ? (
        <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
          <span className="t-caption" style={{ color: "var(--content-tertiary)" }}>
            Showing one report only
          </span>
          <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
            <Pill tone="accent">{campaignLabel ?? "Report not resolved"}</Pill>
            <Button size="s" variant="plain" onClick={() => apply({ campaignId: null })}>
              Show all reports
            </Button>
          </div>
        </div>
      ) : null}

      <Field label="Rating band">
        <Select
          options={bandOptions}
          value={filters.band ?? ANY}
          aria-label="Filter by rating band"
          onChange={(event) =>
            apply({ band: (event.currentTarget.value as FeedbackFilters["band"]) || null })
          }
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
          onChange={(event) => apply({ seriesId: event.currentTarget.value || null })}
        />
      </Field>

      <Field label="Rated from">
        <input
          type="date"
          className="t-subhead"
          value={filters.from ?? ""}
          max={filters.to ?? undefined}
          aria-label="Rated on or after"
          onChange={(event) => apply({ from: event.currentTarget.value || null })}
          style={dateStyle}
        />
      </Field>

      <Field label="Rated to">
        <input
          type="date"
          className="t-subhead"
          value={filters.to ?? ""}
          min={filters.from ?? undefined}
          aria-label="Rated on or before"
          onChange={(event) => apply({ to: event.currentTarget.value || null })}
          style={dateStyle}
        />
      </Field>

      <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <SwitchRow
          checked={filters.hasComment}
          label="Has a comment"
          onCheckedChange={(checked) => apply({ hasComment: checked })}
        />
        <SwitchRow
          checked={filters.unreviewedOnly}
          label="Unreviewed only"
          onCheckedChange={(checked) => apply({ unreviewedOnly: checked })}
        />
        <SwitchRow
          checked={filters.includeTest}
          label="Include test sends"
          onCheckedChange={(checked) => apply({ includeTest: checked })}
        />
      </div>

      <p
        className="t-caption"
        style={{ margin: 0, color: "var(--content-tertiary)" }}
      >
        {feedbackExclusionCaption(filters)}
      </p>

      {facetsReason ? (
        <p className="t-caption" style={{ margin: 0, color: "var(--signal-caution)" }}>
          Filter options unavailable — {facetsReason}
        </p>
      ) : null}

      {hasActiveFeedbackFilters(filters) ? (
        <Button
          size="s"
          variant="plain"
          leadingIcon={FilterX}
          onClick={() => router.replace("/feedback", { scroll: false })}
        >
          Clear filters
        </Button>
      ) : null}
    </aside>
  );
}
