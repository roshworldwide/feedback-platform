/**
 * One campaign, expressed in the shape the metric layer takes.
 *
 * `src/lib/metrics.ts` owns every rate. This does no arithmetic — it only
 * names which of `campaign_stats`' counts plays which part, so a screen can
 * call `uniqueOpenRate` rather than divide two numbers inline and invent a
 * fourteenth definition of "open".
 *
 * `recipients_attempted` is the EXTERNAL recipient count, matching `funnelOf`:
 * internal recipients are excluded from every headline figure, and the screens
 * that use this say so with `EXCLUSION_NOTE`.
 */

import type { CampaignStats, PeriodStats } from "@/lib/metrics";

export function periodOf(stats: CampaignStats): PeriodStats {
  return {
    campaigns_sent: 1,
    clients_reached: 1,
    recipients_attempted: stats.recipients_external,
    delivered: stats.delivered,
    bounced: stats.bounced,
    unique_opens: stats.unique_opens,
    unique_clicks: stats.unique_clicks,
    ratings: stats.ratings,
    comments: stats.comments,
    avg_rating: stats.avg_rating,
    excluded_internal: stats.recipients_internal,
    excluded_test_sends: 0,
  };
}

/** Sums a set of campaigns into one period. Addition only — no rate is summed. */
export function periodOfMany(all: CampaignStats[]): PeriodStats {
  return all.reduce<PeriodStats>(
    (total, stats) => ({
      campaigns_sent: total.campaigns_sent + 1,
      clients_reached: 1,
      recipients_attempted: total.recipients_attempted + stats.recipients_external,
      delivered: total.delivered + stats.delivered,
      bounced: total.bounced + stats.bounced,
      unique_opens: total.unique_opens + stats.unique_opens,
      unique_clicks: total.unique_clicks + stats.unique_clicks,
      ratings: total.ratings + stats.ratings,
      comments: total.comments + stats.comments,
      avg_rating: null,
      excluded_internal: total.excluded_internal + stats.recipients_internal,
      excluded_test_sends: 0,
    }),
    {
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
    },
  );
}

/** The formula shown beside a count, so a KPI card can never be unexplained. */
export const COUNT_FORMULAE = {
  attempted: "Recipients the send was attempted to, external only",
  delivered: "Recipients the provider accepted — not the same as attempted",
  ratings: "Ratings received from external recipients",
  avgRating: "Mean of the ratings received, to one decimal",
  contacts: "Active contacts on client accounts, internal contacts excluded",
  clients: "Client records, whatever their status",
  activeClients: "Client records whose status is active",
} as const;

/** Stated on screen wherever internal recipients have been left out. */
export function exclusionNote(internal: number): string {
  return internal === 1
    ? "1 internal recipient is excluded from these figures."
    : `${internal} internal recipients are excluded from these figures.`;
}
