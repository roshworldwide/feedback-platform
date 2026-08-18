/**
 * Client vocabulary — statuses, health, the URL shape.
 *
 * A leaf module with no server imports, so the filter bar and the query layer
 * share one definition. `HEALTH_VALUES` is exactly the set the `client_health`
 * view can return; the UI never invents a sixth state and never defaults a
 * missing one to "healthy".
 */

import {
  firstParam,
  type SearchParams,
} from "@/components/campaigns/vocabulary";
import { isInternalEmail } from "@/lib/utils";

export const CLIENT_STATUSES = ["active", "paused", "churned"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  active: "Active",
  paused: "Paused",
  churned: "Churned",
};

export const HEALTH_VALUES = [
  "healthy",
  "watch",
  "at-risk",
  "no-sends",
  "inactive",
] as const;
export type Health = (typeof HEALTH_VALUES)[number];

export const HEALTH_LABEL: Record<Health, string> = {
  healthy: "Healthy",
  watch: "Watch",
  "at-risk": "At risk",
  "no-sends": "No sends",
  inactive: "Inactive",
};

/** The rule the view encodes, restated wherever health is shown. */
export const HEALTH_RULE =
  "At risk: no report in 45 days, or an average rating below 3.5. " +
  "Watch: no report in 30 days, or an average below 4.0. " +
  "No sends: nothing has ever gone out.";

export const CLIENT_PAGE_SIZES = [12, 24, 48, 96] as const;
export const DEFAULT_CLIENT_PAGE_SIZE = 24;

export type ClientView = "table" | "grid";

export type ClientFilters = {
  q: string;
  status: ClientStatus | null;
  tag: string | null;
  health: Health | null;
  page: number;
  pageSize: number;
  view: ClientView;
};

export function parseClientFilters(params: SearchParams): ClientFilters {
  const status = firstParam(params, "status");
  const health = firstParam(params, "health");
  const pageSize = Number(firstParam(params, "size") ?? DEFAULT_CLIENT_PAGE_SIZE);
  const page = Number(firstParam(params, "page") ?? 1);
  const view = firstParam(params, "view");

  return {
    q: firstParam(params, "q") ?? "",
    status: CLIENT_STATUSES.find((item) => item === status) ?? null,
    tag: firstParam(params, "tag"),
    health: HEALTH_VALUES.find((item) => item === health) ?? null,
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    pageSize: (CLIENT_PAGE_SIZES as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_CLIENT_PAGE_SIZE,
    view: view === "grid" ? "grid" : "table",
  };
}

export function hasActiveClientFilters(filters: ClientFilters): boolean {
  return Boolean(filters.q || filters.status || filters.tag || filters.health);
}

/* ── Bulk contact paste ────────────────────────────────────────────────────
 * A leaf parser: no server import, so the bulk-add drawer can preview what a
 * paste resolves to — duplicates and invalid addresses flagged — before the
 * server action that writes it is ever called.
 */

export type ParsedContactLine = {
  raw: string;
  email: string;
  fullName: string;
  isInternal: boolean;
  problem: "invalid" | "duplicate-in-paste" | "already-on-client" | null;
};

/** Splits on commas and newlines, reads an optional "Name <email>" or "Name email" shape. */
export function parseContactPaste(
  text: string,
  domains: string[],
  existing: Set<string> = new Set(),
): ParsedContactLine[] {
  const seen = new Set<string>();
  return text
    .split(/[\n,]+/)
    .map((raw) => raw.trim())
    .filter((raw) => raw !== "")
    .map((raw) => {
      const angled = raw.match(/^(.*?)<([^>]+)>$/);
      const [namePart, emailPart] = angled
        ? [angled[1].trim(), angled[2].trim()]
        : raw.includes(" ") && raw.lastIndexOf("@") > raw.lastIndexOf(" ")
          ? [raw.slice(0, raw.lastIndexOf(" ")).trim(), raw.slice(raw.lastIndexOf(" ") + 1).trim()]
          : ["", raw];

      const email = emailPart.trim().toLowerCase().replace(/[,;]+$/, "");
      const fullName = namePart.replace(/^["']|["']$/g, "").trim();
      const shapeOk = email.includes("@") && email.indexOf("@") > 0 && !email.includes(" ");

      let problem: ParsedContactLine["problem"] = shapeOk ? null : "invalid";
      if (shapeOk) {
        if (seen.has(email)) problem = "duplicate-in-paste";
        else if (existing.has(email)) problem = "already-on-client";
        else seen.add(email);
      }

      return {
        raw,
        email,
        fullName,
        isInternal: shapeOk ? isInternalEmail(email, domains) : false,
        problem,
      };
    });
}

export function clientQueryString(
  filters: ClientFilters,
  patch: Partial<ClientFilters> = {},
): string {
  const next: ClientFilters = {
    ...filters,
    ...patch,
    page: patch.page ?? (Object.keys(patch).length > 0 ? 1 : filters.page),
  };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.status) params.set("status", next.status);
  if (next.tag) params.set("tag", next.tag);
  if (next.health) params.set("health", next.health);
  if (next.page > 1) params.set("page", String(next.page));
  if (next.pageSize !== DEFAULT_CLIENT_PAGE_SIZE)
    params.set("size", String(next.pageSize));
  if (next.view !== "table") params.set("view", next.view);
  const query = params.toString();
  return query ? `?${query}` : "";
}
