/**
 * Everything Overview reads, and nothing it computes.
 *
 * Aggregates come from `period_stats` and the `campaign_stats` /
 * `client_health` / `attention_items` views — the metric layer defines each
 * number exactly once, and no figure on this screen is recomputed here.
 *
 * Every loader returns a result, never a throw and never a guess. A failed
 * query renders "Couldn't load" with the reason; it never falls back to zero,
 * because a fabricated zero is indistinguishable from a real one and that is
 * how v1's dashboard came to report an at-risk count that was hard-wired.
 */

import { EMPTY_PERIOD_STATS, type PeriodStats } from "@/lib/metrics";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

export type Loaded<T> = { ok: true; value: T } | { ok: false; message: string };

/** How much of a period the chart is allowed to pull before it says so. */
export const CAMPAIGN_SCAN_LIMIT = 1000;
/** How many ratings the distribution reads before it states its own ceiling. */
export const RATING_SCAN_LIMIT = 20_000;

export const ATTENTION_PAGE_SIZE = 8;
export const RECENT_CAMPAIGN_COUNT = 5;
export const LATEST_FEEDBACK_COUNT = 3;
export const EMAIL_ACTIVITY_PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_EMAIL_ACTIVITY_PAGE_SIZE = 25;
export const DRILLDOWN_ROW_LIMIT = 25;

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "The database did not respond.";
}

/** PostgREST hands bigint and numeric back as either a number or a string. */
function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** An embed is an object for a to-one relationship, but never trust the shape. */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/* ── period_stats ─────────────────────────────────────────────────────────── */

export type PeriodQuery = {
  from: Date;
  to: Date;
  excludeInternal: boolean;
  excludeTests: boolean;
};

export async function loadPeriodStats(
  supabase: Db,
  query: PeriodQuery,
): Promise<Loaded<PeriodStats>> {
  try {
    const { data, error } = await supabase.rpc("period_stats", {
      p_from: query.from.toISOString(),
      p_to: query.to.toISOString(),
      p_client_id: null,
      p_exclude_internal: query.excludeInternal,
      p_exclude_test: query.excludeTests,
    });
    if (error) return { ok: false, message: error.message };

    const rows = (Array.isArray(data) ? data : [data]) as unknown as (
      | Record<string, unknown>
      | null
    )[];
    const row = rows[0];
    if (!row) {
      return {
        ok: false,
        message: "period_stats returned no row for this window.",
      };
    }

    const value: PeriodStats = {
      ...EMPTY_PERIOD_STATS,
      campaigns_sent: num(row.campaigns_sent),
      clients_reached: num(row.clients_reached),
      recipients_attempted: num(row.recipients_attempted),
      delivered: num(row.delivered),
      bounced: num(row.bounced),
      unique_opens: num(row.unique_opens),
      unique_clicks: num(row.unique_clicks),
      ratings: num(row.ratings),
      comments: num(row.comments),
      avg_rating: numOrNull(row.avg_rating),
      excluded_internal: num(row.excluded_internal),
      excluded_test_sends: num(row.excluded_test_sends),
    };
    return { ok: true, value };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

/* ── campaign_stats ───────────────────────────────────────────────────────── */

export type CampaignRow = {
  campaignId: string;
  clientId: string | null;
  reportNumber: string | null;
  title: string;
  sentAt: string | null;
  recipientsExternal: number;
  delivered: number;
  uniqueOpens: number;
  uniqueClicks: number;
  ratings: number;
  avgRating: number | null;
};

export type CampaignScan = {
  rows: CampaignRow[];
  /** The true number in the window, whether or not it was all read. */
  total: number;
  /** True when `total` exceeds what the scan could pull. */
  truncated: boolean;
};

export async function loadCampaigns(
  supabase: Db,
  query: PeriodQuery,
): Promise<Loaded<CampaignScan>> {
  try {
    let request = supabase
      .from("campaign_stats")
      .select(
        "campaign_id, client_id, report_number, title, sent_at, recipients_external, delivered, unique_opens, unique_clicks, ratings, avg_rating",
        { count: "exact" },
      )
      .eq("status", "sent")
      .gte("sent_at", query.from.toISOString())
      .lt("sent_at", query.to.toISOString())
      .order("sent_at", { ascending: false })
      .range(0, CAMPAIGN_SCAN_LIMIT - 1);

    if (query.excludeTests) request = request.eq("is_test", false);

    const { data, error, count } = await request;
    if (error) return { ok: false, message: error.message };

    const raw = (data ?? []) as unknown as Record<string, unknown>[];
    const rows: CampaignRow[] = raw.map((row) => ({
      campaignId: text(row.campaign_id),
      clientId: textOrNull(row.client_id),
      reportNumber: textOrNull(row.report_number),
      title: text(row.title),
      sentAt: textOrNull(row.sent_at),
      recipientsExternal: num(row.recipients_external),
      delivered: num(row.delivered),
      uniqueOpens: num(row.unique_opens),
      uniqueClicks: num(row.unique_clicks),
      ratings: num(row.ratings),
      avgRating: numOrNull(row.avg_rating),
    }));

    const total = count ?? rows.length;
    return {
      ok: true,
      value: { rows, total, truncated: total > rows.length },
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

/* ── client_health ────────────────────────────────────────────────────────── */

export type ClientRow = { clientId: string; name: string; health: string };

export async function loadClients(supabase: Db): Promise<Loaded<ClientRow[]>> {
  try {
    const { data, error } = await supabase
      .from("client_health")
      .select("client_id, name, health")
      .order("name", { ascending: true });
    if (error) return { ok: false, message: error.message };

    const raw = (data ?? []) as unknown as Record<string, unknown>[];
    return {
      ok: true,
      value: raw.map((row) => ({
        clientId: text(row.client_id),
        name: text(row.name),
        health: text(row.health),
      })),
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

/* ── attention_items ──────────────────────────────────────────────────────── */

export type AttentionKind =
  | "low_rating"
  | "no_external_open"
  | "client_idle"
  | "bounce";

export type AttentionSeverity = "critical" | "warning";

export type AttentionRow = {
  key: string;
  kind: AttentionKind | string;
  severity: AttentionSeverity;
  refId: string;
  campaignId: string | null;
  clientId: string | null;
  summary: string;
  occurredAt: string | null;
};

export type AttentionPage = {
  rows: AttentionRow[];
  total: number;
  page: number;
  pageSize: number;
};

export async function loadAttention(
  supabase: Db,
  page: number,
  pageSize: number = ATTENTION_PAGE_SIZE,
): Promise<Loaded<AttentionPage>> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const offset = (safePage - 1) * pageSize;

  try {
    const { data, error, count } = await supabase
      .from("attention_items")
      .select("kind, severity, ref_id, campaign_id, client_id, summary, occurred_at", {
        count: "exact",
      })
      // 'critical' sorts before 'warning', so the worst is always first.
      .order("severity", { ascending: true })
      .order("occurred_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + pageSize - 1);
    if (error) return { ok: false, message: error.message };

    const raw = (data ?? []) as unknown as Record<string, unknown>[];
    const rows: AttentionRow[] = raw.map((row, index) => ({
      key: `${text(row.kind)}:${text(row.ref_id)}:${index}`,
      kind: text(row.kind),
      severity: text(row.severity) === "critical" ? "critical" : "warning",
      refId: text(row.ref_id),
      campaignId: textOrNull(row.campaign_id),
      clientId: textOrNull(row.client_id),
      summary: text(row.summary),
      occurredAt: textOrNull(row.occurred_at),
    }));

    return {
      ok: true,
      value: { rows, total: count ?? rows.length, page: safePage, pageSize },
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

/* ── feedback ─────────────────────────────────────────────────────────────── */

type RawEmbeddedCampaign = {
  id?: unknown;
  report_number?: unknown;
  title?: unknown;
  client_id?: unknown;
};

type RawEmbeddedRecipient = {
  full_name?: unknown;
  email?: unknown;
};

export type FeedbackRow = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string | null;
  author: string;
  campaignId: string | null;
  /** The report a rating belongs to. A rating is never shown without it. */
  campaignLabel: string;
  clientId: string | null;
};

export type FeedbackPage = { rows: FeedbackRow[]; total: number };

const FEEDBACK_SELECT =
  "id, rating, comment, created_at, campaigns!inner(id, report_number, title, client_id, sent_at, is_test), campaign_recipients!inner(full_name, email, is_internal)";

export async function loadLatestFeedback(
  supabase: Db,
  query: PeriodQuery,
  limit: number = LATEST_FEEDBACK_COUNT,
): Promise<Loaded<FeedbackPage>> {
  try {
    let request = supabase
      .from("feedback")
      .select(FEEDBACK_SELECT, { count: "exact" })
      .gte("campaigns.sent_at", query.from.toISOString())
      .lt("campaigns.sent_at", query.to.toISOString())
      .order("created_at", { ascending: false })
      .range(0, limit - 1);

    if (query.excludeTests) request = request.eq("campaigns.is_test", false);
    if (query.excludeInternal) {
      request = request.eq("campaign_recipients.is_internal", false);
    }

    const { data, error, count } = await request;
    if (error) return { ok: false, message: error.message };

    const raw = (data ?? []) as unknown as Record<string, unknown>[];
    const rows: FeedbackRow[] = raw.map((row) => {
      const campaign = one(row.campaigns as RawEmbeddedCampaign | RawEmbeddedCampaign[] | null);
      const recipient = one(
        row.campaign_recipients as RawEmbeddedRecipient | RawEmbeddedRecipient[] | null,
      );
      const reportNumber = textOrNull(campaign?.report_number);
      const title = text(campaign?.title);
      return {
        id: text(row.id),
        rating: num(row.rating),
        comment: textOrNull(row.comment),
        createdAt: textOrNull(row.created_at),
        author:
          textOrNull(recipient?.full_name) ?? text(recipient?.email) ?? "Unnamed recipient",
        campaignId: textOrNull(campaign?.id),
        campaignLabel: reportNumber ? `${reportNumber} · ${title}` : title,
        clientId: textOrNull(campaign?.client_id),
      };
    });

    return { ok: true, value: { rows, total: count ?? rows.length } };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

/* ── the rating distribution ──────────────────────────────────────────────── */

export type RatingScan = {
  /** Every rating value read, for the five-row distribution. */
  values: number[];
  /** The true number of ratings in the window. */
  total: number;
  truncated: boolean;
};

export async function loadRatingValues(
  supabase: Db,
  query: PeriodQuery,
): Promise<Loaded<RatingScan>> {
  try {
    let request = supabase
      .from("feedback")
      .select(
        "rating, campaigns!inner(sent_at, is_test), campaign_recipients!inner(is_internal)",
        { count: "exact" },
      )
      .gte("campaigns.sent_at", query.from.toISOString())
      .lt("campaigns.sent_at", query.to.toISOString())
      .range(0, RATING_SCAN_LIMIT - 1);

    if (query.excludeTests) request = request.eq("campaigns.is_test", false);
    if (query.excludeInternal) {
      request = request.eq("campaign_recipients.is_internal", false);
    }

    const { data, error, count } = await request;
    if (error) return { ok: false, message: error.message };

    const raw = (data ?? []) as unknown as Record<string, unknown>[];
    const values = raw.map((row) => num(row.rating));
    const total = count ?? values.length;
    return { ok: true, value: { values, total, truncated: total > values.length } };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

/* ── recipient_engagement: the Email Activity table ──────────────────────────
 * v1's version of this table capped at 40 rows against a total of 160 and
 * labelled the cap as if it were the count. `total` here is always the true
 * server-side count, independent of how many rows the current page holds.
 */

export type EmailActivitySortId = "sent_at" | "rating";
export type EmailActivityEngagement = "all" | "responded" | "not_opened";

export type EmailActivityQuery = {
  page: number;
  pageSize: number;
  sortId: EmailActivitySortId;
  sortAsc: boolean;
  engagement: EmailActivityEngagement;
};

export type EmailActivityRow = {
  recipientId: string;
  email: string;
  fullName: string;
  isInternal: boolean;
  campaignId: string;
  campaignLabel: string;
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  responded: boolean;
  rating: number | null;
  sentAt: string | null;
};

export type EmailActivityPage = {
  rows: EmailActivityRow[];
  total: number;
};

const EMAIL_ACTIVITY_SELECT =
  "recipient_id, campaign_id, report_number, title, email, full_name, is_internal, delivered, opened, clicked, rating, sent_at";

function campaignLabelOf(reportNumber: unknown, title: unknown): string {
  const number = textOrNull(reportNumber);
  const name = text(title);
  return number ? `${number} · ${name}` : name;
}

export async function loadEmailActivity(
  supabase: Db,
  period: PeriodQuery,
  activity: EmailActivityQuery,
): Promise<Loaded<EmailActivityPage>> {
  const page = Number.isFinite(activity.page) && activity.page > 0 ? Math.floor(activity.page) : 1;
  const pageSize = activity.pageSize > 0 ? activity.pageSize : DEFAULT_EMAIL_ACTIVITY_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  try {
    let request = supabase
      .from("recipient_engagement")
      .select(EMAIL_ACTIVITY_SELECT, { count: "exact" })
      .gte("sent_at", period.from.toISOString())
      .lt("sent_at", period.to.toISOString());

    if (period.excludeTests) request = request.eq("is_test", false);
    if (period.excludeInternal) request = request.eq("is_internal", false);
    if (activity.engagement === "responded") request = request.not("rating", "is", null);
    if (activity.engagement === "not_opened") request = request.eq("opened", false);

    request = request
      .order(activity.sortId, { ascending: activity.sortAsc, nullsFirst: false })
      .range(offset, offset + pageSize - 1);

    const { data, error, count } = await request;
    if (error) return { ok: false, message: error.message };

    const raw = (data ?? []) as unknown as Record<string, unknown>[];
    const rows: EmailActivityRow[] = raw.map((row) => ({
      recipientId: text(row.recipient_id),
      email: text(row.email),
      fullName: text(row.full_name),
      isInternal: Boolean(row.is_internal),
      campaignId: text(row.campaign_id),
      campaignLabel: campaignLabelOf(row.report_number, row.title),
      delivered: Boolean(row.delivered),
      opened: Boolean(row.opened),
      clicked: Boolean(row.clicked),
      responded: row.rating !== null && row.rating !== undefined,
      rating: numOrNull(row.rating),
      sentAt: textOrNull(row.sent_at),
    }));

    return { ok: true, value: { rows, total: count ?? rows.length } };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

/* ── recipient_engagement: the drill-downs ────────────────────────────────────
 * "Who opened" reads `opened` as a set-membership flag straight from the view
 * — never opens + clicks — so a nine-time clicker still appears exactly once.
 * Every row carries the campaign it belongs to; v1 hardcoded this column to
 * "—", which is what made two legitimate same-day ratings look contradictory.
 */

export type EngagementPersonRow = {
  recipientId: string;
  email: string;
  fullName: string;
  isInternal: boolean;
  campaignId: string;
  campaignLabel: string;
  occurredAt: string | null;
  rating: number | null;
  comment: string | null;
};

export type EngagementGroup = { rows: EngagementPersonRow[]; total: number };

export type EngagementDetail = {
  opened: EngagementGroup;
  clicked: EngagementGroup;
  ratings: EngagementGroup;
};

function personRowsOf(
  raw: Record<string, unknown>[],
  timeKey: "first_opened_at" | "rated_at",
): EngagementPersonRow[] {
  return raw.map((row) => ({
    recipientId: text(row.recipient_id),
    email: text(row.email),
    fullName: text(row.full_name),
    isInternal: Boolean(row.is_internal),
    campaignId: text(row.campaign_id),
    campaignLabel: campaignLabelOf(row.report_number, row.title),
    occurredAt: textOrNull(row[timeKey]),
    rating: numOrNull(row.rating),
    comment: textOrNull(row.comment),
  }));
}

const DRILLDOWN_SELECT =
  "recipient_id, campaign_id, report_number, title, email, full_name, is_internal, rating, comment, first_opened_at, rated_at";

export async function loadEngagementDetail(
  supabase: Db,
  period: PeriodQuery,
  limit: number = DRILLDOWN_ROW_LIMIT,
): Promise<Loaded<EngagementDetail>> {
  function scoped() {
    let request = supabase
      .from("recipient_engagement")
      .select(DRILLDOWN_SELECT, { count: "exact" })
      .gte("sent_at", period.from.toISOString())
      .lt("sent_at", period.to.toISOString());
    if (period.excludeTests) request = request.eq("is_test", false);
    if (period.excludeInternal) request = request.eq("is_internal", false);
    return request;
  }

  try {
    const [openedRes, clickedRes, ratingsRes] = await Promise.all([
      scoped()
        .eq("opened", true)
        .order("first_opened_at", { ascending: false, nullsFirst: false })
        .range(0, limit - 1),
      scoped()
        .eq("clicked", true)
        .order("first_opened_at", { ascending: false, nullsFirst: false })
        .range(0, limit - 1),
      scoped()
        .not("rating", "is", null)
        .order("rated_at", { ascending: false, nullsFirst: false })
        .range(0, limit - 1),
    ]);

    if (openedRes.error) return { ok: false, message: openedRes.error.message };
    if (clickedRes.error) return { ok: false, message: clickedRes.error.message };
    if (ratingsRes.error) return { ok: false, message: ratingsRes.error.message };

    const opened: EngagementGroup = {
      rows: personRowsOf((openedRes.data ?? []) as Record<string, unknown>[], "first_opened_at"),
      total: openedRes.count ?? 0,
    };
    const clicked: EngagementGroup = {
      rows: personRowsOf((clickedRes.data ?? []) as Record<string, unknown>[], "first_opened_at"),
      total: clickedRes.count ?? 0,
    };
    const ratings: EngagementGroup = {
      rows: personRowsOf((ratingsRes.data ?? []) as Record<string, unknown>[], "rated_at"),
      total: ratingsRes.count ?? 0,
    };

    return { ok: true, value: { opened, clicked, ratings } };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}
