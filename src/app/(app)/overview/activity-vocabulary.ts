/**
 * URL state for the Email Activity table and the three drill-down panels.
 *
 * Kept out of any "use client" module deliberately: `page.tsx` needs to parse
 * these while resolving `searchParams`, and every export of a "use client"
 * file becomes an opaque client reference that a Server Component cannot
 * call — see settings-tabs-shared.ts for the same fix applied there.
 */

import type {
  EmailActivityEngagement,
  EmailActivityQuery,
  EmailActivitySortId,
} from "./data";
import { DEFAULT_EMAIL_ACTIVITY_PAGE_SIZE } from "./data";

type SearchParams = Record<string, string | string[] | undefined>;

function first(params: SearchParams, key: string): string | null {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

const SORT_IDS: readonly EmailActivitySortId[] = ["sent_at", "rating"];
const ENGAGEMENT_VALUES: readonly EmailActivityEngagement[] = [
  "all",
  "responded",
  "not_opened",
];

export function emailActivitySortIdFrom(value: unknown): EmailActivitySortId {
  return SORT_IDS.includes(value as EmailActivitySortId)
    ? (value as EmailActivitySortId)
    : "sent_at";
}

export function emailActivityEngagementFrom(value: unknown): EmailActivityEngagement {
  return ENGAGEMENT_VALUES.includes(value as EmailActivityEngagement)
    ? (value as EmailActivityEngagement)
    : "all";
}

export function emailActivityQueryFrom(params: SearchParams): EmailActivityQuery {
  const page = Number(first(params, "activityPage") ?? 1);
  const pageSize = Number(first(params, "activitySize") ?? DEFAULT_EMAIL_ACTIVITY_PAGE_SIZE);
  return {
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : DEFAULT_EMAIL_ACTIVITY_PAGE_SIZE,
    sortId: emailActivitySortIdFrom(first(params, "activitySort")),
    sortAsc: first(params, "activityDir") === "asc",
    engagement: emailActivityEngagementFrom(first(params, "activityFilter")),
  };
}

export const DRILLDOWN_KEYS = ["opened", "clicked", "ratings"] as const;
export type DrilldownKey = (typeof DRILLDOWN_KEYS)[number];

export function drilldownPanelsFrom(params: SearchParams): DrilldownKey[] {
  const raw = first(params, "panels");
  if (!raw) return [];
  const parts = raw.split(",").map((part) => part.trim());
  return DRILLDOWN_KEYS.filter((key) => parts.includes(key));
}
