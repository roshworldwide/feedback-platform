import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { MessageSquareQuote } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { averageRating, ratingDistribution } from "@/lib/metrics";
import { recordAudit } from "@/lib/audit";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { fmtInt } from "@/lib/utils";
import { LoadError } from "@/components/overview/load-error";
import { loadClients, type Loaded } from "@/app/(app)/overview/data";
import { dayKey, dayLabel } from "@/app/(app)/overview/periods";
import {
  FeedbackFilterRail,
  type FeedbackFacets,
} from "@/components/feedback/filter-rail";
import {
  FeedbackCard,
  type InboxRow,
  type Person,
} from "@/components/feedback/feedback-card";
import {
  FeedbackSummaryPanel,
  type Breakdown,
  type TrendPoint,
} from "@/components/feedback/summary-panel";
import {
  FEEDBACK_PAGE_SIZE,
  FEEDBACK_SUMMARY_LIMIT,
  bandRange,
  feedbackQueryString,
  parseFeedbackFilters,
  SENTIMENTS,
  type FeedbackFilters,
  type SearchParams,
  type Sentiment,
  type TriageState,
} from "@/components/feedback/vocabulary";

export const metadata: Metadata = {
  title: "Feedback",
  description:
    "Every rating and comment, each shown with the report it was given for.",
};

/* ── Shape helpers — PostgREST hands numerics back as number or string ────── */

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "The database did not respond.";
}

function sentimentOf(value: unknown): Sentiment | null {
  const found = SENTIMENTS.find((item) => item === value);
  return found ?? null;
}

/** The end of the chosen day, so "rated to 12 Aug" includes the 12th. */
function endOfDayIso(day: string): string | null {
  const parsed = new Date(`${day}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getTime() + 86_400_000).toISOString();
}

function startOfDayIso(day: string): string | null {
  const parsed = new Date(`${day}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * One filter set, applied identically to the feed and to the summary, so the
 * panel on the right always describes exactly the rows on the left.
 *
 * Internal recipients are excluded unconditionally in both queries: an
 * @convin.ai colleague rating our own report is not client satisfaction, and
 * counting them is what made v1's average meaningless.
 */
const FEED_SELECT =
  "id, rating, comment, sentiment, reviewed_at, reviewed_by, assigned_to, internal_note, created_at, " +
  "campaigns!inner(id, report_number, title, client_id, series_id, is_test), " +
  "campaign_recipients!inner(full_name, email, is_internal)";

const SUMMARY_SELECT =
  "rating, created_at, campaigns!inner(client_id, series_id, is_test), " +
  "campaign_recipients!inner(is_internal)";

type FeedPage = { rows: InboxRow[]; total: number };

async function loadFeed(
  supabase: Db,
  filters: FeedbackFilters,
  clientNames: Record<string, string>,
  peopleNames: Record<string, string>,
): Promise<Loaded<FeedPage>> {
  try {
    let request = supabase
      .from("feedback")
      .select(FEED_SELECT, { count: "exact" })
      .eq("campaign_recipients.is_internal", false)
      .order("created_at", { ascending: false })
      .range(
        (filters.page - 1) * FEEDBACK_PAGE_SIZE,
        filters.page * FEEDBACK_PAGE_SIZE - 1,
      );

    if (!filters.includeTest) request = request.eq("campaigns.is_test", false);
    if (filters.band) {
      const range = bandRange(filters.band);
      request = request.gte("rating", range.min).lte("rating", range.max);
    }
    if (filters.clientId) request = request.eq("campaigns.client_id", filters.clientId);
    if (filters.seriesId) request = request.eq("campaigns.series_id", filters.seriesId);
    if (filters.campaignId) request = request.eq("campaign_id", filters.campaignId);
    if (filters.from) {
      const from = startOfDayIso(filters.from);
      if (from) request = request.gte("created_at", from);
    }
    if (filters.to) {
      const to = endOfDayIso(filters.to);
      if (to) request = request.lt("created_at", to);
    }
    if (filters.hasComment) request = request.not("comment", "is", null);
    if (filters.unreviewedOnly) request = request.is("reviewed_at", null);

    const { data, error, count } = await request;
    if (error) return { ok: false, message: error.message };

    const raw = (data ?? []) as unknown as Record<string, unknown>[];
    const rows: InboxRow[] = raw.map((row) => {
      const campaign = one(
        row.campaigns as Record<string, unknown> | Record<string, unknown>[] | null,
      );
      const recipient = one(
        row.campaign_recipients as
          | Record<string, unknown>
          | Record<string, unknown>[]
          | null,
      );
      const reportNumber = textOrNull(campaign?.report_number);
      const title = text(campaign?.title);
      const clientId = textOrNull(campaign?.client_id);
      const assignedTo = textOrNull(row.assigned_to);
      const reviewedBy = textOrNull(row.reviewed_by);

      return {
        id: text(row.id),
        rating: num(row.rating),
        comment: textOrNull(row.comment),
        sentiment: sentimentOf(row.sentiment),
        createdAt: textOrNull(row.created_at),
        reviewedAt: textOrNull(row.reviewed_at),
        reviewedByName: reviewedBy ? (peopleNames[reviewedBy] ?? null) : null,
        assignedTo,
        assignedToName: assignedTo ? (peopleNames[assignedTo] ?? null) : null,
        note: textOrNull(row.internal_note),
        author:
          textOrNull(recipient?.full_name) ??
          textOrNull(recipient?.email) ??
          "Unnamed recipient",
        campaignId: textOrNull(campaign?.id),
        campaignLabel: reportNumber ? `${reportNumber} · ${title}` : title,
        clientName: clientId ? (clientNames[clientId] ?? null) : null,
        isTest: campaign?.is_test === true,
      };
    });

    return { ok: true, value: { rows, total: count ?? rows.length } };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

type SummaryScanRow = {
  rating: number;
  createdAt: string | null;
  clientId: string | null;
  seriesId: string | null;
};

type SummaryScan = { rows: SummaryScanRow[]; total: number; truncated: boolean };

async function loadSummary(
  supabase: Db,
  filters: FeedbackFilters,
): Promise<Loaded<SummaryScan>> {
  try {
    let request = supabase
      .from("feedback")
      .select(SUMMARY_SELECT, { count: "exact" })
      .eq("campaign_recipients.is_internal", false)
      .order("created_at", { ascending: false })
      .range(0, FEEDBACK_SUMMARY_LIMIT - 1);

    if (!filters.includeTest) request = request.eq("campaigns.is_test", false);
    if (filters.band) {
      const range = bandRange(filters.band);
      request = request.gte("rating", range.min).lte("rating", range.max);
    }
    if (filters.clientId) request = request.eq("campaigns.client_id", filters.clientId);
    if (filters.seriesId) request = request.eq("campaigns.series_id", filters.seriesId);
    if (filters.campaignId) request = request.eq("campaign_id", filters.campaignId);
    if (filters.from) {
      const from = startOfDayIso(filters.from);
      if (from) request = request.gte("created_at", from);
    }
    if (filters.to) {
      const to = endOfDayIso(filters.to);
      if (to) request = request.lt("created_at", to);
    }
    if (filters.hasComment) request = request.not("comment", "is", null);
    if (filters.unreviewedOnly) request = request.is("reviewed_at", null);

    const { data, error, count } = await request;
    if (error) return { ok: false, message: error.message };

    const raw = (data ?? []) as unknown as Record<string, unknown>[];
    const rows: SummaryScanRow[] = raw.map((row) => {
      const campaign = one(
        row.campaigns as Record<string, unknown> | Record<string, unknown>[] | null,
      );
      return {
        rating: num(row.rating),
        createdAt: textOrNull(row.created_at),
        clientId: textOrNull(campaign?.client_id),
        seriesId: textOrNull(campaign?.series_id),
      };
    });

    const total = count ?? rows.length;
    return { ok: true, value: { rows, total, truncated: total > rows.length } };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

type SeriesRow = { id: string; name: string; clientId: string };

async function loadSeries(supabase: Db): Promise<Loaded<SeriesRow[]>> {
  try {
    const { data, error } = await supabase
      .from("report_series")
      .select("id, name, client_id")
      .order("name", { ascending: true });
    if (error) return { ok: false, message: error.message };
    const raw = (data ?? []) as unknown as Record<string, unknown>[];
    return {
      ok: true,
      value: raw.map((row) => ({
        id: text(row.id),
        name: text(row.name),
        clientId: text(row.client_id),
      })),
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

async function loadPeople(supabase: Db): Promise<Loaded<Person[]>> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, is_active")
      .eq("is_active", true)
      .order("full_name", { ascending: true });
    if (error) return { ok: false, message: error.message };
    const raw = (data ?? []) as unknown as Record<string, unknown>[];
    return {
      ok: true,
      value: raw.map((row) => ({
        id: text(row.id),
        name: textOrNull(row.full_name) ?? text(row.email),
      })),
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

/* ── Summaries over the scan ──────────────────────────────────────────────── */

function trendOfScan(rows: SummaryScanRow[]): TrendPoint[] {
  const byDay = new Map<string, { sum: number; count: number; date: Date }>();
  for (const row of rows) {
    if (!row.createdAt) continue;
    const date = new Date(row.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = dayKey(date);
    const bucket = byDay.get(key) ?? { sum: 0, count: 0, date };
    bucket.sum += row.rating;
    bucket.count += 1;
    byDay.set(key, bucket);
  }

  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([key, bucket]) => ({
      key,
      label: dayLabel(bucket.date),
      ratings: bucket.count,
      avg: Math.round((bucket.sum / bucket.count) * 100) / 100,
    }));
}

function breakdown(
  rows: SummaryScanRow[],
  pick: (row: SummaryScanRow) => string | null,
  names: Record<string, string>,
  unknownLabel: string,
): Breakdown[] {
  const groups = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const key = pick(row) ?? "—";
    const bucket = groups.get(key) ?? { sum: 0, count: 0 };
    bucket.sum += row.rating;
    bucket.count += 1;
    groups.set(key, bucket);
  }

  return [...groups.entries()]
    .map(([key, bucket]) => ({
      key,
      name: key === "—" ? unknownLabel : (names[key] ?? "Not resolved"),
      ratings: bucket.count,
      avg: Math.round((bucket.sum / bucket.count) * 100) / 100,
    }))
    .sort((a, b) => b.ratings - a.ratings)
    .slice(0, 8);
}

/* ── The screen ───────────────────────────────────────────────────────────── */

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = parseFeedbackFilters(params);

  /* ── Triage. Each action reports its own result and never swallows one. ─── */

  async function markReviewed(
    _state: TriageState,
    formData: FormData,
  ): Promise<TriageState> {
    "use server";
    const id = String(formData.get("id") ?? "");
    const reviewed = String(formData.get("reviewed") ?? "1") === "1";
    if (!id) {
      return { ok: false, message: "That rating could not be identified, so nothing changed." };
    }

    const profile = await getSessionProfile();
    if (!profile) {
      return { ok: false, message: "Your session has ended. Sign in again — nothing changed." };
    }

    const db = await createClient();
    const { error } = await db
      .from("feedback")
      .update({
        reviewed_at: reviewed ? new Date().toISOString() : null,
        reviewed_by: reviewed ? String(profile.id) : null,
      })
      .eq("id", id);
    if (error) return { ok: false, message: `Couldn't save that — ${error.message}` };

    await recordAudit({
      actorId: String(profile.id),
      actorEmail: String(profile.email),
      action: reviewed ? "feedback.reviewed" : "feedback.unreviewed",
      entityType: "feedback",
      entityId: id,
      summary: reviewed ? "Marked a rating reviewed" : "Marked a rating unreviewed",
    });

    revalidatePath("/feedback");
    return {
      ok: true,
      message: reviewed ? "Marked reviewed." : "Marked unreviewed.",
    };
  }

  async function assign(
    _state: TriageState,
    formData: FormData,
  ): Promise<TriageState> {
    "use server";
    const id = String(formData.get("id") ?? "");
    const assignee = String(formData.get("assignee") ?? "");
    if (!id) {
      return { ok: false, message: "That rating could not be identified, so nothing changed." };
    }

    const profile = await getSessionProfile();
    if (!profile) {
      return { ok: false, message: "Your session has ended. Sign in again — nothing changed." };
    }

    const db = await createClient();
    const { error } = await db
      .from("feedback")
      .update({ assigned_to: assignee === "" ? null : assignee })
      .eq("id", id);
    if (error) return { ok: false, message: `Couldn't assign that — ${error.message}` };

    await recordAudit({
      actorId: String(profile.id),
      actorEmail: String(profile.email),
      action: "feedback.assigned",
      entityType: "feedback",
      entityId: id,
      summary: assignee === "" ? "Cleared the assignee on a rating" : "Assigned a rating",
      diff: { assigned_to: assignee || null },
    });

    revalidatePath("/feedback");
    return {
      ok: true,
      message: assignee === "" ? "Assignment cleared." : "Assigned.",
    };
  }

  async function addNote(
    _state: TriageState,
    formData: FormData,
  ): Promise<TriageState> {
    "use server";
    const id = String(formData.get("id") ?? "");
    const note = String(formData.get("note") ?? "");
    if (!id) {
      return { ok: false, message: "That rating could not be identified, so nothing changed." };
    }

    const profile = await getSessionProfile();
    if (!profile) {
      return { ok: false, message: "Your session has ended. Sign in again — nothing changed." };
    }

    const db = await createClient();
    const { error } = await db
      .from("feedback")
      .update({ internal_note: note.trim() === "" ? null : note })
      .eq("id", id);
    if (error) return { ok: false, message: `Couldn't save the note — ${error.message}` };

    await recordAudit({
      actorId: String(profile.id),
      actorEmail: String(profile.email),
      action: "feedback.noted",
      entityType: "feedback",
      entityId: id,
      summary: "Wrote an internal note on a rating",
    });

    revalidatePath("/feedback");
    return { ok: true, message: "Note saved." };
  }

  /* ── Data ──────────────────────────────────────────────────────────────── */

  const supabase = await createClient();
  const [clients, series, people] = await Promise.all([
    loadClients(supabase),
    loadSeries(supabase),
    loadPeople(supabase),
  ]);

  const clientNames: Record<string, string> = {};
  if (clients.ok) {
    for (const client of clients.value) clientNames[client.clientId] = client.name;
  }
  const seriesNames: Record<string, string> = {};
  if (series.ok) {
    for (const item of series.value) seriesNames[item.id] = item.name;
  }
  const peopleNames: Record<string, string> = {};
  if (people.ok) {
    for (const person of people.value) peopleNames[person.id] = person.name;
  }

  const [feed, summary] = await Promise.all([
    loadFeed(supabase, filters, clientNames, peopleNames),
    loadSummary(supabase, filters),
  ]);

  const facets: FeedbackFacets = {
    clients: clients.ok
      ? clients.value.map((client) => ({ id: client.clientId, name: client.name }))
      : [],
    series: series.ok ? series.value : [],
  };
  const facetsReason = !clients.ok
    ? clients.message
    : !series.ok
      ? series.message
      : null;

  const campaignLabel =
    filters.campaignId && feed.ok
      ? (feed.value.rows.find((row) => row.campaignId === filters.campaignId)
          ?.campaignLabel ?? null)
      : null;

  const first = feed.ok
    ? feed.value.total === 0
      ? 0
      : (filters.page - 1) * FEEDBACK_PAGE_SIZE + 1
    : 0;
  const last =
    feed.ok && first > 0 ? first + feed.value.rows.length - 1 : 0;
  const pageCount = feed.ok
    ? Math.max(1, Math.ceil(feed.value.total / FEEDBACK_PAGE_SIZE))
    : 1;

  return (
    <div
      className="grid lg:grid-cols-[260px_minmax(0,1fr)_300px]"
      style={{ gap: "var(--space-6)", alignItems: "start" }}
    >
      <FeedbackFilterRail
        filters={filters}
        facets={facets}
        facetsReason={facetsReason}
        campaignLabel={campaignLabel}
      />

      <section aria-label="Feedback" className="flex flex-col" style={{ gap: "var(--space-4)" }}>
        {feed.ok ? (
          <>
            <p
              className="t-footnote tabular"
              style={{ margin: 0, color: "var(--content-secondary)" }}
            >
              Showing {first}&ndash;{last} of {fmtInt(feed.value.total)}
            </p>

            {feed.value.rows.length === 0 ? (
              <EmptyState
                icon={<MessageSquareQuote size={22} strokeWidth={1.5} />}
                title="No rating matches these filters"
                description="Nothing here is hidden — the filters in the rail simply exclude every rating in the inbox. Clear one and the feed fills again."
              />
            ) : (
              <ul
                className="flex flex-col"
                style={{ gap: "var(--space-4)", margin: 0, padding: 0, listStyle: "none" }}
              >
                {feed.value.rows.map((row) => (
                  <FeedbackCard
                    key={row.id}
                    row={row}
                    people={people.ok ? people.value : []}
                    markReviewed={markReviewed}
                    assign={assign}
                    addNote={addNote}
                  />
                ))}
              </ul>
            )}

            {pageCount > 1 ? (
              <nav
                aria-label="Feedback pages"
                className="flex items-center justify-between"
                style={{ gap: "var(--space-3)" }}
              >
                {filters.page > 1 ? (
                  <Link
                    href={`/feedback${feedbackQueryString(filters, { page: filters.page - 1 })}`}
                    className="t-footnote"
                    style={{
                      color: "var(--content-accent)",
                      textDecoration: "none",
                      lineHeight: "44px",
                    }}
                  >
                    Previous
                  </Link>
                ) : (
                  <span />
                )}
                <span
                  className="t-footnote tabular"
                  style={{ color: "var(--content-secondary)" }}
                >
                  Page {filters.page} of {pageCount}
                </span>
                {filters.page < pageCount ? (
                  <Link
                    href={`/feedback${feedbackQueryString(filters, { page: filters.page + 1 })}`}
                    className="t-footnote"
                    style={{
                      color: "var(--content-accent)",
                      textDecoration: "none",
                      lineHeight: "44px",
                    }}
                  >
                    Next
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </>
        ) : (
          <LoadError what="the feedback inbox" message={feed.message} />
        )}
      </section>

      {summary.ok ? (
        <FeedbackSummaryPanel
          average={averageRating(summary.value.rows.map((row) => row.rating))}
          ratings={summary.value.total}
          distribution={ratingDistribution(summary.value.rows.map((row) => row.rating))}
          trend={trendOfScan(summary.value.rows)}
          byClient={breakdown(
            summary.value.rows,
            (row) => row.clientId,
            clientNames,
            "No client on the report",
          )}
          bySeries={breakdown(
            summary.value.rows,
            (row) => row.seriesId,
            seriesNames,
            "Not part of a series",
          )}
          truncated={summary.value.truncated}
          scanLimit={FEEDBACK_SUMMARY_LIMIT}
        />
      ) : (
        <LoadError what="the summary" message={summary.message} />
      )}
    </div>
  );
}
