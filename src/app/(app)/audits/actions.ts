"use server";

/**
 * Everything Audits writes.
 *
 * Sections 1-5 are computed once and never rewritten wholesale after that —
 * editing a row's fatal flag or issue tags recomputes only §5's frequency
 * table, never §1-4's arithmetic, which is fixed the moment Compute runs.
 * That split is the whole point of this feature: the numbers a human signs
 * off on are never quietly recalculated underneath them.
 *
 * Compute is deliberately two actions, not one — `computeReportAction` (the
 * deterministic tiers, instant) and `generateNarrativeAction` (the AI pass,
 * which can take real seconds). No route in this codebase extends past
 * Vercel's default function duration yet; splitting avoids depending on that
 * being fine for the one call that combines a network round trip with
 * everything else.
 *
 * Sending reuses `dispatchCampaign` (src/lib/campaigns/dispatch.ts)
 * unmodified — by Send time everything is already committed to the
 * `campaigns` row, exactly what that function expects, so there is no
 * parallel send loop here the way Compose's live-editing flow needs one.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { env, internalDomains } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { isInternalEmail } from "@/lib/utils";
import { dispatchCampaign } from "@/lib/campaigns/dispatch";
import { parseCsv, fuzzyMatchColumns } from "@/lib/audits/csv";
import { fetchSheetCsv } from "@/lib/audits/sheets";
import { computeDeterministic, computeParameterFrequency, normalizeCanonicalRow } from "@/lib/audits/compute";
import { buildNarrative } from "@/lib/audits/narrative";
import { buildReportDocument, type ReportSection } from "@/lib/audits/report-document";
import { renderAuditReportPdf } from "@/lib/audits/pdf";
import { renderReportEmail } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/send";
import { COLUMN_ROLES } from "@/lib/audits/types";
import type {
  CanonicalRow,
  ColumnMap,
  ComputedMetrics,
  NarrativeResult,
  TaxonomyParameter,
} from "@/lib/audits/types";
import type { ActionResult } from "@/components/audits/vocabulary";
import { isEmailShaped, type RecipientChoice } from "@/components/compose/vocabulary";

/* ── Shared plumbing — mirrors compose/actions.ts's conventions exactly ────── */

type Row = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function failed(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function reasonOf(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim() !== "") return message;
  }
  return "the database gave no reason";
}

type Actor = { id: string; email: string; fullName: string; role: string };

async function actor(): Promise<Actor | null> {
  const profile = await getSessionProfile();
  if (!profile) return null;
  return {
    id: String(profile.id),
    email: String(profile.email),
    fullName: String(profile.full_name ?? ""),
    role: String(profile.role),
  };
}

const NO_SESSION =
  "Your session is no longer active, so nothing was saved. Sign in again — everything you typed is still here.";

async function loadActiveTaxonomy(): Promise<TaxonomyParameter[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_taxonomy")
    .select("id, label, patterns, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: str(r.id),
    label: str(r.label),
    patterns: Array.isArray(r.patterns) ? (r.patterns as string[]) : [],
    sortOrder: Number(r.sort_order ?? 0),
    isActive: r.is_active !== false,
  }));
}

/* ── Upload ───────────────────────────────────────────────────────────────── */

const UPLOAD_BUCKET = "audit-uploads";

async function suggestedColumnMap(
  clientId: string,
  headers: string[],
  sampleRows: Record<string, string>[],
): Promise<ColumnMap> {
  const fresh = fuzzyMatchColumns(headers, sampleRows);
  const suggestion: ColumnMap = {};
  for (const role of COLUMN_ROLES) {
    if (fresh[role]) suggestion[role] = fresh[role]!.header;
  }

  // "Save the mapping per client": the most recent prior run's map is the
  // default, so a second upload from the same source needs no remapping —
  // but only where its header still exists in this file.
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_runs")
    .select("column_map")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const prior = (data as unknown as Row | null)?.column_map as ColumnMap | undefined;
  if (prior && Object.keys(prior).length > 0) {
    for (const role of COLUMN_ROLES) {
      const priorHeader = prior[role];
      if (priorHeader && headers.includes(priorHeader)) suggestion[role] = priorHeader;
    }
  }
  return suggestion;
}

/** Recomputes the Map step's suggestion — used whether arriving fresh from Upload or returning later. */
export async function suggestMappingAction(
  runId: string,
): Promise<ActionResult<{ headers: string[]; currentMap: ColumnMap; suggestedMap: ColumnMap }>> {
  try {
    const supabase = await createClient();
    const { data: runData, error: runError } = await supabase
      .from("audit_runs")
      .select("client_id, column_map")
      .eq("id", runId)
      .maybeSingle();
    if (runError) return failed(`Couldn't read this run — ${runError.message}.`);
    if (!runData) return failed("This audit run no longer exists.");

    const run = runData as unknown as Row;
    const currentMap = (run.column_map ?? {}) as ColumnMap;

    const { data: sampleData, error: sampleError } = await supabase
      .from("audit_rows")
      .select("raw")
      .eq("run_id", runId)
      .order("row_index", { ascending: true })
      .limit(5);
    if (sampleError) return failed(`Couldn't read the uploaded rows — ${sampleError.message}.`);

    const sampleRows = ((sampleData ?? []) as unknown as Row[]).map((r) => r.raw as Record<string, string>);
    const headers = sampleRows.length > 0 ? Object.keys(sampleRows[0]) : [];
    const suggestedMap = await suggestedColumnMap(str(run.client_id), headers, sampleRows);

    return { ok: true, data: { headers, currentMap, suggestedMap } };
  } catch (cause) {
    return failed(`Couldn't suggest a mapping — ${reasonOf(cause)}.`);
  }
}

export type UploadResult = {
  runId: string;
  rowCount: number;
  headers: string[];
  preview: Record<string, string>[];
  suggestedMap: ColumnMap;
};

/**
 * A CSV file or a Google Sheets URL, mutually exclusive. The CSV is client
 * data: parsed here, server-side, and never logged — only the derived row
 * count and headers ever leave this function.
 */
export async function uploadCsvAction(form: FormData): Promise<ActionResult<UploadResult>> {
  const clientId = str(form.get("clientId"));
  if (!clientId) return failed("Pick a client first — an audit run cannot exist without one.");

  const file = form.get("file");
  const sheetsUrlRaw = str(form.get("sheetsUrl")).trim();

  let text: string;
  let sourceFilename: string;
  let sheetsUrl: string | null = null;

  if (file instanceof File && file.size > 0) {
    text = await file.text();
    sourceFilename = file.name;
  } else if (sheetsUrlRaw) {
    const fetched = await fetchSheetCsv(sheetsUrlRaw);
    if (!fetched.ok) return failed(fetched.message);
    text = fetched.text;
    sheetsUrl = sheetsUrlRaw;
    sourceFilename = "Google Sheets";
  } else {
    return failed("Drop a CSV file, or paste a Google Sheets link.");
  }

  const parsed = parseCsv(text);
  if (!parsed.ok) return failed(parsed.message);

  try {
    const person = await actor();
    if (!person) return failed(NO_SESSION);

    const supabase = await createClient();

    // Best-effort: a storage failure doesn't block the run — the parsed rows
    // are already safe in the database with source_path left null.
    let sourcePath: string | null = null;
    if (file instanceof File && file.size > 0) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120);
      const path = `${person.id}/${Date.now().toString(36)}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(UPLOAD_BUCKET)
        .upload(path, file, { contentType: file.type || "text/csv", upsert: false });
      if (!uploadError) sourcePath = path;
    }

    const { data: runRow, error: runError } = await supabase
      .from("audit_runs")
      .insert({
        client_id: clientId,
        name: sourceFilename,
        source_filename: sourceFilename,
        source_path: sourcePath,
        sheets_url: sheetsUrl,
        row_count: parsed.rows.length,
        status: "uploaded",
        created_by: person.id,
      })
      .select("id")
      .single();
    if (runError) return failed(`The upload was not saved — ${runError.message}.`);

    const runId = str((runRow as unknown as Row).id);

    const { error: rowsError } = await supabase
      .from("audit_rows")
      .insert(parsed.rows.map((raw, index) => ({ run_id: runId, row_index: index, raw })));
    if (rowsError) {
      return failed(`The file's rows could not be saved — ${rowsError.message}. Nothing else was changed.`);
    }

    await recordAudit({
      actorId: person.id,
      actorEmail: person.email,
      action: "audit_run.uploaded",
      entityType: "audit_runs",
      entityId: runId,
      summary: `Uploaded ${sourceFilename} (${parsed.rows.length} rows)`,
    });

    const suggestedMap = await suggestedColumnMap(clientId, parsed.headers, parsed.rows.slice(0, 5));

    revalidatePath("/audits");
    return {
      ok: true,
      data: { runId, rowCount: parsed.rows.length, headers: parsed.headers, preview: parsed.rows.slice(0, 5), suggestedMap },
    };
  } catch (cause) {
    return failed(`The upload was not saved — ${reasonOf(cause)}.`);
  }
}

/* ── Map ──────────────────────────────────────────────────────────────────── */

export async function saveMappingAction(
  runId: string,
  columnMap: ColumnMap,
): Promise<ActionResult<{ rowCount: number }>> {
  const missing = COLUMN_ROLES.filter((role) => !columnMap[role]);
  if (missing.length > 0) {
    return failed(
      `Every column needs a match before this can be computed — ${missing.length} still ${missing.length === 1 ? "does" : "do"} not.`,
    );
  }

  try {
    const person = await actor();
    if (!person) return failed(NO_SESSION);

    const supabase = await createClient();
    const { data: rowsData, error: rowsError } = await supabase
      .from("audit_rows")
      .select("id, run_id, row_index, raw")
      .eq("run_id", runId)
      .order("row_index", { ascending: true });
    if (rowsError) return failed(`Couldn't read the uploaded rows — ${rowsError.message}.`);

    const rows = (rowsData ?? []) as unknown as Row[];
    if (rows.length === 0) return failed("This run has no rows to map.");

    const updates = rows.map((row) => {
      const canonical = normalizeCanonicalRow(row.raw as Record<string, string>, columnMap, Number(row.row_index));
      return {
        id: str(row.id),
        run_id: str(row.run_id),
        row_index: Number(row.row_index),
        raw: row.raw,
        disposition: canonical.disposition,
        qa_name: canonical.qaName,
        accurate: canonical.accurate,
        corrected_disposition: canonical.correctedDisposition,
      };
    });
    const { error: upsertError } = await supabase.from("audit_rows").upsert(updates, { onConflict: "id" });
    if (upsertError) return failed(`The mapping was not saved — ${upsertError.message}.`);

    const { error: runUpdateError } = await supabase
      .from("audit_runs")
      .update({ column_map: columnMap, status: "mapped" })
      .eq("id", runId);
    if (runUpdateError) return failed(`The mapping was not saved — ${runUpdateError.message}.`);

    await recordAudit({
      actorId: person.id,
      actorEmail: person.email,
      action: "audit_run.mapped",
      entityType: "audit_runs",
      entityId: runId,
      summary: `Mapped ${rows.length} rows`,
      diff: { columnMap },
    });

    revalidatePath(`/audits/${runId}`);
    return { ok: true, data: { rowCount: rows.length } };
  } catch (cause) {
    return failed(`The mapping was not saved — ${reasonOf(cause)}.`);
  }
}

/* ── Compute ──────────────────────────────────────────────────────────────── */

async function loadCanonicalRows(runId: string, columnMap: ColumnMap): Promise<{ rows: CanonicalRow[]; rawRows: Row[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_rows")
    .select("id, row_index, raw, issue_tags")
    .eq("run_id", runId)
    .order("row_index", { ascending: true });
  if (error) throw new Error(error.message);
  const rawRows = (data ?? []) as unknown as Row[];
  const rows = rawRows.map((r) => normalizeCanonicalRow(r.raw as Record<string, string>, columnMap, Number(r.row_index)));
  return { rows, rawRows };
}

export async function computeReportAction(runId: string): Promise<ActionResult<{ metrics: ComputedMetrics }>> {
  try {
    const person = await actor();
    if (!person) return failed(NO_SESSION);

    const supabase = await createClient();
    const { data: runData, error: runError } = await supabase
      .from("audit_runs")
      .select("id, column_map")
      .eq("id", runId)
      .maybeSingle();
    if (runError) return failed(`Couldn't read this run — ${runError.message}.`);
    if (!runData) return failed("This audit run no longer exists.");

    const columnMap = ((runData as unknown as Row).column_map ?? {}) as ColumnMap;
    if (COLUMN_ROLES.some((role) => !columnMap[role])) {
      return failed("Map every column before computing — go back to the Map step.");
    }

    const { rows, rawRows } = await loadCanonicalRows(runId, columnMap);
    if (rows.length === 0) return failed("This run has no rows to compute.");

    const taxonomy = await loadActiveTaxonomy();
    const override = new Map<number, string[]>();
    for (const r of rawRows) {
      const tags = Array.isArray(r.issue_tags) ? (r.issue_tags as string[]) : [];
      if (tags.length > 0) override.set(Number(r.row_index), tags);
    }

    const { metrics, rowTags } = computeDeterministic(rows, taxonomy, override.size > 0 ? override : undefined);

    const tagUpdates = rawRows.map((r) => ({
      id: str(r.id),
      run_id: runId,
      row_index: Number(r.row_index),
      raw: r.raw,
      issue_tags: rowTags.get(Number(r.row_index)) ?? [],
    }));
    const { error: tagError } = await supabase.from("audit_rows").upsert(tagUpdates, { onConflict: "id" });
    if (tagError) return failed(`Couldn't save the taxonomy tags — ${tagError.message}.`);

    const { error: metricsError } = await supabase
      .from("audit_runs")
      .update({ metrics: metrics as unknown as Row, status: "computed" })
      .eq("id", runId);
    if (metricsError) return failed(`The report was computed but not saved — ${metricsError.message}.`);

    await recordAudit({
      actorId: person.id,
      actorEmail: person.email,
      action: "audit_run.computed",
      entityType: "audit_runs",
      entityId: runId,
      summary: `Computed §1-5 for ${rows.length} rows`,
    });

    revalidatePath(`/audits/${runId}`);
    return { ok: true, data: { metrics } };
  } catch (cause) {
    return failed(`The report was not computed — ${reasonOf(cause)}.`);
  }
}

export async function generateNarrativeAction(runId: string): Promise<ActionResult<{ narrative: NarrativeResult }>> {
  try {
    const person = await actor();
    if (!person) return failed(NO_SESSION);

    const supabase = await createClient();
    const { data: runData, error: runError } = await supabase
      .from("audit_runs")
      .select("id, column_map, metrics, clients:client_id ( name )")
      .eq("id", runId)
      .maybeSingle();
    if (runError) return failed(`Couldn't read this run — ${runError.message}.`);
    if (!runData) return failed("This audit run no longer exists.");

    const run = runData as unknown as Row;
    const clientName = str((run.clients as Row | null)?.name) || "this client";
    const columnMap = (run.column_map ?? {}) as ColumnMap;
    const metrics = (run.metrics ?? {}) as unknown as ComputedMetrics;

    const { rows } = await loadCanonicalRows(runId, columnMap);
    const narrative = await buildNarrative(rows, metrics, clientName);

    const { error: narrativeError } = await supabase
      .from("audit_runs")
      .update({ narrative: narrative as unknown as Row })
      .eq("id", runId);
    if (narrativeError) return failed(`The narrative was drafted but not saved — ${narrativeError.message}.`);

    await recordAudit({
      actorId: person.id,
      actorEmail: person.email,
      action: "audit_run.narrative_generated",
      entityType: "audit_runs",
      entityId: runId,
      summary:
        narrative.fatalErrorsAvailable || narrative.observationsAvailable
          ? "Drafted §6-7 with AI"
          : "§6-7 left for a human — no AI key configured",
    });

    revalidatePath(`/audits/${runId}`);
    return { ok: true, data: { narrative } };
  } catch (cause) {
    return failed(`The narrative was not generated — ${reasonOf(cause)}.`);
  }
}

/* ── Review edits ─────────────────────────────────────────────────────────── */

export type RowPatch = { isFatal?: boolean; fatalReason?: string; issueTags?: string[] };

/**
 * Edits one row and recomputes only §5's frequency table — §1-4 are fixed
 * arithmetic the moment Compute runs and are never touched here.
 */
export async function updateRowAction(
  runId: string,
  rowIndex: number,
  patch: RowPatch,
): Promise<ActionResult<{ metrics: ComputedMetrics }>> {
  try {
    const person = await actor();
    if (!person) return failed(NO_SESSION);

    const supabase = await createClient();
    const rowPatch: Row = {};
    if (patch.isFatal !== undefined) rowPatch.is_fatal = patch.isFatal;
    if (patch.fatalReason !== undefined) rowPatch.fatal_reason = patch.fatalReason;
    if (patch.issueTags !== undefined) rowPatch.issue_tags = patch.issueTags;

    if (Object.keys(rowPatch).length > 0) {
      const { error } = await supabase.from("audit_rows").update(rowPatch).eq("run_id", runId).eq("row_index", rowIndex);
      if (error) return failed(`That row was not saved — ${error.message}.`);
    }

    const { data: runData, error: runError } = await supabase
      .from("audit_runs")
      .select("metrics")
      .eq("id", runId)
      .maybeSingle();
    if (runError || !runData) return failed("Couldn't reload this run to recompute §5.");
    const metrics = ((runData as unknown as Row).metrics ?? {}) as unknown as ComputedMetrics;

    const { data: rowsData } = await supabase.from("audit_rows").select("row_index, issue_tags").eq("run_id", runId);
    const taxonomy = await loadActiveTaxonomy();
    const taggedRows = ((rowsData ?? []) as unknown as Row[]).map((r) => ({
      rowIndex: Number(r.row_index),
      issueTags: Array.isArray(r.issue_tags) ? (r.issue_tags as string[]) : [],
    }));
    const parameterFrequency = computeParameterFrequency(taggedRows, taxonomy, taggedRows.length);
    const nextMetrics: ComputedMetrics = { ...metrics, parameterFrequency };

    const { error: metricsError } = await supabase
      .from("audit_runs")
      .update({ metrics: nextMetrics as unknown as Row })
      .eq("id", runId);
    if (metricsError) return failed(`§5 was recomputed but not saved — ${metricsError.message}.`);

    await recordAudit({
      actorId: person.id,
      actorEmail: person.email,
      action: "audit_run.row_edited",
      entityType: "audit_runs",
      entityId: runId,
      summary: `Edited row ${rowIndex + 1}`,
      diff: patch as Record<string, unknown>,
    });

    revalidatePath(`/audits/${runId}`);
    return { ok: true, data: { metrics: nextMetrics } };
  } catch (cause) {
    return failed(`That row was not saved — ${reasonOf(cause)}.`);
  }
}

export type NarrativePatch = {
  fatalErrors?: NarrativeResult["fatalErrors"];
  observations?: NarrativeResult["observations"];
};

/** The human sign-off edits to §6/§7's prose itself. */
export async function updateNarrativeAction(
  runId: string,
  patch: NarrativePatch,
): Promise<ActionResult<{ narrative: NarrativeResult }>> {
  try {
    const person = await actor();
    if (!person) return failed(NO_SESSION);

    const supabase = await createClient();
    const { data, error } = await supabase.from("audit_runs").select("narrative").eq("id", runId).maybeSingle();
    if (error || !data) return failed("Couldn't reload this run's narrative.");
    const current = ((data as unknown as Row).narrative ?? {}) as unknown as NarrativeResult;

    const next: NarrativeResult = {
      fatalErrors: patch.fatalErrors ?? current.fatalErrors ?? [],
      fatalErrorsAvailable: patch.fatalErrors ? true : (current.fatalErrorsAvailable ?? false),
      qualifyingFatalRowIndexes: current.qualifyingFatalRowIndexes ?? [],
      observations: patch.observations ?? current.observations ?? [],
      observationsAvailable: patch.observations ? true : (current.observationsAvailable ?? false),
      unavailableReason: current.unavailableReason,
    };

    const { error: updateError } = await supabase
      .from("audit_runs")
      .update({ narrative: next as unknown as Row })
      .eq("id", runId);
    if (updateError) return failed(`The narrative was not saved — ${updateError.message}.`);

    await recordAudit({
      actorId: person.id,
      actorEmail: person.email,
      action: "audit_run.narrative_edited",
      entityType: "audit_runs",
      entityId: runId,
      summary: "Edited §6/§7 by hand",
    });

    revalidatePath(`/audits/${runId}`);
    return { ok: true, data: { narrative: next } };
  } catch (cause) {
    return failed(`The narrative was not saved — ${reasonOf(cause)}.`);
  }
}

/* ── Recipients ───────────────────────────────────────────────────────────── */

export async function loadAuditRecipientsAction(clientId: string): Promise<ActionResult<RecipientChoice[]>> {
  if (!clientId) return failed("This run has no client attached.");
  const { listClientContacts } = await import("@/lib/queries/clients");
  const result = await listClientContacts(clientId);
  if (!result.ok) return failed(`Couldn't load this client's contacts — ${result.reason}.`);
  return {
    ok: true,
    data: result.data.rows.map((c) => ({
      key: c.id,
      contactId: c.id,
      email: c.email,
      fullName: c.fullName,
      title: c.title,
      isInternal: c.isInternal,
      bouncedAt: c.bouncedAt,
      isActive: c.isActive,
    })),
  };
}

/* ── Send ─────────────────────────────────────────────────────────────────── */

export type SentAuditReport = { campaignId: string; attempted: number; accepted: number; failed: number };

type RunForSend = {
  id: string;
  client_id: unknown;
  name: unknown;
  period_label: unknown;
  status: unknown;
  column_map: unknown;
  metrics: unknown;
  narrative: unknown;
  clients: unknown;
};

async function loadRunForSend(supabase: SupabaseClient, runId: string): Promise<RunForSend | { error: string }> {
  const { data, error } = await supabase
    .from("audit_runs")
    .select("id, client_id, name, period_label, status, column_map, metrics, narrative, clients:client_id ( name )")
    .eq("id", runId)
    .maybeSingle();
  if (error) return { error: `Couldn't read this run — ${error.message}.` };
  if (!data) return { error: "This audit run no longer exists." };
  return data as unknown as RunForSend;
}

/**
 * Builds the report sections, generates the PDF (uploaded to the same public
 * bucket every other campaign attachment already uses — a recipient must be
 * able to open it from an email with no login), and drafts the summary body.
 * Shared between the real send and the test send, so a test copy is built
 * exactly the way the real one is, not a separate approximation.
 */
async function buildAuditArtifacts(input: {
  supabase: SupabaseClient;
  personId: string;
  runId: string;
  runName: string;
  clientName: string;
  periodLabel: string;
  columnMap: ColumnMap;
  metrics: ComputedMetrics;
  narrative: NarrativeResult;
  reportUrl: string | null;
  pdfSuffix?: string;
}): Promise<{ ok: true; sections: ReportSection[]; pdfName: string; pdfUrl: string | null; summaryBody: string } | { ok: false; message: string }> {
  const { supabase, personId, runId, clientName, periodLabel, columnMap, metrics, narrative, reportUrl, pdfSuffix = "call-audit" } = input;

  const { rows } = await loadCanonicalRows(runId, columnMap);
  const sections = buildReportDocument({ rows, computed: metrics, narrative });

  const pdfBuffer = await renderAuditReportPdf({ clientName, periodLabel, sections });
  const pdfName = `${clientName.replace(/[^a-zA-Z0-9]+/g, "-")}-${pdfSuffix}.pdf`;
  const pdfPath = `${personId}/${Date.now().toString(36)}-${pdfName}`;
  const { error: pdfUploadError } = await supabase.storage
    .from("report-media")
    .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: false });
  if (pdfUploadError) return { ok: false, message: `The PDF could not be generated — ${pdfUploadError.message}.` };

  const { data: pdfUrlData } = supabase.storage.from("report-media").getPublicUrl(pdfPath);
  const pdfUrl = str((pdfUrlData as unknown as Row)?.publicUrl) || null;

  const accuracyPct = metrics.overall.accuracyRatePct;
  const summaryBody = [
    "Hi {{contact_first_name}},",
    "",
    `The call audit report${periodLabel ? ` for ${periodLabel}` : ""} is ready.`,
    "",
    `${metrics.overall.totalAudited} calls audited, ${metrics.overall.accurate} accurate` +
      (accuracyPct === null ? "." : ` — ${accuracyPct}% overall.`),
    "",
    reportUrl ? "The full report is linked below, with the PDF attached." : "The PDF is attached below.",
  ].join("\n");

  return { ok: true, sections, pdfName, pdfUrl, summaryBody };
}

export async function sendAuditReportAction(
  runId: string,
  chosen: RecipientChoice[],
): Promise<ActionResult<SentAuditReport>> {
  try {
    const person = await actor();
    if (!person) return failed(NO_SESSION);

    const supabase = await createClient();
    const loaded = await loadRunForSend(supabase, runId);
    if ("error" in loaded) return failed(loaded.error);
    const run = loaded as unknown as Row;

    const clientId = str(run.client_id);
    const clientName = str((run.clients as Row | null)?.name);
    if (!clientId || !clientName) return failed("This run has no client attached, so nothing was sent.");
    if (run.status !== "computed") {
      return failed("Compute the report before sending — go back to the Compute step.");
    }

    const domains = internalDomains();
    const usable = chosen
      .filter((c) => c.isActive && c.email.includes("@"))
      .map((c) => ({
        contactId: c.contactId,
        email: c.email.trim().toLowerCase(),
        fullName: c.fullName,
        isInternal: c.isInternal || isInternalEmail(c.email, domains),
      }));
    if (usable.length === 0) return failed("Nobody is selected, so nothing was sent. Choose recipients first.");
    // An internal-only send is allowed — a deliberate internal review send
    // is a real use case, not blocked, just never mistaken for reaching a
    // client (internal recipients stay excluded from every reported figure).

    const metrics = (run.metrics ?? {}) as unknown as ComputedMetrics;
    const narrative = (run.narrative ?? {}) as unknown as NarrativeResult;
    const columnMap = (run.column_map ?? {}) as ColumnMap;
    const periodLabel = str(run.period_label);
    const reportUrl = `${env.NEXT_PUBLIC_APP_URL}/r/${runId}`;

    const artifacts = await buildAuditArtifacts({
      supabase,
      personId: person.id,
      runId,
      runName: str(run.name),
      clientName,
      periodLabel,
      columnMap,
      metrics,
      narrative,
      reportUrl,
    });
    if (!artifacts.ok) return failed(`${artifacts.message} Nothing was sent.`);
    const { pdfName, pdfUrl, summaryBody } = artifacts;

    const { data: created, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        client_id: clientId,
        title: str(run.name) ? `${str(run.name)} — Call Audit` : "Call Audit Report",
        period_label: periodLabel,
        subject: `Call audit report${periodLabel ? ` — ${periodLabel}` : ""}`,
        body_md: summaryBody,
        template_key: "convin-premium",
        report_url: reportUrl,
        attachment_name: pdfName,
        attachment_url: pdfUrl || null,
        feedback_enabled: true,
        status: "sending",
        is_test: false,
        created_by: person.id,
      })
      .select("id")
      .single();
    if (campaignError) return failed(`Nothing was sent — ${campaignError.message}.`);

    const campaignId = str((created as unknown as Row).id);
    const admin = createAdminClient();
    const { error: recipientError } = await admin.from("campaign_recipients").insert(
      usable.map((u) => ({
        campaign_id: campaignId,
        contact_id: u.contactId,
        email: u.email,
        full_name: u.fullName,
        is_internal: u.isInternal,
      })),
    );
    if (recipientError) {
      await supabase.from("campaigns").update({ status: "failed" }).eq("id", campaignId);
      return failed(`The campaign was created but its recipients were not — ${recipientError.message}.`);
    }

    const outcome = await dispatchCampaign(admin, campaignId);
    const sentOk = outcome.ok && outcome.accepted > 0;

    await supabase
      .from("campaigns")
      .update({ status: sentOk ? "sent" : "failed", sent_at: new Date().toISOString() })
      .eq("id", campaignId);
    await supabase
      .from("audit_runs")
      .update({ campaign_id: campaignId, status: sentOk ? "sent" : "failed" })
      .eq("id", runId);

    await recordAudit({
      actorId: person.id,
      actorEmail: person.email,
      action: "audit_run.sent",
      entityType: "audit_runs",
      entityId: runId,
      summary: sentOk
        ? `Sent the audit report to ${outcome.ok ? outcome.accepted : 0} of ${usable.length} for ${clientName}`
        : `Send failed for ${clientName}`,
      diff: { campaign_id: campaignId },
    });

    revalidatePath("/audits");
    revalidatePath(`/audits/${runId}`);
    revalidatePath("/campaigns");

    if (!outcome.ok) return failed(`Nothing was sent — ${outcome.reason}.`);
    return { ok: true, data: { campaignId, attempted: outcome.attempted, accepted: outcome.accepted, failed: outcome.failed } };
  } catch (cause) {
    return failed(`Nothing was sent — ${reasonOf(cause)}.`);
  }
}

/**
 * A copy marked as a test in the email itself, addressed to whatever address
 * is given — the signed-in person's own by default, but not limited to it.
 * It writes no campaign and no recipient row regardless of the address, so
 * it can never reach a client contact and never touches this run's status.
 * This is the one exercise-the-real-send-path route this feature should
 * ever need for verification.
 */
export async function sendTestAuditReportAction(runId: string, testEmail?: string): Promise<ActionResult<string>> {
  try {
    const person = await actor();
    if (!person) return failed(NO_SESSION);

    const to = testEmail?.trim() || person.email;
    if (!isEmailShaped(to)) {
      return failed("That doesn't look like an email address. Fix it and try again.");
    }

    const supabase = await createClient();
    const loaded = await loadRunForSend(supabase, runId);
    if ("error" in loaded) return failed(loaded.error);
    const run = loaded as unknown as Row;

    const clientName = str((run.clients as Row | null)?.name) || "this client";
    if (run.status !== "computed" && run.status !== "sent") {
      return failed("Compute the report before sending a test — go back to the Compute step.");
    }

    const metrics = (run.metrics ?? {}) as unknown as ComputedMetrics;
    const narrative = (run.narrative ?? {}) as unknown as NarrativeResult;
    const columnMap = (run.column_map ?? {}) as ColumnMap;
    const periodLabel = str(run.period_label);

    const artifacts = await buildAuditArtifacts({
      supabase,
      personId: person.id,
      runId,
      runName: str(run.name),
      clientName,
      periodLabel,
      columnMap,
      metrics,
      narrative,
      // No hosted-report link: /r/[id] only renders once the run is actually
      // sent, and a test send must never flip that status.
      reportUrl: null,
      pdfSuffix: "call-audit-test",
    });
    if (!artifacts.ok) return failed(`The test was not sent — ${artifacts.message}`);
    const { pdfName, pdfUrl, summaryBody } = artifacts;

    const rendered = renderReportEmail({
      templateKey: "convin-premium",
      appUrl: env.NEXT_PUBLIC_APP_URL,
      // A hex-shaped token that resolves to no recipient — preview links are inert, same as Compose's.
      token: "0".repeat(48),
      clientName,
      contactFirstName: (person.fullName || person.email).trim().split(/\s+/)[0],
      reportNumber: null,
      reportTitle: str(run.name) ? `${str(run.name)} — Call Audit` : "Call Audit Report",
      periodLabel,
      subject: `Call audit report${periodLabel ? ` — ${periodLabel}` : ""}`,
      bodyMd: summaryBody,
      reportUrl: null,
      attachment: pdfUrl ? { name: pdfName, url: pdfUrl } : null,
      feedback: { enabled: false, question: "", askComment: false },
      signature: {
        name: person.fullName || person.email,
        title: "Client Reporting",
        org: "Convin Data Labs",
        replyTo: person.email,
      },
      isTest: true,
    });

    const result = await sendEmail({
      to,
      subject: `[Test] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
      replyTo: person.email,
      headers: { ...rendered.headers, "X-CDL-Test": "1" },
    });
    if (!result.ok) return failed(`The test was not sent — ${result.error}. Nothing about the run changed.`);

    return { ok: true, data: to };
  } catch (cause) {
    return failed(`The test was not sent — ${reasonOf(cause)}.`);
  }
}

/* ── Taxonomy ─────────────────────────────────────────────────────────────── */

export async function listTaxonomyAction(): Promise<ActionResult<TaxonomyParameter[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("audit_taxonomy")
      .select("id, label, patterns, sort_order, is_active")
      .order("sort_order", { ascending: true });
    if (error) return failed(`Couldn't load the taxonomy — ${error.message}.`);
    return {
      ok: true,
      data: ((data ?? []) as unknown as Row[]).map((r) => ({
        id: str(r.id),
        label: str(r.label),
        patterns: Array.isArray(r.patterns) ? (r.patterns as string[]) : [],
        sortOrder: Number(r.sort_order ?? 0),
        isActive: r.is_active !== false,
      })),
    };
  } catch (cause) {
    return failed(`Couldn't load the taxonomy — ${reasonOf(cause)}.`);
  }
}

export async function saveTaxonomyParameterAction(param: {
  id?: string;
  label: string;
  patterns: string[];
  sortOrder: number;
  isActive: boolean;
}): Promise<ActionResult<TaxonomyParameter>> {
  const label = param.label.trim();
  if (!label) return failed("A parameter needs a name.");

  try {
    const person = await actor();
    if (!person) return failed(NO_SESSION);

    const supabase = await createClient();
    const payload = {
      label,
      patterns: param.patterns.map((p) => p.trim()).filter(Boolean),
      sort_order: param.sortOrder,
      is_active: param.isActive,
    };

    const { data, error } = param.id
      ? await supabase.from("audit_taxonomy").update(payload).eq("id", param.id).select("id, label, patterns, sort_order, is_active").single()
      : await supabase.from("audit_taxonomy").insert(payload).select("id, label, patterns, sort_order, is_active").single();

    if (error) {
      const duplicate = error.code === "23505";
      return failed(duplicate ? `A parameter named ${label} already exists.` : `Not saved — ${error.message}.`);
    }

    const row = data as unknown as Row;
    await recordAudit({
      actorId: person.id,
      actorEmail: person.email,
      action: "audit_taxonomy.updated",
      entityType: "audit_taxonomy",
      entityId: str(row.id),
      summary: `${param.id ? "Updated" : "Added"} taxonomy parameter ${label}`,
    });

    revalidatePath("/audits");
    return {
      ok: true,
      data: {
        id: str(row.id),
        label: str(row.label),
        patterns: Array.isArray(row.patterns) ? (row.patterns as string[]) : [],
        sortOrder: Number(row.sort_order ?? 0),
        isActive: row.is_active !== false,
      },
    };
  } catch (cause) {
    return failed(`Not saved — ${reasonOf(cause)}.`);
  }
}

export async function deactivateTaxonomyParameterAction(id: string): Promise<ActionResult<void>> {
  try {
    const person = await actor();
    if (!person) return failed(NO_SESSION);
    const supabase = await createClient();
    const { error } = await supabase.from("audit_taxonomy").update({ is_active: false }).eq("id", id);
    if (error) return failed(`Not deactivated — ${error.message}.`);
    await recordAudit({
      actorId: person.id,
      actorEmail: person.email,
      action: "audit_taxonomy.updated",
      entityType: "audit_taxonomy",
      entityId: id,
      summary: "Deactivated a taxonomy parameter",
    });
    revalidatePath("/audits");
    return { ok: true, data: undefined };
  } catch (cause) {
    return failed(`Not deactivated — ${reasonOf(cause)}.`);
  }
}

export async function deleteTaxonomyParameterAction(id: string): Promise<ActionResult<void>> {
  try {
    const person = await actor();
    if (!person) return failed(NO_SESSION);
    if (person.role !== "admin" && person.role !== "team_lead") {
      return failed("Only a manager can permanently delete a taxonomy parameter. Deactivate it instead.");
    }
    const supabase = await createClient();
    const { error } = await supabase.from("audit_taxonomy").delete().eq("id", id);
    if (error) return failed(`Not deleted — ${error.message}.`);
    await recordAudit({
      actorId: person.id,
      actorEmail: person.email,
      action: "audit_taxonomy.deleted",
      entityType: "audit_taxonomy",
      entityId: id,
      summary: "Deleted a taxonomy parameter",
    });
    revalidatePath("/audits");
    return { ok: true, data: undefined };
  } catch (cause) {
    return failed(`Not deleted — ${reasonOf(cause)}.`);
  }
}
