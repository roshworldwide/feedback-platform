/**
 * Engagement arithmetic.
 *
 * These are pure functions over already-deduplicated counts produced by
 * `period_stats` / `campaign_stats`. They exist so the definitions are
 * unit-testable and stated once — see metrics.test.ts, which asserts the exact
 * defect v1 shipped (a click counted as a second open) can no longer occur.
 *
 * Naming is deliberate. v1's card said "Open Rate" while computing
 * opens + clicks; every rate here is named for what it actually measures and
 * carries its formula for display in a tooltip.
 */

import { pct } from "./utils";

export type PeriodStats = {
  campaigns_sent: number;
  clients_reached: number;
  recipients_attempted: number;
  delivered: number;
  bounced: number;
  unique_opens: number;
  unique_clicks: number;
  ratings: number;
  comments: number;
  avg_rating: number | null;
  excluded_internal: number;
  excluded_test_sends: number;
};

export const EMPTY_PERIOD_STATS: PeriodStats = {
  campaigns_sent: 0,
  clients_reached: 0,
  recipients_attempted: 0,
  delivered: 0,
  bounced: 0,
  unique_opens: 0,
  unique_clicks: 0,
  ratings: 0,
  comments: 0,
  avg_rating: null,
  excluded_internal: 0,
  excluded_test_sends: 0,
};

/** Every derived rate, each with the formula shown to the user on hover. */
export const FORMULAE = {
  deliveryRate: "Delivered ÷ attempted",
  bounceRate: "Bounced ÷ attempted",
  uniqueOpenRate: "Recipients who opened or clicked ÷ delivered",
  clickRate: "Recipients who clicked ÷ delivered",
  clickToOpen: "Recipients who clicked ÷ recipients who opened",
  responseRate: "Ratings received ÷ delivered",
  commentRate: "Written comments ÷ ratings received",
} as const;

export function deliveryRate(s: PeriodStats) {
  return pct(s.delivered, s.recipients_attempted);
}

export function bounceRate(s: PeriodStats) {
  return pct(s.bounced, s.recipients_attempted);
}

/**
 * Unique openers over delivered.
 *
 * `unique_opens` is a count of *recipients*, not of events, and already treats
 * a click as an open exactly once. Adding clicks here — which is precisely what
 * v1 did — would double-count every clicker.
 */
export function uniqueOpenRate(s: PeriodStats) {
  return pct(s.unique_opens, s.delivered);
}

export function clickRate(s: PeriodStats) {
  return pct(s.unique_clicks, s.delivered);
}

/** Of the people who opened, how many went through to the report. */
export function clickToOpenRate(s: PeriodStats) {
  return pct(s.unique_clicks, s.unique_opens);
}

export function responseRate(s: PeriodStats) {
  return pct(s.ratings, s.delivered);
}

export function commentRate(s: PeriodStats) {
  return pct(s.comments, s.ratings);
}

/**
 * A percentage-point delta between two periods.
 * Returns null when either side is undefined — an unknown delta is never
 * rendered as "no change".
 */
export function deltaPoints(current: number | null, previous: number | null) {
  if (current === null || previous === null) return null;
  return Math.round((current - previous) * 10) / 10;
}

export type Trend = "up" | "down" | "flat" | "unknown";

/**
 * Direction, with an explicit `inverted` flag for metrics where down is good.
 * Bounce rate falling is an improvement; a shared "delta > 0 is green" rule
 * would colour it as a regression.
 */
export function trendOf(delta: number | null, inverted = false): Trend {
  if (delta === null) return "unknown";
  if (Math.abs(delta) < 0.05) return "flat";
  const rising = delta > 0;
  const good = inverted ? !rising : rising;
  return good ? "up" : "down";
}

export type CampaignStats = {
  campaign_id: string;
  recipients_total: number;
  recipients_internal: number;
  recipients_external: number;
  delivered: number;
  bounced: number;
  unique_opens: number;
  unique_clicks: number;
  ratings: number;
  avg_rating: number | null;
  comments: number;
};

/** The Sent → Delivered → Opened → Clicked → Rated funnel, with drop-off. */
export function funnelOf(s: CampaignStats) {
  const steps = [
    { key: "sent", label: "Sent", value: s.recipients_external },
    { key: "delivered", label: "Delivered", value: s.delivered },
    { key: "opened", label: "Opened", value: s.unique_opens },
    { key: "clicked", label: "Clicked", value: s.unique_clicks },
    { key: "rated", label: "Rated", value: s.ratings },
  ] as const;

  return steps.map((step, i) => {
    const previous = i === 0 ? step.value : steps[i - 1].value;
    return {
      ...step,
      ofPrevious: pct(step.value, previous),
      ofStart: pct(step.value, steps[0].value),
      dropOff: i === 0 ? null : previous - step.value,
    };
  });
}

/** Distribution over the five star values, always all five rows. */
export function ratingDistribution(ratings: number[]) {
  const counts = new Map<number, number>([[5, 0], [4, 0], [3, 0], [2, 0], [1, 0]]);
  for (const r of ratings) {
    if (counts.has(r)) counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  const total = ratings.length;
  return [5, 4, 3, 2, 1].map((star) => {
    const count = counts.get(star) ?? 0;
    return { star, count, pct: pct(count, total) ?? 0 };
  });
}

export function averageRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((a, b) => a + b, 0);
  return Math.round((sum / ratings.length) * 100) / 100;
}
