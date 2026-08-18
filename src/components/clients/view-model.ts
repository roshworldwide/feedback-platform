/**
 * What the client screen shows, derived once on the server.
 *
 * Grouping and ordering only. Every rate is produced by `src/lib/metrics.ts`
 * from `campaign_stats`' counts, so the trend on this screen and the figure on
 * the campaign screen are the same number arrived at the same way.
 *
 * A leaf module: no server imports, so the page can build these and a client
 * component can hold their types.
 */

import { clickRate, uniqueOpenRate } from "@/lib/metrics";
import { periodOf } from "@/components/campaigns/stats-adapter";
import type { CampaignStatus } from "@/components/campaigns/vocabulary";
import type { ClientCampaignStat, ContactRow, PersonEngagement } from "@/lib/queries/clients";

/* ── Trend ────────────────────────────────────────────────────────────────── */

export type TrendPoint = {
  campaignId: string;
  reportNumber: string | null;
  title: string;
  status: CampaignStatus;
  sentAt: string | null;
  recipients: number;
  delivered: number;
  openRate: number | null;
  clickRate: number | null;
  avgRating: number | null;
  ratings: number;
  internal: number;
};

/** Oldest first, so a trend reads left to right the way time does. */
export function trendOf(rows: ClientCampaignStat[]): TrendPoint[] {
  return rows
    .filter((row) => row.sentAt !== null)
    .slice()
    .sort((a, b) => ((a.sentAt ?? "") < (b.sentAt ?? "") ? -1 : 1))
    .map((row) => {
      const period = periodOf(row.stats);
      return {
        campaignId: row.campaignId,
        reportNumber: row.reportNumber,
        title: row.title,
        status: row.status,
        sentAt: row.sentAt,
        recipients: row.stats.recipients_external,
        delivered: row.stats.delivered,
        openRate: uniqueOpenRate(period),
        clickRate: clickRate(period),
        avgRating: row.stats.avg_rating,
        ratings: row.stats.ratings,
        internal: row.stats.recipients_internal,
      };
    });
}

/* ── Cadence ──────────────────────────────────────────────────────────────── */

export type CadencePoint = {
  campaignId: string;
  label: string;
  sentAt: string;
  /** Days since the previous send. null for the first one on record. */
  gapDays: number | null;
};

const DAY = 86_400_000;

export function cadenceOf(trend: TrendPoint[]): CadencePoint[] {
  const points: CadencePoint[] = [];
  let previous: number | null = null;

  for (const point of trend) {
    if (!point.sentAt) continue;
    const at = new Date(point.sentAt).getTime();
    if (Number.isNaN(at)) continue;
    points.push({
      campaignId: point.campaignId,
      label: point.reportNumber ?? point.title,
      sentAt: point.sentAt,
      gapDays: previous === null ? null : Math.round((at - previous) / DAY),
    });
    previous = at;
  }
  return points;
}

/* ── People ───────────────────────────────────────────────────────────────── */

export type PersonRow = {
  contactId: string;
  email: string;
  fullName: string;
  title: string;
  isInternal: boolean;
  isActive: boolean;
  bouncedAt: string | null;
  sends: number;
  delivered: number;
  opened: number;
  clicked: number;
  ratings: number;
  avgRating: number | null;
};

/**
 * Contacts joined to their engagement. A contact with no rows is not dropped —
 * they are the coverage gap, and dropping them is how a silent account looks
 * fully covered.
 */
export function peopleOf(
  contacts: ContactRow[],
  engagement: Map<string, PersonEngagement>,
): PersonRow[] {
  return contacts.map((contact) => {
    const person = engagement.get(contact.email.toLowerCase());
    return {
      contactId: contact.id,
      email: contact.email,
      fullName: contact.fullName || contact.email,
      title: contact.title,
      isInternal: contact.isInternal,
      isActive: contact.isActive,
      bouncedAt: contact.bouncedAt,
      sends: person?.sends ?? 0,
      delivered: person?.delivered ?? 0,
      opened: person?.opened ?? 0,
      clicked: person?.clicked ?? 0,
      ratings: person?.ratings ?? 0,
      avgRating: person?.avgRating ?? null,
    };
  });
}

export type CoverageGap = {
  /** Active external contacts who have never been on a send. */
  neverSent: PersonRow[];
  /** Active external contacts who have been sent to and never opened one. */
  neverOpened: PersonRow[];
  externalTotal: number;
};

export function coverageGapOf(people: PersonRow[]): CoverageGap {
  const external = people.filter((person) => !person.isInternal && person.isActive);
  return {
    neverSent: external.filter((person) => person.sends === 0),
    neverOpened: external.filter(
      (person) => person.sends > 0 && person.opened === 0,
    ),
    externalTotal: external.length,
  };
}

/** Most engaged first: opens, then clicks, then sends. Ties keep name order. */
export function topEngaged(people: PersonRow[], limit: number): PersonRow[] {
  return people
    .filter((person) => !person.isInternal && person.sends > 0)
    .slice()
    .sort(
      (a, b) =>
        b.opened - a.opened ||
        b.clicked - a.clicked ||
        b.sends - a.sends ||
        a.fullName.localeCompare(b.fullName),
    )
    .slice(0, limit);
}
