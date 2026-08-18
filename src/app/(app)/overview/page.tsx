import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { aiAvailable } from "@/lib/ai";
import { averageRating, ratingDistribution } from "@/lib/metrics";
import { createClient } from "@/lib/supabase/server";
import { fmtInt } from "@/lib/utils";
import { AiSummaryPanel } from "@/components/overview/ai-summary-panel";
import { AttentionList } from "@/components/overview/attention";
import { OverviewControls } from "@/components/overview/controls";
import {
  EngagementChart,
  type EngagementPoint,
} from "@/components/overview/engagement-chart";
import { EmailActivityTable } from "@/components/overview/email-activity-table";
import { EngagementDrilldowns } from "@/components/overview/engagement-drilldowns";
import { KpiGrid } from "@/components/overview/kpi-grid";
import { LatestFeedback } from "@/components/overview/latest-feedback";
import { LoadError } from "@/components/overview/load-error";
import { RecentCampaigns } from "@/components/overview/recent-campaigns";
import {
  SatisfactionPanel,
  type CsatPoint,
} from "@/components/overview/satisfaction";
import {
  ATTENTION_PAGE_SIZE,
  CAMPAIGN_SCAN_LIMIT,
  LATEST_FEEDBACK_COUNT,
  RATING_SCAN_LIMIT,
  RECENT_CAMPAIGN_COUNT,
  loadAttention,
  loadCampaigns,
  loadClients,
  loadEmailActivity,
  loadEngagementDetail,
  loadLatestFeedback,
  loadPeriodStats,
  loadRatingValues,
  type PeriodQuery,
} from "./data";
import { dayKey, dayLabel, periodKeyFrom, windowFor } from "./periods";
import { drilldownPanelsFrom, emailActivityQueryFrom } from "./activity-vocabulary";

export const metadata: Metadata = {
  title: "Overview",
  description:
    "Delivery, engagement and satisfaction for a period, with every exclusion stated.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(params: SearchParams, key: string): string | null {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * The default is exclusion. A caller must opt *in* to internal recipients and
 * test sends by saying so in the URL, and the caption states the result either
 * way — the exclusion is never applied silently.
 */
function excludeFrom(params: SearchParams, key: string): boolean {
  return firstParam(params, key) !== "include";
}

/** A section wrapper, so every panel on this screen has the same anatomy. */
function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader action={action}>
        <CardTitle as="h2" description={description}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const periodKey = periodKeyFrom(firstParam(params, "period"));
  const excludeInternal = excludeFrom(params, "internal");
  const excludeTests = excludeFrom(params, "tests");
  const attentionPage = Number(firstParam(params, "attention") ?? 1);
  const activityQuery = emailActivityQueryFrom(params);
  const openDrilldowns = drilldownPanelsFrom(params);

  const period = windowFor(periodKey);
  const query: PeriodQuery = {
    from: period.from,
    to: period.to,
    excludeInternal,
    excludeTests,
  };
  const previousQuery: PeriodQuery = {
    from: period.previousFrom,
    to: period.previousTo,
    excludeInternal,
    excludeTests,
  };

  const supabase = await createClient();

  const [
    stats,
    previous,
    campaigns,
    clients,
    attention,
    feedback,
    ratings,
    activity,
    engagementDetail,
  ] = await Promise.all([
    loadPeriodStats(supabase, query),
    loadPeriodStats(supabase, previousQuery),
    loadCampaigns(supabase, query),
    loadClients(supabase),
    loadAttention(
      supabase,
      Number.isFinite(attentionPage) ? attentionPage : 1,
      ATTENTION_PAGE_SIZE,
    ),
    loadLatestFeedback(supabase, query, LATEST_FEEDBACK_COUNT),
    loadRatingValues(supabase, query),
    loadEmailActivity(supabase, query, activityQuery),
    loadEngagementDetail(supabase, query),
  ]);

  const clientNames: Record<string, string> = {};
  if (clients.ok) {
    for (const client of clients.value) clientNames[client.clientId] = client.name;
  }

  /* ── The two day-series, bucketed by the day each report was sent ───────── */
  const engagement: EngagementPoint[] = [];
  const csat: CsatPoint[] = [];

  if (campaigns.ok) {
    const opens = new Map<string, number>();
    const clicks = new Map<string, number>();
    const ratingCount = new Map<string, number>();
    const ratingSum = new Map<string, number>();

    for (const row of campaigns.value.rows) {
      if (!row.sentAt) continue;
      const sent = new Date(row.sentAt);
      if (Number.isNaN(sent.getTime())) continue;
      const key = dayKey(sent);
      opens.set(key, (opens.get(key) ?? 0) + row.uniqueOpens);
      clicks.set(key, (clicks.get(key) ?? 0) + row.uniqueClicks);
      if (row.avgRating !== null && row.ratings > 0) {
        ratingCount.set(key, (ratingCount.get(key) ?? 0) + row.ratings);
        ratingSum.set(key, (ratingSum.get(key) ?? 0) + row.avgRating * row.ratings);
      }
    }

    for (const day of period.days) {
      const key = dayKey(day);
      const label = dayLabel(day);
      engagement.push({
        key,
        label,
        opens: opens.get(key) ?? 0,
        clicks: clicks.get(key) ?? 0,
      });

      const count = ratingCount.get(key) ?? 0;
      const sum = ratingSum.get(key) ?? 0;
      csat.push({
        key,
        label,
        ratings: count,
        // A day without a rating has no average — it is blank, never zero.
        avg: count > 0 ? Math.round((sum / count) * 100) / 100 : null,
      });
    }
  }

  const scannedAverage = ratings.ok ? averageRating(ratings.value.values) : null;

  function attentionHref(page: number): string {
    const next = new URLSearchParams();
    if (periodKey !== "30d") next.set("period", periodKey);
    if (!excludeInternal) next.set("internal", "include");
    if (!excludeTests) next.set("tests", "include");
    if (page > 1) next.set("attention", String(page));
    const query = next.toString();
    return query ? `/overview?${query}` : "/overview";
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
      <OverviewControls
        period={periodKey}
        excludeInternal={excludeInternal}
        excludeTests={excludeTests}
        excludedInternal={stats.ok ? stats.value.excluded_internal : null}
        excludedTestSends={stats.ok ? stats.value.excluded_test_sends : null}
        spanLabel={period.spanLabel}
      />

      {stats.ok ? (
        <KpiGrid
          stats={stats.value}
          previous={previous.ok ? previous.value : null}
          comparisonLabel={period.comparisonLabel}
          totalClients={clients.ok ? clients.value.length : null}
        />
      ) : (
        <LoadError
          what="the period totals"
          message={stats.message}
          next="Nothing is shown in place of these figures, because a zero here would be indistinguishable from a real one. Reload the page to try again."
        />
      )}

      {stats.ok && !previous.ok ? (
        <p
          className="t-caption"
          style={{ margin: 0, color: "var(--content-tertiary)" }}
        >
          The comparison period could not be read ({previous.message}), so every
          change above is shown as unknown rather than as no change.
        </p>
      ) : null}

      {engagementDetail.ok ? (
        <EngagementDrilldowns detail={engagementDetail.value} initialOpen={openDrilldowns} />
      ) : (
        <LoadError what="who opened, who clicked and report ratings" message={engagementDetail.message} />
      )}

      <Panel
        title="Engagement over time"
        description={
          campaigns.ok
            ? `Openers and clickers by day, attributed to the day each report was sent. ${fmtInt(
                campaigns.value.total,
              )} ${campaigns.value.total === 1 ? "report" : "reports"} ${
                period.spanLabel
              }.`
            : undefined
        }
      >
        {campaigns.ok ? (
          <>
            <EngagementChart points={engagement} />
            {campaigns.value.truncated ? (
              <p
                className="t-caption"
                style={{
                  margin: "var(--space-3) 0 0",
                  color: "var(--content-tertiary)",
                }}
              >
                This window holds {fmtInt(campaigns.value.total)} reports and the
                chart reads the most recent {fmtInt(CAMPAIGN_SCAN_LIMIT)} of
                them. Narrow the period to see all of it.
              </p>
            ) : null}
          </>
        ) : (
          <LoadError what="the engagement series" message={campaigns.message} />
        )}
      </Panel>

      <div
        className="grid"
        style={{
          gap: "var(--space-6)",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        <Panel
          title="Customer satisfaction"
          description="The score, all five rows of the distribution, and the direction of travel."
        >
          {ratings.ok ? (
            <SatisfactionPanel
              average={
                stats.ok && stats.value.avg_rating !== null
                  ? stats.value.avg_rating
                  : scannedAverage
              }
              ratings={ratings.value.total}
              distribution={ratingDistribution(ratings.value.values)}
              trend={csat}
              truncated={ratings.value.truncated}
              scanLimit={RATING_SCAN_LIMIT}
            />
          ) : (
            <LoadError what="the rating distribution" message={ratings.message} />
          )}
        </Panel>

        <Panel
          title="Needs attention"
          description="Ranked worst first: unreviewed low ratings, reports nobody opened, clients that have gone quiet, and addresses that bounced."
        >
          {attention.ok ? (
            <AttentionList
              rows={attention.value.rows}
              total={attention.value.total}
              page={attention.value.page}
              pageSize={attention.value.pageSize}
              clientNames={clientNames}
              hrefForPage={attentionHref}
            />
          ) : (
            <LoadError what="the attention list" message={attention.message} />
          )}
        </Panel>
      </div>

      <Panel
        title="Email activity"
        description="Every recipient in the selected period, with delivery, engagement and rating."
      >
        {activity.ok ? (
          <EmailActivityTable
            rows={activity.value.rows}
            total={activity.value.total}
            query={activityQuery}
          />
        ) : (
          <LoadError what="email activity" message={activity.message} />
        )}
      </Panel>

      <Panel
        title="Recent campaigns"
        description={`The last ${RECENT_CAMPAIGN_COUNT} reports sent ${period.spanLabel}.`}
      >
        {campaigns.ok ? (
          <RecentCampaigns
            rows={campaigns.value.rows.slice(0, RECENT_CAMPAIGN_COUNT)}
            clientNames={clientNames}
          />
        ) : (
          <LoadError what="the recent campaigns" message={campaigns.message} />
        )}
      </Panel>

      <Panel
        title="Latest feedback"
        description="Every rating carries the report it was given for."
      >
        {feedback.ok ? (
          <LatestFeedback rows={feedback.value.rows} clientNames={clientNames} />
        ) : (
          <LoadError what="the latest feedback" message={feedback.message} />
        )}
      </Panel>

      <Panel
        title="AI feedback summary"
        description="What clients praised, what they criticised, and what needs attention — generated on demand from this period's ratings and comments."
      >
        <AiSummaryPanel
          aiAvailable={aiAvailable()}
          period={{ from: period.from.toISOString(), to: period.to.toISOString() }}
          excludeInternal={excludeInternal}
          excludeTests={excludeTests}
        />
      </Panel>

      {clients.ok ? null : (
        <p
          className="t-caption"
          style={{ margin: 0, color: "var(--content-tertiary)" }}
        >
          Client names could not be read ({clients.message}), so the chips above
          say so rather than guessing which account a report belongs to.
        </p>
      )}
    </div>
  );
}
