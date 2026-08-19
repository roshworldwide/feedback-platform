/**
 * Read-only queries for the Audits pages — the same role `queries/clients.ts`
 * plays for the Clients pages. Mutations live in `src/app/(app)/audits/actions.ts`;
 * this file never writes.
 */

import { createClient } from "@/lib/supabase/server";
import { normalizeCanonicalRow } from "@/lib/audits/compute";
import type { AuditRunStatus, CanonicalRow, ColumnMap, ComputedMetrics, NarrativeResult } from "@/lib/audits/types";

export type QueryResult<T> = { ok: true; data: T } | { ok: false; reason: string };

type Row = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function reasonOf(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim() !== "") return message;
  }
  return "the database gave no reason";
}

export type AuditRunSummary = {
  id: string;
  clientId: string;
  clientName: string;
  name: string;
  periodLabel: string;
  rowCount: number;
  status: AuditRunStatus;
  createdAt: string;
};

export async function listAuditRuns(): Promise<QueryResult<AuditRunSummary[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("audit_runs")
      .select("id, client_id, name, period_label, row_count, status, created_at, clients:client_id ( name )")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return {
      ok: true,
      data: ((data ?? []) as unknown as Row[]).map((r) => ({
        id: str(r.id),
        clientId: str(r.client_id),
        clientName: str((r.clients as Row | null)?.name) || "Unknown client",
        name: str(r.name),
        periodLabel: str(r.period_label),
        rowCount: Number(r.row_count ?? 0),
        status: (str(r.status) || "uploaded") as AuditRunStatus,
        createdAt: str(r.created_at),
      })),
    };
  } catch (cause) {
    return { ok: false, reason: reasonOf(cause) };
  }
}

export type AuditRunDetail = AuditRunSummary & {
  columnMap: ColumnMap;
  metrics: ComputedMetrics;
  narrative: NarrativeResult;
  campaignId: string | null;
};

/** `ok:true, data:null` means "no such run" — the caller decides (usually `notFound()`), same as `getDraft`. */
export async function getAuditRun(id: string): Promise<QueryResult<AuditRunDetail | null>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("audit_runs")
      .select(
        "id, client_id, name, period_label, row_count, status, column_map, metrics, narrative, campaign_id, " +
          "created_at, clients:client_id ( name )",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: true, data: null };
    const r = data as unknown as Row;
    return {
      ok: true,
      data: {
        id: str(r.id),
        clientId: str(r.client_id),
        clientName: str((r.clients as Row | null)?.name) || "Unknown client",
        name: str(r.name),
        periodLabel: str(r.period_label),
        rowCount: Number(r.row_count ?? 0),
        status: (str(r.status) || "uploaded") as AuditRunStatus,
        columnMap: (r.column_map ?? {}) as ColumnMap,
        metrics: (r.metrics ?? {}) as unknown as ComputedMetrics,
        narrative: (r.narrative ?? {}) as unknown as NarrativeResult,
        campaignId: r.campaign_id ? str(r.campaign_id) : null,
        createdAt: str(r.created_at),
      },
    };
  } catch (cause) {
    return { ok: false, reason: reasonOf(cause) };
  }
}

export type AuditRowDetail = CanonicalRow & { isFatal: boolean; fatalReason: string; issueTags: string[] };

export async function listAuditRunRows(runId: string): Promise<QueryResult<AuditRowDetail[]>> {
  try {
    const supabase = await createClient();
    const runResult = await supabase.from("audit_runs").select("column_map").eq("id", runId).maybeSingle();
    if (runResult.error) throw runResult.error;
    const columnMap = ((runResult.data as unknown as Row | null)?.column_map ?? {}) as ColumnMap;

    const { data, error } = await supabase
      .from("audit_rows")
      .select("row_index, raw, is_fatal, fatal_reason, issue_tags")
      .eq("run_id", runId)
      .order("row_index", { ascending: true });
    if (error) throw error;

    return {
      ok: true,
      data: ((data ?? []) as unknown as Row[]).map((r) => {
        const canonical = normalizeCanonicalRow(r.raw as Record<string, string>, columnMap, Number(r.row_index));
        return {
          ...canonical,
          isFatal: r.is_fatal === true,
          fatalReason: str(r.fatal_reason),
          issueTags: Array.isArray(r.issue_tags) ? (r.issue_tags as string[]) : [],
        };
      }),
    };
  } catch (cause) {
    return { ok: false, reason: reasonOf(cause) };
  }
}
