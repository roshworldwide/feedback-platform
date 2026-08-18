/**
 * Feedback vocabulary — the bands, the filter shape, the URL.
 *
 * A leaf module with no server imports, so the filter rail (a client
 * component) and the query in `page.tsx` (server) share one definition of what
 * "low" means instead of drifting apart the way v1's labels and v1's
 * arithmetic did.
 */

export const RATING_BANDS = [
  { value: "high", label: "4 and 5 stars", min: 4, max: 5 },
  { value: "mid", label: "3 stars", min: 3, max: 3 },
  { value: "low", label: "1 and 2 stars", min: 1, max: 2 },
] as const;

export type RatingBand = (typeof RATING_BANDS)[number]["value"];

export function bandRange(band: RatingBand): { min: number; max: number } {
  const found = RATING_BANDS.find((item) => item.value === band);
  return found ? { min: found.min, max: found.max } : { min: 1, max: 5 };
}

export const SENTIMENTS = ["positive", "neutral", "critical"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const FEEDBACK_PAGE_SIZE = 20;

/** How many ratings the summary panel reads before it states its own ceiling. */
export const FEEDBACK_SUMMARY_LIMIT = 5000;

export type FeedbackFilters = {
  band: RatingBand | null;
  clientId: string | null;
  seriesId: string | null;
  campaignId: string | null;
  /** `YYYY-MM-DD`, on the day the rating was given. */
  from: string | null;
  to: string | null;
  hasComment: boolean;
  unreviewedOnly: boolean;
  /** Test sends are excluded by default, and the exclusion is stated. */
  includeTest: boolean;
  page: number;
};

export const EMPTY_FEEDBACK_FILTERS: FeedbackFilters = {
  band: null,
  clientId: null,
  seriesId: null,
  campaignId: null,
  from: null,
  to: null,
  hasComment: false,
  unreviewedOnly: false,
  includeTest: false,
  page: 1,
};

export type SearchParams = Record<string, string | string[] | undefined>;

export function firstParam(params: SearchParams, key: string): string | null {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function parseFeedbackFilters(params: SearchParams): FeedbackFilters {
  const band = firstParam(params, "band");
  const page = Number(firstParam(params, "page") ?? 1);

  return {
    band: RATING_BANDS.find((item) => item.value === band)?.value ?? null,
    clientId: firstParam(params, "client"),
    seriesId: firstParam(params, "series"),
    campaignId: firstParam(params, "campaign"),
    from: firstParam(params, "from"),
    to: firstParam(params, "to"),
    hasComment: firstParam(params, "comment") === "1",
    unreviewedOnly: firstParam(params, "unreviewed") === "1",
    includeTest: firstParam(params, "test") === "1",
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
  };
}

export function hasActiveFeedbackFilters(filters: FeedbackFilters): boolean {
  return Boolean(
    filters.band ||
      filters.clientId ||
      filters.seriesId ||
      filters.campaignId ||
      filters.from ||
      filters.to ||
      filters.hasComment ||
      filters.unreviewedOnly ||
      filters.includeTest,
  );
}

/**
 * The address for a filter set. Any change except an explicit page returns to
 * page 1: silently holding page 7 of a set that now has two is how a list
 * appears to be empty.
 */
export function feedbackQueryString(
  filters: FeedbackFilters,
  patch: Partial<FeedbackFilters> = {},
): string {
  const next: FeedbackFilters = {
    ...filters,
    ...patch,
    page: patch.page ?? (Object.keys(patch).length > 0 ? 1 : filters.page),
  };
  const params = new URLSearchParams();
  if (next.band) params.set("band", next.band);
  if (next.clientId) params.set("client", next.clientId);
  if (next.seriesId) params.set("series", next.seriesId);
  if (next.campaignId) params.set("campaign", next.campaignId);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.hasComment) params.set("comment", "1");
  if (next.unreviewedOnly) params.set("unreviewed", "1");
  if (next.includeTest) params.set("test", "1");
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** What the current filter set excludes, stated in words. Never silent. */
export function feedbackExclusionCaption(filters: FeedbackFilters): string {
  const parts: string[] = [
    "Ratings from internal recipients are always excluded from this inbox",
  ];
  parts.push(
    filters.includeTest
      ? "test sends are included"
      : "ratings given on test sends are excluded",
  );
  if (filters.unreviewedOnly) parts.push("only unreviewed ratings are shown");
  if (filters.hasComment) parts.push("only ratings with a written comment are shown");
  return `${parts.join(", ")}.`;
}

export type TriageState = { ok: boolean; message: string | null };

export const IDLE_TRIAGE: TriageState = { ok: true, message: null };
