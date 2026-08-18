/**
 * Campaign reads.
 *
 * Every engagement figure on this path comes out of `campaign_stats` or
 * `recipient_engagement`. Nothing here re-derives an open, a click or a rate —
 * grouping and time-bucketing are the only arithmetic permitted, and the rates
 * themselves are computed by `src/lib/metrics.ts` from the view's counts.
 *
 * A read either succeeds or states why it could not. It never falls back to a
 * zero, because the database being unreachable and a client having no campaigns
 * are different facts and v1 conflated them.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampaignStats } from "@/lib/metrics";
import {
  CAMPAIGN_SORT_COLUMN,
  CAMPAIGN_STATUSES,
  RATING_BANDS,
  type CampaignFilters,
  type CampaignStatus,
} from "@/components/campaigns/vocabulary";

export type {
  CampaignFilters,
  CampaignSortId,
  CampaignStatus,
  OpenedFilter,
  RatingBand,
  SearchParams,
} from "@/components/campaigns/vocabulary";
export {
  CAMPAIGN_PAGE_SIZES,
  CAMPAIGN_SORT_COLUMN,
  CAMPAIGN_STATUSES,
  RATING_BANDS,
  STATUS_LABEL,
  campaignQueryString,
  firstParam,
  hasActiveCampaignFilters,
  parseCampaignFilters,
} from "@/components/campaigns/vocabulary";

/* ── Result ───────────────────────────────────────────────────────────────── */

export type QueryResult<T> = { ok: true; data: T } | { ok: false; reason: string };

/** PostgREST's default ceiling. Anything at this length is stated, not hidden. */
export const MAX_ROWS = 1000;

/**
 * Imported lazily so a missing environment variable at build time arrives as a
 * caught "Couldn't load" rather than a crashed render.
 */
async function db(): Promise<SupabaseClient> {
  const { createClient } = await import("@/lib/supabase/server");
  return createClient();
}

function reasonOf(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim() !== "") return message;
  }
  if (typeof error === "string" && error.trim() !== "") return error;
  return "The database did not respond.";
}

/** `,` `(` `)` `*` and `%` are operators inside a PostgREST or() clause. */
function safeLike(input: string): string {
  return input.replace(/[%_,()\\*.]/g, " ").replace(/\s+/g, " ").trim();
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function toStatus(value: unknown): CampaignStatus {
  const found = CAMPAIGN_STATUSES.find((status) => status === value);
  return found ?? "draft";
}

/* ── Stats mapping ────────────────────────────────────────────────────────── */

type StatsRecord = Record<string, unknown>;

function toStats(row: StatsRecord): CampaignStats {
  return {
    campaign_id: str(row.campaign_id),
    recipients_total: num(row.recipients_total),
    recipients_internal: num(row.recipients_internal),
    recipients_external: num(row.recipients_external),
    delivered: num(row.delivered),
    bounced: num(row.bounced),
    unique_opens: num(row.unique_opens),
    unique_clicks: num(row.unique_clicks),
    ratings: num(row.ratings),
    avg_rating: nullableNum(row.avg_rating),
    comments: num(row.comments),
  };
}

const STATS_COLUMNS =
  "campaign_id, client_id, series_id, report_number, title, status, is_test, sent_at, " +
  "recipients_total, recipients_internal, recipients_external, delivered, bounced, " +
  "unique_opens, unique_clicks, ratings, avg_rating, comments";

/* ── List ─────────────────────────────────────────────────────────────────── */

export type CampaignListRow = {
  id: string;
  reportNumber: string | null;
  title: string;
  clientId: string;
  clientName: string | null;
  clientSlug: string | null;
  seriesId: string | null;
  seriesName: string | null;
  status: CampaignStatus;
  isTest: boolean;
  sentAt: string | null;
  stats: CampaignStats;
};

export type CampaignListPage = {
  rows: CampaignListRow[];
  /** The true total for the current filter set. Never the page length. */
  total: number;
  page: number;
  pageSize: number;
  /**
   * Set when the template filter had to be resolved through an id lookup that
   * hit the row ceiling. Stated on screen — a partial answer is never silent.
   */
  templateLookupIncomplete: boolean;
};

type StatsQuery = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;

function applyStatsFilters(query: StatsQuery, filters: CampaignFilters): StatsQuery {
  let next = query;
  if (!filters.includeTest) next = next.eq("is_test", false);
  if (filters.clientId) next = next.eq("client_id", filters.clientId);
  if (filters.seriesId) next = next.eq("series_id", filters.seriesId);
  if (filters.status) next = next.eq("status", filters.status);
  if (filters.from) next = next.gte("sent_at", `${filters.from}T00:00:00Z`);
  if (filters.to) next = next.lte("sent_at", `${filters.to}T23:59:59Z`);

  const band = RATING_BANDS.find((item) => item.value === filters.band);
  if (band) {
    if (band.value === "none") {
      next = next.is("avg_rating", null);
    } else {
      next = next.not("avg_rating", "is", null);
      if (band.min !== null) next = next.gte("avg_rating", band.min);
      if (band.max !== null) next = next.lt("avg_rating", band.max);
    }
  }

  if (filters.opened === "opened") next = next.gt("unique_opens", 0);
  if (filters.opened === "not-opened") next = next.eq("unique_opens", 0);

  const search = safeLike(filters.q);
  if (search) {
    next = next.or(`title.ilike.*${search}*,report_number.ilike.*${search}*`);
  }
  return next;
}

export async function listCampaigns(
  filters: CampaignFilters,
): Promise<QueryResult<CampaignListPage>> {
  try {
    const supabase = await db();

    // `template_key` lives on the table, not on the rollup view, so the one
    // filter the view cannot express is resolved to an id set first.
    let templateIds: string[] | null = null;
    let templateLookupIncomplete = false;

    if (filters.templateKey) {
      const lookup = await supabase
        .from("campaigns")
        .select("id", { count: "exact" })
        .eq("template_key", filters.templateKey)
        .range(0, MAX_ROWS - 1);
      if (lookup.error) throw lookup.error;
      const rows = (lookup.data ?? []) as unknown as StatsRecord[];
      templateIds = rows.map((row) => str(row.id));
      templateLookupIncomplete =
        typeof lookup.count === "number" && lookup.count > templateIds.length;
    }

    const offset = (filters.page - 1) * filters.pageSize;
    let query = applyStatsFilters(
      supabase.from("campaign_stats").select(STATS_COLUMNS, { count: "exact" }),
      filters,
    );
    if (templateIds) query = query.in("campaign_id", templateIds);

    const { data, error, count } = await query
      .order(CAMPAIGN_SORT_COLUMN[filters.sortId], {
        ascending: filters.sortAsc,
        nullsFirst: false,
      })
      .order("campaign_id", { ascending: true })
      .range(offset, offset + filters.pageSize - 1);

    if (error) throw error;

    const statRows = (data ?? []) as unknown as StatsRecord[];
    const clientIds = [...new Set(statRows.map((row) => str(row.client_id)))].filter(
      Boolean,
    );
    const seriesIds = [
      ...new Set(statRows.map((row) => nullableStr(row.series_id))),
    ].filter((value): value is string => Boolean(value));

    const [clients, series] = await Promise.all([
      clientIds.length
        ? supabase.from("clients").select("id, name, slug").in("id", clientIds)
        : Promise.resolve({ data: [], error: null }),
      seriesIds.length
        ? supabase.from("report_series").select("id, name").in("id", seriesIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (clients.error) throw clients.error;
    if (series.error) throw series.error;

    const clientById = new Map<string, { name: string; slug: string }>();
    for (const row of (clients.data ?? []) as unknown as StatsRecord[]) {
      clientById.set(str(row.id), { name: str(row.name), slug: str(row.slug) });
    }
    const seriesById = new Map<string, string>();
    for (const row of (series.data ?? []) as unknown as StatsRecord[]) {
      seriesById.set(str(row.id), str(row.name));
    }

    const rows: CampaignListRow[] = statRows.map((row) => {
      const clientId = str(row.client_id);
      const seriesId = nullableStr(row.series_id);
      const client = clientById.get(clientId);
      return {
        id: str(row.campaign_id),
        reportNumber: nullableStr(row.report_number),
        title: str(row.title),
        clientId,
        clientName: client?.name ?? null,
        clientSlug: client?.slug ?? null,
        seriesId,
        seriesName: seriesId ? (seriesById.get(seriesId) ?? null) : null,
        status: toStatus(row.status),
        isTest: Boolean(row.is_test),
        sentAt: nullableStr(row.sent_at),
        stats: toStats(row),
      };
    });

    return {
      ok: true,
      data: {
        rows,
        total: typeof count === "number" ? count : rows.length,
        page: filters.page,
        pageSize: filters.pageSize,
        templateLookupIncomplete,
      },
    };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

/* ── Facets ───────────────────────────────────────────────────────────────── */

export type CampaignFacets = {
  clients: { id: string; name: string }[];
  series: { id: string; name: string; clientId: string }[];
  templates: string[];
};

export async function getCampaignFacets(): Promise<QueryResult<CampaignFacets>> {
  try {
    const supabase = await db();
    const [clients, series, templates] = await Promise.all([
      supabase.from("clients").select("id, name").order("name").limit(MAX_ROWS),
      supabase
        .from("report_series")
        .select("id, name, client_id")
        .order("name")
        .limit(MAX_ROWS),
      supabase.from("campaigns").select("template_key").limit(MAX_ROWS),
    ]);
    if (clients.error) throw clients.error;
    if (series.error) throw series.error;
    if (templates.error) throw templates.error;

    const templateKeys = [
      ...new Set(
        ((templates.data ?? []) as unknown as StatsRecord[])
          .map((row) => str(row.template_key))
          .filter(Boolean),
      ),
    ].sort();

    return {
      ok: true,
      data: {
        clients: ((clients.data ?? []) as unknown as StatsRecord[]).map((row) => ({
          id: str(row.id),
          name: str(row.name),
        })),
        series: ((series.data ?? []) as unknown as StatsRecord[]).map((row) => ({
          id: str(row.id),
          name: str(row.name),
          clientId: str(row.client_id),
        })),
        templates: templateKeys,
      },
    };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

/* ── Detail ───────────────────────────────────────────────────────────────── */

export type CampaignDetail = {
  id: string;
  reportNumber: string | null;
  title: string;
  subject: string;
  periodLabel: string;
  bodyMd: string;
  templateKey: string;
  reportUrl: string | null;
  attachmentName: string | null;
  attachmentUrl: string | null;
  feedbackEnabled: boolean;
  feedbackQuestion: string;
  status: CampaignStatus;
  isTest: boolean;
  scheduledFor: string | null;
  sentAt: string | null;
  createdAt: string;
  client: { id: string; name: string; slug: string };
  series: { id: string; name: string; frequency: string } | null;
  sender: { id: string; fullName: string; email: string } | null;
  stats: CampaignStats | null;
};

export async function getCampaign(
  id: string,
): Promise<QueryResult<CampaignDetail | null>> {
  try {
    const supabase = await db();
    const { data, error } = await supabase
      .from("campaigns")
      .select(
        "id, client_id, series_id, report_number, title, period_label, subject, body_md, " +
          "template_key, report_url, attachment_name, attachment_url, feedback_enabled, " +
          "feedback_question, status, is_test, scheduled_for, sent_at, created_by, created_at, " +
          "clients ( id, name, slug ), " +
          "report_series ( id, name, frequency ), " +
          "profiles ( id, full_name, email )",
      )
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ok: true, data: null };

    const row = data as unknown as StatsRecord;
    const clientRow = (row.clients ?? null) as StatsRecord | null;
    const seriesRow = (row.report_series ?? null) as StatsRecord | null;
    const senderRow = (row.profiles ?? null) as StatsRecord | null;

    const stats = await supabase
      .from("campaign_stats")
      .select(STATS_COLUMNS)
      .eq("campaign_id", id)
      .maybeSingle();

    return {
      ok: true,
      data: {
        id: str(row.id),
        reportNumber: nullableStr(row.report_number),
        title: str(row.title),
        subject: str(row.subject),
        periodLabel: str(row.period_label),
        bodyMd: str(row.body_md),
        templateKey: str(row.template_key),
        reportUrl: nullableStr(row.report_url),
        attachmentName: nullableStr(row.attachment_name),
        attachmentUrl: nullableStr(row.attachment_url),
        feedbackEnabled: Boolean(row.feedback_enabled),
        feedbackQuestion: str(row.feedback_question),
        status: toStatus(row.status),
        isTest: Boolean(row.is_test),
        scheduledFor: nullableStr(row.scheduled_for),
        sentAt: nullableStr(row.sent_at),
        createdAt: str(row.created_at),
        client: {
          id: str(clientRow?.id ?? row.client_id),
          name: str(clientRow?.name),
          slug: str(clientRow?.slug),
        },
        series: seriesRow
          ? {
              id: str(seriesRow.id),
              name: str(seriesRow.name),
              frequency: str(seriesRow.frequency),
            }
          : null,
        sender: senderRow
          ? {
              id: str(senderRow.id),
              fullName: str(senderRow.full_name),
              email: str(senderRow.email),
            }
          : null,
        // A stats failure is not a campaign failure: the header still renders
        // and the funnel states that it could not be measured.
        stats:
          stats.error || !stats.data ? null : toStats(stats.data as unknown as StatsRecord),
      },
    };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

/* ── Recipients ───────────────────────────────────────────────────────────── */

export type RecipientRow = {
  recipientId: string;
  email: string;
  fullName: string;
  isInternal: boolean;
  delivered: boolean;
  deliveredAt: string | null;
  bounced: boolean;
  bouncedAt: string | null;
  bounceReason: string | null;
  opened: boolean;
  firstOpenedAt: string | null;
  clicked: boolean;
  rating: number | null;
  comment: string | null;
};

export type RecipientList = {
  rows: RecipientRow[];
  /** True total from the server, even when the fetch hit the row ceiling. */
  total: number;
  incomplete: boolean;
};

export async function listCampaignRecipients(
  campaignId: string,
): Promise<QueryResult<RecipientList>> {
  try {
    const supabase = await db();
    const [engagement, delivery] = await Promise.all([
      supabase
        .from("recipient_engagement")
        .select(
          "recipient_id, email, full_name, is_internal, delivered, bounced, opened, " +
            "clicked, first_opened_at, rating, comment",
          { count: "exact" },
        )
        .eq("campaign_id", campaignId)
        .order("is_internal", { ascending: true })
        .order("full_name", { ascending: true })
        .range(0, MAX_ROWS - 1),
      supabase
        .from("campaign_recipients")
        .select("id, delivered_at, bounced_at, bounce_reason")
        .eq("campaign_id", campaignId)
        .range(0, MAX_ROWS - 1),
    ]);

    if (engagement.error) throw engagement.error;
    if (delivery.error) throw delivery.error;

    const deliveryById = new Map<string, StatsRecord>();
    for (const row of (delivery.data ?? []) as unknown as StatsRecord[]) {
      deliveryById.set(str(row.id), row);
    }

    const rows: RecipientRow[] = ((engagement.data ?? []) as unknown as StatsRecord[]).map(
      (row) => {
        const id = str(row.recipient_id);
        const timestamps = deliveryById.get(id);
        return {
          recipientId: id,
          email: str(row.email),
          fullName: str(row.full_name),
          isInternal: Boolean(row.is_internal),
          delivered: Boolean(row.delivered),
          deliveredAt: nullableStr(timestamps?.delivered_at),
          bounced: Boolean(row.bounced),
          bouncedAt: nullableStr(timestamps?.bounced_at),
          bounceReason: nullableStr(timestamps?.bounce_reason),
          opened: Boolean(row.opened),
          firstOpenedAt: nullableStr(row.first_opened_at),
          clicked: Boolean(row.clicked),
          rating: nullableNum(row.rating),
          comment: nullableStr(row.comment),
        };
      },
    );

    const total = typeof engagement.count === "number" ? engagement.count : rows.length;
    return {
      ok: true,
      data: { rows, total, incomplete: total > rows.length },
    };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

/* ── Activity ─────────────────────────────────────────────────────────────── */

export type ActivityKind =
  | "created"
  | "scheduled"
  | "sent"
  | "delivered"
  | "bounced"
  | "open"
  | "click"
  | "unsubscribe"
  | "rating";

export type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  occurredAt: string;
  /** The person the event belongs to, where there is one. */
  who: string | null;
  isInternal: boolean;
  detail: string | null;
};

const EVENT_KINDS: Record<string, ActivityKind> = {
  delivered: "delivered",
  bounced: "bounced",
  open: "open",
  click: "click",
  unsubscribe: "unsubscribe",
};

export type CampaignActivity = {
  entries: ActivityEntry[];
  total: number;
  incomplete: boolean;
};

export async function listCampaignActivity(
  campaign: CampaignDetail,
): Promise<QueryResult<CampaignActivity>> {
  try {
    const supabase = await db();
    const [events, feedback] = await Promise.all([
      supabase
        .from("email_events")
        .select(
          "id, type, occurred_at, campaign_recipients ( email, full_name, is_internal )",
          { count: "exact" },
        )
        .eq("campaign_id", campaign.id)
        .order("occurred_at", { ascending: false })
        .range(0, MAX_ROWS - 1),
      supabase
        .from("feedback")
        .select(
          "id, rating, comment, created_at, campaign_recipients ( email, full_name, is_internal )",
          { count: "exact" },
        )
        .eq("campaign_id", campaign.id)
        .order("created_at", { ascending: false })
        .range(0, MAX_ROWS - 1),
    ]);

    if (events.error) throw events.error;
    if (feedback.error) throw feedback.error;

    const entries: ActivityEntry[] = [];

    for (const row of (events.data ?? []) as unknown as StatsRecord[]) {
      const person = (row.campaign_recipients ?? null) as StatsRecord | null;
      const kind = EVENT_KINDS[str(row.type)];
      if (!kind) continue;
      entries.push({
        id: `event-${str(row.id) || String(row.id)}`,
        kind,
        occurredAt: str(row.occurred_at),
        who: nullableStr(person?.full_name) ?? nullableStr(person?.email),
        isInternal: Boolean(person?.is_internal),
        detail: nullableStr(person?.email),
      });
    }

    for (const row of (feedback.data ?? []) as unknown as StatsRecord[]) {
      const person = (row.campaign_recipients ?? null) as StatsRecord | null;
      const rating = nullableNum(row.rating);
      entries.push({
        id: `feedback-${str(row.id)}`,
        kind: "rating",
        occurredAt: str(row.created_at),
        who: nullableStr(person?.full_name) ?? nullableStr(person?.email),
        isInternal: Boolean(person?.is_internal),
        detail:
          rating === null
            ? null
            : `${rating} of 5${nullableStr(row.comment) ? ` — “${str(row.comment)}”` : ""}`,
      });
    }

    // The lifecycle of the campaign itself, from its own columns.
    entries.push({
      id: "campaign-created",
      kind: "created",
      occurredAt: campaign.createdAt,
      who: campaign.sender?.fullName || campaign.sender?.email || null,
      isInternal: true,
      detail: campaign.reportNumber,
    });
    if (campaign.scheduledFor) {
      entries.push({
        id: "campaign-scheduled",
        kind: "scheduled",
        occurredAt: campaign.scheduledFor,
        who: campaign.sender?.fullName || campaign.sender?.email || null,
        isInternal: true,
        detail: null,
      });
    }
    if (campaign.sentAt) {
      entries.push({
        id: "campaign-sent",
        kind: "sent",
        occurredAt: campaign.sentAt,
        who: campaign.sender?.fullName || campaign.sender?.email || null,
        isInternal: true,
        detail: campaign.stats
          ? `${campaign.stats.recipients_external} external recipients`
          : null,
      });
    }

    entries.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));

    const fetched = (events.data ?? []).length + (feedback.data ?? []).length;
    const serverTotal =
      (typeof events.count === "number" ? events.count : 0) +
      (typeof feedback.count === "number" ? feedback.count : 0);

    return {
      ok: true,
      data: {
        entries,
        total: entries.length + Math.max(0, serverTotal - fetched),
        incomplete: serverTotal > fetched,
      },
    };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

/* ── Engagement timeline ──────────────────────────────────────────────────── */

export type TimelinePoint = { day: string; opens: number; clicks: number };

/**
 * Opens and clicks bucketed by day. This is time-bucketing of the event log,
 * not a re-definition of engagement — the deduplicated per-recipient truth is
 * still `recipient_engagement`, and the funnel above reads it.
 */
export function timelineOf(entries: ActivityEntry[]): TimelinePoint[] {
  const byDay = new Map<string, TimelinePoint>();
  for (const entry of entries) {
    if (entry.kind !== "open" && entry.kind !== "click") continue;
    if (entry.isInternal) continue;
    const day = entry.occurredAt.slice(0, 10);
    if (!day) continue;
    const point = byDay.get(day) ?? { day, opens: 0, clicks: 0 };
    if (entry.kind === "open") point.opens += 1;
    else point.clicks += 1;
    byDay.set(day, point);
  }
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
}
