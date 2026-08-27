/**
 * Draft reads for Compose.
 *
 * FIX: v1 had exactly three global draft slots, unnamed and unowned, and the
 * template gallery could only load into two of them — so two people composing
 * at once overwrote each other silently. A draft here is a real row with a
 * name, a client, an owner and a timestamp, and there may be any number of
 * them.
 *
 * Every function returns a `QueryResult`. A read that fails says why; it never
 * falls back to an empty list, because "no drafts yet" and "the database did
 * not answer" are different facts and only one of them means "start writing".
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_TEMPLATE,
  isTemplateKey,
  type TemplateKey,
} from "@/lib/email/templates";
import { MAX_ROWS, type QueryResult } from "./campaigns";

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

type Row = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function record(value: unknown): Row | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : null;
}

function templateOf(payload: unknown): TemplateKey {
  const source = record(payload);
  const key = source?.templateKey;
  return isTemplateKey(key) ? key : DEFAULT_TEMPLATE;
}

/* ── The library ──────────────────────────────────────────────────────────── */

export type DraftCard = {
  id: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
  templateKey: TemplateKey;
  /** The report title inside the payload, where one has been typed. */
  reportTitle: string | null;
  reportNumber: string | null;
  updatedAt: string;
  ownerId: string | null;
  ownerName: string | null;
  /** A seeded reference draft — visible to everyone, editable by no one. */
  isStarter: boolean;
};

export type DraftLibrary = {
  cards: DraftCard[];
  /** The true total for the current search. Never the page length. */
  total: number;
  incomplete: boolean;
};

const DRAFT_COLUMNS =
  "id, name, client_id, series_id, payload, owner_id, is_starter, created_at, updated_at";

function toCard(row: Row, clientName: string | null, ownerName: string | null): DraftCard {
  const payload = record(row.payload);
  return {
    id: str(row.id),
    name: str(row.name) || "Untitled draft",
    clientId: nullableStr(row.client_id),
    clientName,
    templateKey: templateOf(row.payload),
    reportTitle: nullableStr(payload?.title),
    reportNumber: nullableStr(payload?.reportNumber),
    updatedAt: str(row.updated_at),
    ownerId: nullableStr(row.owner_id),
    ownerName,
    isStarter: row.is_starter === true,
  };
}

async function withNames(supabase: SupabaseClient, rows: Row[]): Promise<DraftCard[]> {
  const clientIds = [...new Set(rows.map((row) => nullableStr(row.client_id)))].filter(
    (value): value is string => Boolean(value),
  );
  const ownerIds = [...new Set(rows.map((row) => nullableStr(row.owner_id)))].filter(
    (value): value is string => Boolean(value),
  );

  const [clients, owners] = await Promise.all([
    clientIds.length
      ? supabase.from("clients").select("id, name").in("id", clientIds)
      : Promise.resolve({ data: [], error: null }),
    ownerIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", ownerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (clients.error) throw clients.error;
  if (owners.error) throw owners.error;

  const clientById = new Map<string, string>();
  for (const row of (clients.data ?? []) as unknown as Row[]) {
    clientById.set(str(row.id), str(row.name));
  }
  const ownerById = new Map<string, string>();
  for (const row of (owners.data ?? []) as unknown as Row[]) {
    ownerById.set(str(row.id), str(row.full_name) || str(row.email));
  }

  return rows.map((row) => {
    const clientId = nullableStr(row.client_id);
    const ownerId = nullableStr(row.owner_id);
    return toCard(
      row,
      clientId ? (clientById.get(clientId) ?? null) : null,
      ownerId ? (ownerById.get(ownerId) ?? null) : null,
    );
  });
}

export type DraftLibraryFilter = {
  /** Restricts the list to one owner — the "Mine" side of the filter. */
  ownerId?: string | null;
};

/**
 * The named, non-starter drafts, newest edit first. The search matches the
 * draft's own name — a person looks for the name they gave it, not for a
 * field inside it. Starters are read separately by `listStarterDrafts` —
 * they belong under their own heading, never mixed into this count.
 */
export async function listDrafts(
  query: string,
  filter: DraftLibraryFilter = {},
): Promise<QueryResult<DraftLibrary>> {
  try {
    const supabase = await db();

    let request = supabase
      .from("drafts")
      .select(DRAFT_COLUMNS, { count: "exact" })
      .eq("is_starter", false)
      .order("updated_at", { ascending: false });

    if (filter.ownerId) request = request.eq("owner_id", filter.ownerId);

    const search = safeLike(query);
    if (search) request = request.ilike("name", `%${search}%`);

    const { data, error, count } = await request.range(0, MAX_ROWS - 1);
    if (error) throw error;

    const rows = (data ?? []) as unknown as Row[];
    const cards = await withNames(supabase, rows);

    const total = typeof count === "number" ? count : cards.length;
    return { ok: true, data: { cards, total, incomplete: total > cards.length } };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

/**
 * The starter gallery — a small, fixed set, so it is read whole rather than
 * paginated. Grouped under its own heading in the library, below a person's
 * own drafts; opening one copies it (see `openStarterAction`) rather than
 * editing the row this returns.
 */
export async function listStarterDrafts(): Promise<QueryResult<DraftCard[]>> {
  try {
    const supabase = await db();
    const { data, error } = await supabase
      .from("drafts")
      .select(DRAFT_COLUMNS)
      .eq("is_starter", true)
      .order("name", { ascending: true })
      .limit(MAX_ROWS);
    if (error) throw error;

    const rows = (data ?? []) as unknown as Row[];
    return { ok: true, data: await withNames(supabase, rows) };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

/**
 * The one row `/compose` needs to redirect straight into an editor: the
 * caller's own most-recently-edited draft, nothing else selected. Starters
 * are excluded — they are never "mine" until opened, which copies them.
 */
export async function mostRecentEditableDraftId(
  ownerId: string,
): Promise<QueryResult<string | null>> {
  try {
    const supabase = await db();
    const { data, error } = await supabase
      .from("drafts")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("is_starter", false)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return { ok: true, data: data ? str((data as unknown as Row).id) : null };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

/* ── One draft ────────────────────────────────────────────────────────────── */

export type DraftRecord = {
  id: string;
  name: string;
  clientId: string | null;
  seriesId: string | null;
  ownerId: string | null;
  ownerName: string | null;
  updatedAt: string;
  isStarter: boolean;
  /** Raw payload. The caller normalises it through `parseComposeDoc`. */
  payload: unknown;
};

export async function getDraft(id: string): Promise<QueryResult<DraftRecord | null>> {
  try {
    const supabase = await db();
    const { data, error } = await supabase
      .from("drafts")
      .select(`${DRAFT_COLUMNS}, profiles:owner_id ( id, full_name, email )`)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: true, data: null };

    const row = data as unknown as Row;
    const owner = record(row.profiles);

    return {
      ok: true,
      data: {
        id: str(row.id),
        name: str(row.name) || "Untitled draft",
        clientId: nullableStr(row.client_id),
        seriesId: nullableStr(row.series_id),
        ownerId: nullableStr(row.owner_id),
        ownerName: owner ? str(owner.full_name) || str(owner.email) : null,
        updatedAt: str(row.updated_at),
        isStarter: row.is_starter === true,
        payload: row.payload,
      },
    };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

/* ── The client list behind the searchable select ─────────────────────────── */

export type ComposeClient = {
  id: string;
  name: string;
  slug: string;
  status: string;
  timezone: string;
};

/**
 * Every client, so the Content step can bind to a real row. This list is the
 * whole point of the rebuild: v1 typed the client name into a text box, which
 * is how "cleartrip" and "Cleartrip" became two accounts and how a third of
 * the send history lost its attribution.
 */
export async function listComposeClients(): Promise<QueryResult<ComposeClient[]>> {
  try {
    const supabase = await db();
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, slug, status, timezone")
      .order("name", { ascending: true })
      .limit(MAX_ROWS);
    if (error) throw error;

    return {
      ok: true,
      data: ((data ?? []) as unknown as Row[]).map((row) => ({
        id: str(row.id),
        name: str(row.name),
        slug: str(row.slug),
        status: str(row.status) || "active",
        timezone: str(row.timezone) || "Asia/Kolkata",
      })),
    };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

export type ComposeSeries = {
  id: string;
  clientId: string;
  name: string;
  frequency: string;
  templateKey: TemplateKey;
  isActive: boolean;
};

export async function listComposeSeries(): Promise<QueryResult<ComposeSeries[]>> {
  try {
    const supabase = await db();
    const { data, error } = await supabase
      .from("report_series")
      .select("id, client_id, name, frequency, template_key, is_active")
      .order("name", { ascending: true })
      .limit(MAX_ROWS);
    if (error) throw error;

    return {
      ok: true,
      data: ((data ?? []) as unknown as Row[]).map((row) => {
        const key = str(row.template_key);
        return {
          id: str(row.id),
          clientId: str(row.client_id),
          name: str(row.name),
          frequency: str(row.frequency) || "monthly",
          templateKey: isTemplateKey(key) ? key : DEFAULT_TEMPLATE,
          isActive: row.is_active !== false,
        };
      }),
    };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

/* ── The next number in the series ────────────────────────────────────────── */

const NUMBER_SHAPE = /^(.*?)(\d+)\s*$/;

/**
 * The next DL number for a client, derived from the highest one already used.
 *
 * Scoped to the client and nothing narrower. `campaigns_report_number_key` is
 * unique on (client_id, report_number) — it has no idea a series exists — so
 * this must scan every campaign the client has regardless of which series it
 * belongs to. An earlier version added `.eq("series_id", seriesId)` here,
 * which read as a reasonable narrowing but wasn't: a client running two
 * series (Thyrocare runs two in the seed data) could have DL-099 already
 * spoken for on one series while this function, looking only inside the
 * other, suggested DL-004 — a number that then collided at send time with a
 * constraint violation the Content step never saw coming. See
 * drafts.test.ts for the exact scenario. A suggestion is never silently
 * applied; the field stays editable regardless.
 */
export async function suggestReportNumber(
  clientId: string,
): Promise<QueryResult<string | null>> {
  try {
    const supabase = await db();
    const request = supabase
      .from("campaigns")
      .select("report_number")
      .eq("client_id", clientId)
      .not("report_number", "is", null);

    const { data, error } = await request.limit(MAX_ROWS);
    if (error) throw error;

    let bestPrefix = "DL-";
    let bestWidth = 3;
    let highest = 0;
    let seen = false;

    for (const row of (data ?? []) as unknown as Row[]) {
      const value = str(row.report_number).trim();
      const match = NUMBER_SHAPE.exec(value);
      if (!match) continue;
      const numeric = Number.parseInt(match[2], 10);
      if (!Number.isFinite(numeric)) continue;
      seen = true;
      if (numeric >= highest) {
        highest = numeric;
        bestPrefix = match[1];
        bestWidth = match[2].length;
      }
    }

    if (!seen) return { ok: true, data: `${bestPrefix}${"1".padStart(bestWidth, "0")}` };
    const next = highest + 1;
    return {
      ok: true,
      data: `${bestPrefix}${String(next).padStart(bestWidth, "0")}`,
    };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

/* ── The performance scoreboard ───────────────────────────────────────────── */

export type ScoreboardEntry = {
  label: string;
  sentAt: string | null;
  recipientsExternal: number;
  uniqueOpens: number;
  ratings: number;
  avgRating: number | null;
};

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The client's last three sent reports, straight from `campaign_stats`.
 *
 * Test sends and internal recipients are already excluded by the view, so the
 * figures a client reads in the scoreboard are the figures the Campaigns screen
 * shows for the same reports. Nothing here re-derives an open.
 */
export async function scoreboardFor(
  clientId: string,
): Promise<QueryResult<ScoreboardEntry[]>> {
  try {
    const supabase = await db();
    const { data, error } = await supabase
      .from("campaign_stats")
      .select(
        "campaign_id, report_number, title, sent_at, recipients_external, unique_opens, ratings, avg_rating",
      )
      .eq("client_id", clientId)
      .eq("is_test", false)
      .eq("status", "sent")
      .order("sent_at", { ascending: false, nullsFirst: false })
      .limit(3);
    if (error) throw error;

    return {
      ok: true,
      data: ((data ?? []) as unknown as Row[]).map((row) => ({
        label: nullableStr(row.report_number) ?? str(row.title),
        sentAt: nullableStr(row.sent_at),
        recipientsExternal: num(row.recipients_external),
        uniqueOpens: num(row.unique_opens),
        ratings: num(row.ratings),
        avgRating: nullableNum(row.avg_rating),
      })),
    };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

/**
 * The scoreboard as Markdown, so it travels through the same renderer as the
 * body rather than becoming a second layout with its own arithmetic.
 *
 * Returns an empty string when there is nothing honest to show — a scoreboard
 * with no prior reports would be a table of dashes, which reads as broken.
 */
export function scoreboardMarkdown(entries: ScoreboardEntry[]): string {
  if (entries.length === 0) return "";
  const lines = entries.map((entry) => {
    const opens =
      entry.recipientsExternal === 0
        ? "no external recipients"
        : `${entry.uniqueOpens} of ${entry.recipientsExternal} opened`;
    const rating =
      entry.avgRating === null
        ? "not yet rated"
        : `rated ${entry.avgRating.toFixed(1)} of 5 by ${entry.ratings}`;
    return `- **${entry.label}** — ${opens}, ${rating}`;
  });
  return ["---", "### How the last reports landed", ...lines].join("\n\n");
}
