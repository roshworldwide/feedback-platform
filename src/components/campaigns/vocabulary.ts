/**
 * Campaign vocabulary — the words, the bands, the URL shape.
 *
 * A leaf module on purpose: it has no server imports, so the filter bar (a
 * client component) and the query layer (a server module) can share one
 * definition of what a status is and what "at risk" means, instead of drifting
 * apart the way v1's label and v1's arithmetic did.
 */

export const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "failed",
  "cancelled",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const RATING_BANDS = [
  { value: "high", label: "4.5 and above", min: 4.5, max: null },
  { value: "good", label: "4.0 to 4.4", min: 4, max: 4.5 },
  { value: "fair", label: "3.5 to 3.9", min: 3.5, max: 4 },
  { value: "low", label: "Below 3.5", min: null, max: 3.5 },
  { value: "none", label: "No ratings yet", min: null, max: null },
] as const;

export type RatingBand = (typeof RATING_BANDS)[number]["value"];

export type OpenedFilter = "opened" | "not-opened";

export const OPENED_LABEL: Record<OpenedFilter, string> = {
  opened: "Opened by someone",
  "not-opened": "Not opened by anyone",
};

export const CAMPAIGN_PAGE_SIZES = [10, 25, 50, 100] as const;

/** Table column id → the `campaign_stats` column it orders by. */
export const CAMPAIGN_SORT_COLUMN = {
  dl: "report_number",
  title: "title",
  client: "client_id",
  series: "series_id",
  sent: "sent_at",
  recipients: "recipients_external",
  delivered: "delivered",
  open: "unique_opens",
  click: "unique_clicks",
  rating: "avg_rating",
  status: "status",
} as const;

export type CampaignSortId = keyof typeof CAMPAIGN_SORT_COLUMN;

export type CampaignFilters = {
  q: string;
  clientId: string | null;
  seriesId: string | null;
  status: CampaignStatus | null;
  templateKey: string | null;
  from: string | null;
  to: string | null;
  band: RatingBand | null;
  opened: OpenedFilter | null;
  /** Test sends are excluded by default; turning them on is stated on screen. */
  includeTest: boolean;
  page: number;
  pageSize: number;
  sortId: CampaignSortId;
  sortAsc: boolean;
};

export type SearchParams = Record<string, string | string[] | undefined>;

export function firstParam(params: SearchParams, key: string): string | null {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export const DEFAULT_CAMPAIGN_PAGE_SIZE = 25;

export function parseCampaignFilters(params: SearchParams): CampaignFilters {
  const status = firstParam(params, "status");
  const band = firstParam(params, "band");
  const opened = firstParam(params, "opened");
  const sortId = firstParam(params, "sort");
  const pageSize = Number(firstParam(params, "size") ?? DEFAULT_CAMPAIGN_PAGE_SIZE);
  const page = Number(firstParam(params, "page") ?? 1);

  return {
    q: firstParam(params, "q") ?? "",
    clientId: firstParam(params, "client"),
    seriesId: firstParam(params, "series"),
    status: CAMPAIGN_STATUSES.find((item) => item === status) ?? null,
    templateKey: firstParam(params, "template"),
    from: firstParam(params, "from"),
    to: firstParam(params, "to"),
    band: RATING_BANDS.find((item) => item.value === band)?.value ?? null,
    opened: opened === "opened" || opened === "not-opened" ? opened : null,
    includeTest: firstParam(params, "test") === "1",
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    pageSize: (CAMPAIGN_PAGE_SIZES as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_CAMPAIGN_PAGE_SIZE,
    sortId:
      sortId && sortId in CAMPAIGN_SORT_COLUMN ? (sortId as CampaignSortId) : "sent",
    sortAsc: firstParam(params, "dir") === "asc",
  };
}

export function hasActiveCampaignFilters(filters: CampaignFilters): boolean {
  return Boolean(
    filters.q ||
      filters.clientId ||
      filters.seriesId ||
      filters.status ||
      filters.templateKey ||
      filters.from ||
      filters.to ||
      filters.band ||
      filters.opened ||
      filters.includeTest,
  );
}

export const EMPTY_CAMPAIGN_FILTERS: CampaignFilters = {
  q: "",
  clientId: null,
  seriesId: null,
  status: null,
  templateKey: null,
  from: null,
  to: null,
  band: null,
  opened: null,
  includeTest: false,
  page: 1,
  pageSize: DEFAULT_CAMPAIGN_PAGE_SIZE,
  sortId: "sent",
  sortAsc: false,
};

/**
 * The query string for a filter set. Only what differs from the default is
 * written, so a shared URL says what it means and nothing more.
 *
 * Any patch except an explicit page change returns to page 1: silently holding
 * page 7 of a set that now has two pages is how a list appears to be empty.
 */
export function campaignQueryString(
  filters: CampaignFilters,
  patch: Partial<CampaignFilters> = {},
): string {
  const next: CampaignFilters = {
    ...filters,
    ...patch,
    page: patch.page ?? (Object.keys(patch).length > 0 ? 1 : filters.page),
  };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.clientId) params.set("client", next.clientId);
  if (next.seriesId) params.set("series", next.seriesId);
  if (next.status) params.set("status", next.status);
  if (next.templateKey) params.set("template", next.templateKey);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.band) params.set("band", next.band);
  if (next.opened) params.set("opened", next.opened);
  if (next.includeTest) params.set("test", "1");
  if (next.page > 1) params.set("page", String(next.page));
  if (next.pageSize !== DEFAULT_CAMPAIGN_PAGE_SIZE)
    params.set("size", String(next.pageSize));
  if (next.sortId !== "sent") params.set("sort", next.sortId);
  if (next.sortAsc) params.set("dir", "asc");
  const query = params.toString();
  return query ? `?${query}` : "";
}
