/**
 * Sections 6-7 — the judgement tier, clearly labelled as such. Every export
 * here is safe to call with no `ANTHROPIC_API_KEY` configured: `aiAvailable()`
 * is checked once, up front, and every path below it still returns a fully
 * populated `NarrativeResult` rather than throwing or leaving a section out.
 *
 * `streamCompletion` (src/lib/ai.ts) has no structured-output mode, so this
 * file owns a small delimited plain-text contract and a tolerant, per-section
 * parser: a malformed §7 block degrades only §7 to "unavailable," never §6,
 * and vice versa. `candidateFatalRows` is a deterministic pre-filter that
 * runs with or without a key, so "qualifying rows for a human to write up"
 * is never empty just because there was no model to ask.
 */

import { aiAvailable, streamCompletion } from "@/lib/ai";
import type {
  CanonicalRow,
  ComputedMetrics,
  FatalErrorEntry,
  NarrativeResult,
  ObservationEntry,
  TaxonomyParameter,
} from "./types";
import { EMPTY_NARRATIVE } from "./types";

const SEVERE_CORRECTIONS = new Set(["cold", "not interested"]);

/** Issue rows corrected to a severe disposition — a fatal-error shortlist that needs no AI to exist. */
export function candidateFatalRows(rows: CanonicalRow[]): number[] {
  return rows
    .filter((row) => row.accurate === false && SEVERE_CORRECTIONS.has(row.correctedDispositionKey))
    .map((row) => row.rowIndex);
}

async function collectText(result: Awaited<ReturnType<typeof streamCompletion>>): Promise<string | null> {
  if (!result.ok) return null;
  let text = "";
  for await (const chunk of result.chunks) text += chunk;
  return text;
}

function rowByIndex(rows: CanonicalRow[]): Map<number, CanonicalRow> {
  return new Map(rows.map((row) => [row.rowIndex, row]));
}

const FATAL_LINE = /^ROW\s*=\s*(\d+)\s*\|\s*FLAG\s*=\s*(.*?)\s*\|\s*REASON\s*=\s*(.*)$/i;

function parseFatalBlock(text: string, validRowIndexes: Set<number>): FatalErrorEntry[] | null {
  const trimmed = text.trim();
  if (trimmed.length < 5) return []; // a short/empty reply is a legitimate "none are fatal"
  const entries: FatalErrorEntry[] = [];
  for (const line of trimmed.split("\n")) {
    const match = FATAL_LINE.exec(line.trim());
    if (!match) continue;
    const rowIndex = Number(match[1]);
    if (!validRowIndexes.has(rowIndex)) continue;
    entries.push({ rowIndex, fatalFlag: match[2].trim(), reason: match[3].trim() });
  }
  return entries.length > 0 ? entries : null; // non-trivial reply, nothing recognisable → unparseable
}

const OBSERVATION_FIELD = /^(THEME|FINDING|RECOMMENDATION)\s*=\s*(.*)$/i;

function parseObservationsBlock(text: string): ObservationEntry[] | null {
  const trimmed = text.trim();
  if (trimmed.length < 5) return [];
  const blocks = trimmed.split(/^\s*---\s*$/m);
  const entries: ObservationEntry[] = [];
  for (const block of blocks) {
    const fields: Partial<Record<"theme" | "finding" | "recommendation", string>> = {};
    for (const line of block.split("\n")) {
      const match = OBSERVATION_FIELD.exec(line.trim());
      if (!match) continue;
      fields[match[1].toLowerCase() as "theme" | "finding" | "recommendation"] = match[2].trim();
    }
    if (fields.theme && fields.finding && fields.recommendation) {
      entries.push({ theme: fields.theme, finding: fields.finding, recommendation: fields.recommendation });
    }
  }
  return entries.length > 0 ? entries : null;
}

function formatMetricsForPrompt(computed: ComputedMetrics): string {
  const lines: string[] = [];
  lines.push(
    `Overall: ${computed.overall.totalAudited} audited, ${computed.overall.accurate} accurate, ` +
      `${computed.overall.inaccurate} inaccurate (${computed.overall.accuracyRatePct}%).`,
  );
  lines.push(
    "Disposition distribution: " +
      computed.dispositionDistribution.map((d) => `${d.disposition} ${d.count} (${d.pctOfTotal}%)`).join(", "),
  );
  lines.push(
    "Mismatches: " +
      (computed.mismatchAnalysis.map((m) => `${m.original}→${m.corrected} ${m.count}`).join(", ") || "none"),
  );
  lines.push(
    "Per-disposition accuracy: " +
      computed.perDispositionAccuracy
        .map((p) => `${p.disposition} ${p.accurate}/${p.total} (${p.accuracyRatePct}%)`)
        .join(", "),
  );
  lines.push(
    "Top issue parameters: " +
      computed.parameterFrequency
        .filter((p) => p.issuesFound > 0)
        .slice(0, 5)
        .map((p) => `${p.label} ${p.issuesFound}`)
        .join(", "),
  );
  return lines.join("\n");
}

/**
 * Asks the model to pick zero or more labels from the CLOSED, existing
 * taxonomy for rows the keyword pass tagged with nothing despite real text —
 * never invents a new parameter. Returns only the additional tags to merge
 * in; a row it can't place stays untagged rather than guessed.
 */
export async function reconcileAmbiguousParameters(
  rows: CanonicalRow[],
  rowTags: Map<number, string[]>,
  taxonomy: TaxonomyParameter[],
): Promise<Map<number, string[]>> {
  const additions = new Map<number, string[]>();
  if (!aiAvailable()) return additions;

  const active = taxonomy.filter((param) => param.isActive);
  const ambiguous = rows.filter((row) => {
    const tags = rowTags.get(row.rowIndex) ?? [];
    return tags.length === 0 && (row.observation.trim() || row.improvement.trim());
  });
  if (ambiguous.length === 0) return additions;

  const labelById = new Map(active.map((param) => [param.id, param.label]));
  const system =
    "You are reconciling call-audit observations against a fixed list of quality parameters. " +
    "For each row below, if the text clearly indicates one or more of these parameters, output a line " +
    `ROW=<row> | LABELS=<comma-separated exact labels>. Only use labels from this list: ` +
    `${active.map((param) => param.label).join(" | ")}. If a row matches none of them, omit it entirely. ` +
    "Never invent a label that isn't in the list. Output nothing but matching lines.";
  const prompt = ambiguous
    .map((row) => `Row ${row.rowIndex} | Observation: ${row.observation} | Improvement: ${row.improvement}`)
    .join("\n");

  const text = await collectText(await streamCompletion({ system, prompt, maxTokens: 1024 }));
  if (!text) return additions;

  const labelToId = new Map(active.map((param) => [param.label.toLowerCase(), param.id]));
  const validRowIndexes = new Set(ambiguous.map((row) => row.rowIndex));
  const line = /^ROW\s*=\s*(\d+)\s*\|\s*LABELS\s*=\s*(.*)$/i;
  for (const raw of text.split("\n")) {
    const match = line.exec(raw.trim());
    if (!match) continue;
    const rowIndex = Number(match[1]);
    if (!validRowIndexes.has(rowIndex)) continue;
    const ids = match[2]
      .split(",")
      .map((label) => labelToId.get(label.trim().toLowerCase()))
      .filter((id): id is string => Boolean(id));
    if (ids.length > 0) additions.set(rowIndex, ids);
    void labelById; // kept for readability of the mapping above
  }
  return additions;
}

async function generateFatalErrors(
  rows: CanonicalRow[],
  candidateIndexes: number[],
): Promise<{ fatalErrors: FatalErrorEntry[]; available: boolean }> {
  if (candidateIndexes.length === 0) return { fatalErrors: [], available: true };
  const byIndex = rowByIndex(rows);
  const system =
    "You are assisting a QA analyst reviewing call-audit results. You will be given candidate call " +
    "records that were marked inaccurate with a significant disposition correction. A row is fatal only " +
    "when the disposition cannot be trusted AT ALL — wrong person on the call, the customer never engaged, " +
    "or a technical failure (e.g. a transcription error) that invalidated the conversation. Not every " +
    "corrected disposition is fatal. For each genuinely fatal row, output exactly one line:\n" +
    "ROW=<row index> | FLAG=<a short 3-8 word label> | REASON=<one or two sentences>\n" +
    "Output nothing else — no preamble, no numbering. If none are fatal, output nothing.";
  const prompt = candidateIndexes
    .map((index) => {
      const row = byIndex.get(index);
      if (!row) return "";
      return (
        `Row ${row.rowIndex} | Disposition: ${row.disposition} → ${row.correctedDisposition} | ` +
        `QA: ${row.qaName} | Observation: ${row.observation} | Improvement: ${row.improvement}`
      );
    })
    .filter(Boolean)
    .join("\n");

  const text = await collectText(await streamCompletion({ system, prompt, maxTokens: 1536 }));
  if (text === null) return { fatalErrors: [], available: false };
  const parsed = parseFatalBlock(text, new Set(candidateIndexes));
  return parsed === null ? { fatalErrors: [], available: false } : { fatalErrors: parsed, available: true };
}

async function generateObservations(
  computed: ComputedMetrics,
  clientName: string,
): Promise<{ observations: ObservationEntry[]; available: boolean }> {
  const system =
    `You are drafting the Observations & Insights section of a call-audit report for ${clientName}. ` +
    "Identify 3-5 themes grounded in the figures given. For each, output:\n" +
    "THEME=<short theme name>\nFINDING=<what the data shows, citing specific figures>\n" +
    "RECOMMENDATION=<one concrete, actionable next step>\n" +
    "Separate entries with a line containing only ---. Output nothing else — no preamble, no markdown.";
  const prompt = formatMetricsForPrompt(computed);

  const text = await collectText(await streamCompletion({ system, prompt, maxTokens: 2048 }));
  if (text === null) return { observations: [], available: false };
  const parsed = parseObservationsBlock(text);
  return parsed === null ? { observations: [], available: false } : { observations: parsed, available: true };
}

/**
 * The single entry point the Compute step calls. Checks `aiAvailable()` once
 * and either runs the full judgement tier or returns the fully-populated
 * "no key" shape immediately — the qualifying-row list is still there either
 * way, because `candidateFatalRows` doesn't need a model.
 */
export async function buildNarrative(
  rows: CanonicalRow[],
  computed: ComputedMetrics,
  clientName: string,
): Promise<NarrativeResult> {
  const qualifyingFatalRowIndexes = candidateFatalRows(rows);

  if (!aiAvailable()) {
    return { ...EMPTY_NARRATIVE, qualifyingFatalRowIndexes };
  }

  const [fatal, observations] = await Promise.all([
    generateFatalErrors(rows, qualifyingFatalRowIndexes),
    generateObservations(computed, clientName),
  ]);

  const bothUnavailable = !fatal.available && !observations.available;
  return {
    fatalErrors: fatal.fatalErrors,
    fatalErrorsAvailable: fatal.available,
    qualifyingFatalRowIndexes,
    observations: observations.observations,
    observationsAvailable: observations.available,
    unavailableReason: bothUnavailable ? "The AI service did not respond. A human can write this section up from the rows listed below." : undefined,
  };
}
