/**
 * Client reads.
 *
 * Health comes from the `client_health` view and nowhere else. v1's "At Risk"
 * card was hard-wired to zero and its "Active" count always equalled "Total";
 * both are now counted against the view, so the number on the card is the
 * number in the database or it is an explicit failure.
 *
 * Internal contacts are excluded from every client-facing figure here, and the
 * count of what was excluded travels alongside so the screen can say so.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampaignStats } from "@/lib/metrics";
import {
  CLIENT_STATUSES,
  HEALTH_VALUES,
  type ClientFilters,
  type ClientStatus,
  type Health,
} from "@/components/clients/vocabulary";
import { MAX_ROWS, type CampaignStatus, type QueryResult } from "./campaigns";

export type {
  ClientFilters,
  ClientStatus,
  Health,
} from "@/components/clients/vocabulary";
export {
  CLIENT_PAGE_SIZES,
  CLIENT_STATUSES,
  CLIENT_STATUS_LABEL,
  HEALTH_LABEL,
  HEALTH_RULE,
  HEALTH_VALUES,
  clientQueryString,
  hasActiveClientFilters,
  parseClientFilters,
} from "@/components/clients/vocabulary";

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

function safeLike(input: string): string {
  return input.replace(/[%_,()\\*.]/g, " ").replace(/\s+/g, " ").trim();
}

type Record_ = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function nullableStr(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
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
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toHealth(value: unknown): Health {
  const found = HEALTH_VALUES.find((item) => item === value);
  return found ?? "no-sends";
}

function toStatus(value: unknown): ClientStatus {
  const found = CLIENT_STATUSES.find((item) => item === value);
  return found ?? "active";
}

/* ── Health rows ──────────────────────────────────────────────────────────── */

export type ClientHealthRow = {
  clientId: string;
  externalContacts: number;
  internalContacts: number;
  campaignsSent: number;
  lastSentAt: string | null;
  avgRating: number | null;
  ratings: number;
  health: Health;
};

const HEALTH_COLUMNS =
  "client_id, name, slug, status, owner_id, external_contacts, internal_contacts, " +
  "campaigns_sent, last_sent_at, avg_rating, ratings, health";

function toHealthRow(row: Record_): ClientHealthRow {
  return {
    clientId: str(row.client_id),
    externalContacts: num(row.external_contacts),
    internalContacts: num(row.internal_contacts),
    campaignsSent: num(row.campaigns_sent),
    lastSentAt: nullableStr(row.last_sent_at),
    avgRating: nullableNum(row.avg_rating),
    ratings: num(row.ratings),
    health: toHealth(row.health),
  };
}

/* ── KPI strip ────────────────────────────────────────────────────────────── */

export type ClientKpis = {
  totalClients: number;
  activeClients: number;
  /** External contacts only. `internalContacts` states what was left out. */
  externalContacts: number;
  internalContacts: number;
  atRisk: number;
  watch: number;
};

export async function getClientKpis(): Promise<QueryResult<ClientKpis>> {
  try {
    const supabase = await db();
    const [total, active, external, internal, atRisk, watch] = await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("is_internal", false),
      supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("is_internal", true),
      // The defect this replaces: a card that said 0 because it was written 0.
      supabase
        .from("client_health")
        .select("client_id", { count: "exact", head: true })
        .eq("health", "at-risk"),
      supabase
        .from("client_health")
        .select("client_id", { count: "exact", head: true })
        .eq("health", "watch"),
    ]);

    for (const result of [total, active, external, internal, atRisk, watch]) {
      if (result.error) throw result.error;
    }

    return {
      ok: true,
      data: {
        totalClients: total.count ?? 0,
        activeClients: active.count ?? 0,
        externalContacts: external.count ?? 0,
        internalContacts: internal.count ?? 0,
        atRisk: atRisk.count ?? 0,
        watch: watch.count ?? 0,
      },
    };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

/* ── List ─────────────────────────────────────────────────────────────────── */

export type ClientListRow = {
  id: string;
  name: string;
  slug: string;
  status: ClientStatus;
  tags: string[];
  ownerId: string | null;
  ownerName: string | null;
  primaryContactId: string | null;
  primaryContactName: string | null;
  health: ClientHealthRow | null;
};

export type ClientListPage = {
  rows: ClientListRow[];
  total: number;
  page: number;
  pageSize: number;
  tags: string[];
  /** Set when the health filter was resolved through a capped id lookup. */
  healthLookupIncomplete: boolean;
};

export async function listClients(
  filters: ClientFilters,
): Promise<QueryResult<ClientListPage>> {
  try {
    const supabase = await db();

    // Tags live on the table, health lives on the view; whichever the caller
    // filters by, the other side is resolved to an id set first.
    let healthIds: string[] | null = null;
    let healthLookupIncomplete = false;
    if (filters.health) {
      const lookup = await supabase
        .from("client_health")
        .select("client_id", { count: "exact" })
        .eq("health", filters.health)
        .range(0, MAX_ROWS - 1);
      if (lookup.error) throw lookup.error;
      const rows = (lookup.data ?? []) as unknown as Record_[];
      healthIds = rows.map((row) => str(row.client_id));
      healthLookupIncomplete =
        typeof lookup.count === "number" && lookup.count > healthIds.length;
    }

    const offset = (filters.page - 1) * filters.pageSize;
    let query = supabase
      .from("clients")
      .select("id, name, slug, status, tags, owner_id, primary_contact_id", { count: "exact" });

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.tag) query = query.contains("tags", [filters.tag]);
    if (healthIds) query = query.in("id", healthIds);
    const search = safeLike(filters.q);
    if (search) query = query.or(`name.ilike.*${search}*,slug.ilike.*${search}*`);

    const [page, allTags] = await Promise.all([
      query.order("name", { ascending: true }).range(offset, offset + filters.pageSize - 1),
      supabase.from("clients").select("tags").limit(MAX_ROWS),
    ]);

    if (page.error) throw page.error;
    if (allTags.error) throw allTags.error;

    const clientRows = (page.data ?? []) as unknown as Record_[];
    const ids = clientRows.map((row) => str(row.id)).filter(Boolean);
    const ownerIds = [
      ...new Set(clientRows.map((row) => nullableStr(row.owner_id))),
    ].filter((value): value is string => Boolean(value));
    const primaryContactIds = [
      ...new Set(clientRows.map((row) => nullableStr(row.primary_contact_id))),
    ].filter((value): value is string => Boolean(value));

    const [health, owners, primaryContacts] = await Promise.all([
      ids.length
        ? supabase.from("client_health").select(HEALTH_COLUMNS).in("client_id", ids)
        : Promise.resolve({ data: [], error: null }),
      ownerIds.length
        ? supabase.from("profiles").select("id, full_name, email").in("id", ownerIds)
        : Promise.resolve({ data: [], error: null }),
      primaryContactIds.length
        ? supabase.from("contacts").select("id, full_name, email").in("id", primaryContactIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (health.error) throw health.error;
    if (owners.error) throw owners.error;
    if (primaryContacts.error) throw primaryContacts.error;

    const healthById = new Map<string, ClientHealthRow>();
    for (const row of (health.data ?? []) as unknown as Record_[]) {
      healthById.set(str(row.client_id), toHealthRow(row));
    }
    const ownerById = new Map<string, string>();
    for (const row of (owners.data ?? []) as unknown as Record_[]) {
      ownerById.set(str(row.id), str(row.full_name) || str(row.email));
    }
    const contactById = new Map<string, string>();
    for (const row of (primaryContacts.data ?? []) as unknown as Record_[]) {
      contactById.set(str(row.id), str(row.full_name) || str(row.email));
    }

    const tags = [
      ...new Set(((allTags.data ?? []) as unknown as Record_[]).flatMap((row) => strings(row.tags))),
    ].sort();

    return {
      ok: true,
      data: {
        rows: clientRows.map((row) => {
          const id = str(row.id);
          const ownerId = nullableStr(row.owner_id);
          const primaryContactId = nullableStr(row.primary_contact_id);
          return {
            id,
            name: str(row.name),
            slug: str(row.slug),
            status: toStatus(row.status),
            tags: strings(row.tags),
            ownerId,
            ownerName: ownerId ? (ownerById.get(ownerId) ?? null) : null,
            primaryContactId,
            primaryContactName: primaryContactId ? (contactById.get(primaryContactId) ?? null) : null,
            health: healthById.get(id) ?? null,
          };
        }),
        total: typeof page.count === "number" ? page.count : clientRows.length,
        page: filters.page,
        pageSize: filters.pageSize,
        tags,
        healthLookupIncomplete,
      },
    };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

/* ── Detail ───────────────────────────────────────────────────────────────── */

export type ClientDetail = {
  id: string;
  name: string;
  slug: string;
  status: ClientStatus;
  tags: string[];
  notes: string;
  timezone: string;
  ownerId: string | null;
  ownerName: string | null;
  primaryContactId: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  createdAt: string;
  health: ClientHealthRow | null;
};

export async function getClientBySlug(
  slug: string,
): Promise<QueryResult<ClientDetail | null>> {
  try {
    const supabase = await db();
    const { data, error } = await supabase
      .from("clients")
      .select(
        "id, name, slug, status, tags, notes, timezone, owner_id, primary_contact_id, created_at, " +
          "profiles ( id, full_name, email ), " +
          "contacts!clients_primary_contact_fkey ( id, full_name, email )",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: true, data: null };

    const row = data as unknown as Record_;
    const owner = (row.profiles ?? null) as Record_ | null;
    const primaryContact = (row.contacts ?? null) as Record_ | null;
    const id = str(row.id);

    const health = await supabase
      .from("client_health")
      .select(HEALTH_COLUMNS)
      .eq("client_id", id)
      .maybeSingle();

    return {
      ok: true,
      data: {
        id,
        name: str(row.name),
        slug: str(row.slug),
        status: toStatus(row.status),
        tags: strings(row.tags),
        notes: str(row.notes),
        timezone: str(row.timezone),
        ownerId: nullableStr(row.owner_id),
        ownerName: owner ? str(owner.full_name) || str(owner.email) : null,
        primaryContactId: nullableStr(row.primary_contact_id),
        primaryContactName: primaryContact
          ? str(primaryContact.full_name) || str(primaryContact.email)
          : null,
        primaryContactEmail: primaryContact ? str(primaryContact.email) : null,
        createdAt: str(row.created_at),
        health:
          health.error || !health.data ? null : toHealthRow(health.data as unknown as Record_),
      },
    };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

export type OwnerOption = { id: string; name: string };

export async function listOwners(): Promise<QueryResult<OwnerOption[]>> {
  try {
    const supabase = await db();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .order("full_name")
      .limit(MAX_ROWS);
    if (error) throw error;
    return {
      ok: true,
      data: ((data ?? []) as unknown as Record_[]).map((row) => ({
        id: str(row.id),
        name: str(row.full_name) || str(row.email),
      })),
    };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

/* ── Contacts ─────────────────────────────────────────────────────────────── */

export type ContactRow = {
  id: string;
  email: string;
  fullName: string;
  title: string;
  isInternal: boolean;
  isActive: boolean;
  bouncedAt: string | null;
};

export async function listClientContacts(
  clientId: string,
): Promise<QueryResult<{ rows: ContactRow[]; total: number; incomplete: boolean }>> {
  try {
    const supabase = await db();
    const { data, error, count } = await supabase
      .from("contacts")
      .select("id, email, full_name, title, is_internal, is_active, bounced_at", {
        count: "exact",
      })
      .eq("client_id", clientId)
      .order("is_internal", { ascending: true })
      .order("full_name", { ascending: true })
      .range(0, MAX_ROWS - 1);
    if (error) throw error;

    const rows = ((data ?? []) as unknown as Record_[]).map((row) => ({
      id: str(row.id),
      email: str(row.email),
      fullName: str(row.full_name),
      title: str(row.title),
      isInternal: Boolean(row.is_internal),
      isActive: Boolean(row.is_active),
      bouncedAt: nullableStr(row.bounced_at),
    }));
    const total = typeof count === "number" ? count : rows.length;
    return { ok: true, data: { rows, total, incomplete: total > rows.length } };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

/* ── Per-person engagement ────────────────────────────────────────────────── */

export type EngagementRow = {
  recipientId: string;
  campaignId: string;
  email: string;
  isInternal: boolean;
  isTest: boolean;
  sentAt: string | null;
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  rating: number | null;
};

/**
 * Raw per-recipient rows for one client, straight from `recipient_engagement`.
 * `opened` is already the deduplicated "open OR click" set-membership test —
 * callers group these rows, they never redefine them.
 */
export async function listClientEngagement(
  clientId: string,
): Promise<QueryResult<{ rows: EngagementRow[]; total: number; incomplete: boolean }>> {
  try {
    const supabase = await db();
    const { data, error, count } = await supabase
      .from("recipient_engagement")
      .select(
        "recipient_id, campaign_id, email, is_internal, is_test, sent_at, delivered, opened, clicked, rating",
        { count: "exact" },
      )
      .eq("client_id", clientId)
      .eq("is_test", false)
      .order("sent_at", { ascending: false, nullsFirst: false })
      .range(0, MAX_ROWS - 1);
    if (error) throw error;

    const rows = ((data ?? []) as unknown as Record_[]).map((row) => ({
      recipientId: str(row.recipient_id),
      campaignId: str(row.campaign_id),
      email: str(row.email).toLowerCase(),
      isInternal: Boolean(row.is_internal),
      isTest: Boolean(row.is_test),
      sentAt: nullableStr(row.sent_at),
      delivered: Boolean(row.delivered),
      opened: Boolean(row.opened),
      clicked: Boolean(row.clicked),
      rating: nullableNum(row.rating),
    }));
    const total = typeof count === "number" ? count : rows.length;
    return { ok: true, data: { rows, total, incomplete: total > rows.length } };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

export type PersonEngagement = {
  email: string;
  sends: number;
  delivered: number;
  opened: number;
  clicked: number;
  ratings: number;
  avgRating: number | null;
};

/** Groups the view's rows by person. Counting rows, never redefining them. */
export function engagementByPerson(rows: EngagementRow[]): Map<string, PersonEngagement> {
  const byEmail = new Map<string, PersonEngagement & { ratingSum: number }>();
  for (const row of rows) {
    const current = byEmail.get(row.email) ?? {
      email: row.email,
      sends: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      ratings: 0,
      avgRating: null,
      ratingSum: 0,
    };
    current.sends += 1;
    if (row.delivered) current.delivered += 1;
    if (row.opened) current.opened += 1;
    if (row.clicked) current.clicked += 1;
    if (row.rating !== null) {
      current.ratings += 1;
      current.ratingSum += row.rating;
    }
    byEmail.set(row.email, current);
  }

  const out = new Map<string, PersonEngagement>();
  for (const [email, value] of byEmail) {
    out.set(email, {
      email: value.email,
      sends: value.sends,
      delivered: value.delivered,
      opened: value.opened,
      clicked: value.clicked,
      ratings: value.ratings,
      avgRating:
        value.ratings === 0
          ? null
          : Math.round((value.ratingSum / value.ratings) * 100) / 100,
    });
  }
  return out;
}

/* ── Client campaign stats ────────────────────────────────────────────────── */

export type ClientCampaignStat = {
  campaignId: string;
  reportNumber: string | null;
  title: string;
  status: CampaignStatus;
  sentAt: string | null;
  stats: CampaignStats;
};

/**
 * Every sent campaign for the client, from `campaign_stats`. Feeds the
 * engagement trend, the CSAT trend and the send-cadence heatmap, so all three
 * read the same numbers the campaign screens read.
 */
export async function listClientCampaignStats(
  clientId: string,
): Promise<
  QueryResult<{ rows: ClientCampaignStat[]; total: number; incomplete: boolean }>
> {
  try {
    const supabase = await db();
    const { data, error, count } = await supabase
      .from("campaign_stats")
      .select(
        "campaign_id, report_number, title, status, sent_at, recipients_total, " +
          "recipients_internal, recipients_external, delivered, bounced, unique_opens, " +
          "unique_clicks, ratings, avg_rating, comments",
        { count: "exact" },
      )
      .eq("client_id", clientId)
      .eq("is_test", false)
      .order("sent_at", { ascending: false, nullsFirst: false })
      .range(0, MAX_ROWS - 1);
    if (error) throw error;

    const rows: ClientCampaignStat[] = ((data ?? []) as unknown as Record_[]).map((row) => ({
      campaignId: str(row.campaign_id),
      reportNumber: nullableStr(row.report_number),
      title: str(row.title),
      status: (["draft", "scheduled", "sending", "sent", "failed", "cancelled"].find(
        (item) => item === row.status,
      ) ?? "draft") as CampaignStatus,
      sentAt: nullableStr(row.sent_at),
      stats: {
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
      },
    }));

    const total = typeof count === "number" ? count : rows.length;
    return { ok: true, data: { rows, total, incomplete: total > rows.length } };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

/* ── Feedback ─────────────────────────────────────────────────────────────── */

export type ClientFeedbackRow = {
  id: string;
  rating: number;
  comment: string | null;
  sentiment: string | null;
  createdAt: string;
  reviewedAt: string | null;
  personName: string;
  personEmail: string;
  /** Non-negotiable: a rating is never shown without the campaign it belongs to. */
  campaignId: string;
  campaignReportNumber: string | null;
  campaignTitle: string;
  campaignSentAt: string | null;
};

export async function listClientFeedback(
  clientId: string,
): Promise<
  QueryResult<{ rows: ClientFeedbackRow[]; total: number; incomplete: boolean }>
> {
  try {
    const supabase = await db();
    const { data, error, count } = await supabase
      .from("feedback")
      .select(
        "id, rating, comment, sentiment, created_at, reviewed_at, campaign_id, " +
          "campaigns!inner ( id, report_number, title, client_id, sent_at, is_test ), " +
          "campaign_recipients!inner ( email, full_name, is_internal )",
        { count: "exact" },
      )
      .eq("campaigns.client_id", clientId)
      .eq("campaigns.is_test", false)
      .eq("campaign_recipients.is_internal", false)
      .order("created_at", { ascending: false })
      .range(0, MAX_ROWS - 1);
    if (error) throw error;

    const rows: ClientFeedbackRow[] = ((data ?? []) as unknown as Record_[]).map((row) => {
      const campaign = (row.campaigns ?? null) as Record_ | null;
      const person = (row.campaign_recipients ?? null) as Record_ | null;
      return {
        id: str(row.id),
        rating: num(row.rating),
        comment: nullableStr(row.comment),
        sentiment: nullableStr(row.sentiment),
        createdAt: str(row.created_at),
        reviewedAt: nullableStr(row.reviewed_at),
        personName: str(person?.full_name) || str(person?.email),
        personEmail: str(person?.email),
        campaignId: str(campaign?.id ?? row.campaign_id),
        campaignReportNumber: nullableStr(campaign?.report_number),
        campaignTitle: str(campaign?.title),
        campaignSentAt: nullableStr(campaign?.sent_at),
      };
    });

    const total = typeof count === "number" ? count : rows.length;
    return { ok: true, data: { rows, total, incomplete: total > rows.length } };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}
