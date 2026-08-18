/**
 * The eight figures, each carrying its own arithmetic.
 *
 * Not one rate is computed here. Every percentage comes from `src/lib/metrics`
 * and every card states the formula it was given, because v1's "Open Rate"
 * card was labelled correctly and computed `opens + clicks` — a card that
 * cannot exist without stating its own definition is the structural fix.
 *
 * The three counts have no entry in `FORMULAE` (they are counts, not rates),
 * so their definitions are stated here in the same voice and passed the same
 * way. Every card on this grid carries a formula.
 */

import {
  FORMULAE,
  bounceRate,
  clickRate,
  clickToOpenRate,
  deliveryRate,
  deltaPoints,
  responseRate,
  uniqueOpenRate,
  type PeriodStats,
} from "@/lib/metrics";
import { KpiCard } from "@/components/ui";
import { fmtInt, fmtPct, fmtRating } from "@/lib/utils";

/** Definitions for the figures that are counts rather than rates. */
export const COUNT_DEFINITIONS = {
  totalClients: "Every client on the roster, active or not, regardless of the period above",
  clientsReached:
    "Distinct clients with at least one recipient in the period, after the exclusions above",
  campaignsSent:
    "Distinct campaigns with at least one recipient in the period, after the exclusions above",
  delivered:
    "Recipients the receiving server accepted — never the number attempted",
  avgRating: "Mean of every star rating received in the period",
} as const;

export type KpiGridProps = {
  stats: PeriodStats;
  /** The equal span immediately before this one. null when it could not be read. */
  previous: PeriodStats | null;
  /** "vs the previous 30 days". */
  comparisonLabel: string;
  /** The full roster count, read once and independent of the period above. null when it could not be read. */
  totalClients: number | null;
};

export function KpiGrid({ stats, previous, comparisonLabel, totalClients }: KpiGridProps) {
  const countDelta = (current: number, before: number | undefined) =>
    previous === null || before === undefined ? null : current - before;

  const rateDelta = (
    read: (s: PeriodStats) => number | null,
  ): number | null => (previous === null ? null : deltaPoints(read(stats), read(previous)));

  return (
    <div
      className="grid"
      style={{
        gap: "var(--space-4)",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
      }}
    >
      <KpiCard
        label="Clients"
        value={totalClients === null ? "—" : fmtInt(totalClients)}
        formula={COUNT_DEFINITIONS.totalClients}
      />

      <KpiCard
        label="Clients reached"
        value={fmtInt(stats.clients_reached)}
        formula={COUNT_DEFINITIONS.clientsReached}
        delta={countDelta(stats.clients_reached, previous?.clients_reached)}
        deltaSuffix=""
        deltaLabel={comparisonLabel}
      />

      <KpiCard
        label="Campaigns sent"
        value={fmtInt(stats.campaigns_sent)}
        formula={COUNT_DEFINITIONS.campaignsSent}
        delta={countDelta(stats.campaigns_sent, previous?.campaigns_sent)}
        deltaSuffix=""
        deltaLabel={comparisonLabel}
      />

      <KpiCard
        label="Emails delivered"
        value={fmtInt(stats.delivered)}
        formula={COUNT_DEFINITIONS.delivered}
        delta={countDelta(stats.delivered, previous?.delivered)}
        deltaSuffix=""
        deltaLabel={comparisonLabel}
        footnote={`${fmtInt(stats.recipients_attempted)} attempted`}
      />

      <KpiCard
        label="Delivery rate"
        value={fmtPct(deliveryRate(stats))}
        formula={FORMULAE.deliveryRate}
        delta={rateDelta(deliveryRate)}
        deltaLabel={comparisonLabel}
      />

      <KpiCard
        label="Bounce rate"
        value={fmtPct(bounceRate(stats))}
        formula={FORMULAE.bounceRate}
        delta={rateDelta(bounceRate)}
        deltaLabel={comparisonLabel}
        deltaInverted
        footnote={`${fmtInt(stats.bounced)} bounced`}
      />

      <KpiCard
        label="Unique open rate"
        value={fmtPct(uniqueOpenRate(stats))}
        formula={FORMULAE.uniqueOpenRate}
        delta={rateDelta(uniqueOpenRate)}
        deltaLabel={comparisonLabel}
        footnote={`${fmtInt(stats.unique_opens)} people, counted once each`}
      />

      <KpiCard
        label="Click rate"
        value={fmtPct(clickRate(stats))}
        formula={FORMULAE.clickRate}
        delta={rateDelta(clickRate)}
        deltaLabel={comparisonLabel}
        footnote={`${fmtInt(stats.unique_clicks)} people, counted once each`}
      />

      <KpiCard
        label="Click to open"
        value={fmtPct(clickToOpenRate(stats))}
        formula={FORMULAE.clickToOpen}
        delta={rateDelta(clickToOpenRate)}
        deltaLabel={comparisonLabel}
      />

      <KpiCard
        label="Response rate"
        value={fmtPct(responseRate(stats))}
        formula={FORMULAE.responseRate}
        delta={rateDelta(responseRate)}
        deltaLabel={comparisonLabel}
        footnote={`${fmtInt(stats.ratings)} ratings · ${fmtInt(
          stats.comments,
        )} with a comment`}
      />

      <KpiCard
        label="Average rating"
        value={fmtRating(stats.avg_rating)}
        unit="out of 5"
        formula={COUNT_DEFINITIONS.avgRating}
        delta={
          previous === null ||
          stats.avg_rating === null ||
          previous.avg_rating === null
            ? null
            : Math.round((stats.avg_rating - previous.avg_rating) * 100) / 100
        }
        deltaSuffix=""
        deltaLabel={comparisonLabel}
      />
    </div>
  );
}
