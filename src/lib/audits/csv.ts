/**
 * CSV ingestion: parsing and column-role auto-detection.
 *
 * Headers are never hardcoded — the reference sample alone has "QA name"
 * and "QA Name" (one empty, one the real column), and an accuracy header
 * with a trailing space before its "?". fuzzyMatchColumns() normalises past
 * that noise and scores headers against each of the 8 required roles; the
 * caller always shows the result and lets a person correct it before
 * anything downstream runs on it.
 */

import Papa from "papaparse";
import { COLUMN_ROLES, type ColumnRole } from "./types";

export type CsvParseResult =
  | { ok: true; headers: string[]; rows: Record<string, string>[] }
  | { ok: false; message: string; atRow?: number };

/** Server-side only — the CSV is client data and is never logged, here or by a caller. */
export function parseCsv(text: string): CsvParseResult {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    const first = result.errors[0];
    const atRow = typeof first.row === "number" ? first.row + 2 : undefined; // +1 for the header row, +1 for 1-indexing
    return {
      ok: false,
      message: atRow
        ? `Row ${atRow} of the file has ${first.message.toLowerCase()}. Fix it and re-upload.`
        : `Couldn't read the file: ${first.message}.`,
      atRow,
    };
  }

  const headers = result.meta.fields ?? [];
  if (headers.length === 0) {
    return { ok: false, message: "The file has no header row to map columns from." };
  }

  const rows = result.data.filter((row) => Object.values(row).some((value) => (value ?? "").trim() !== ""));
  if (rows.length === 0) {
    return { ok: false, message: "The file has a header row but no data rows." };
  }

  return { ok: true, headers, rows };
}

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // strip parentheticals — "Lead Link ( issue found or No Issue)" → "lead link"
    .replace(/[^a-z0-9\s]/g, " ") // strip punctuation, e.g. a trailing "?"
    .replace(/\s+/g, " ")
    .trim();
}

const ROLE_KEYWORDS: Record<ColumnRole, string[]> = {
  disposition: ["disposition"],
  accuracy: ["accurately selected", "accuracy", "accurate"],
  correctedDisposition: ["real disposition", "corrected disposition", "correct disposition", "not correct"],
  qaName: ["qa name", "qa", "auditor", "reviewer"],
  observation: ["observation", "remarks", "notes"],
  improvement: ["improve", "improvement", "suggestion"],
  identifier: ["phone", "mobile", "contact number", "identifier"],
  link: ["link", "url", "recording"],
};

function scoreHeaderForRole(normalizedHeader: string, role: ColumnRole): number {
  let best = 0;
  for (const keyword of ROLE_KEYWORDS[role]) {
    if (normalizedHeader.includes(keyword)) best = Math.max(best, keyword.length);
  }
  return best;
}

export type ColumnMatch = { header: string; score: number };
export type ColumnMatches = Record<ColumnRole, ColumnMatch | null>;

/**
 * Scores every (role, header) pair and assigns greedily by descending score,
 * so a header that's a strong match for one role can't also be claimed by a
 * weaker match on another — "Was the disposition accurately selected ?"
 * scores higher for `accuracy` (its whole phrase matches) than for
 * `disposition` (just the one word it happens to contain), so `accuracy`
 * wins it and `disposition` falls back to the bare "Disposition" header.
 *
 * `sampleRows` breaks a genuine tie: two headers that normalise identically
 * (the sample's two "QA name" spellings) can only be told apart by which one
 * actually has data.
 */
export function fuzzyMatchColumns(headers: string[], sampleRows: Record<string, string>[] = []): ColumnMatches {
  const normalized = headers.map((header) => ({ header, normalized: normalizeHeader(header) }));

  function nonEmptyCount(header: string): number {
    return sampleRows.filter((row) => (row[header] ?? "").trim() !== "").length;
  }

  const candidates: { role: ColumnRole; header: string; score: number }[] = [];
  for (const role of COLUMN_ROLES) {
    for (const { header, normalized: n } of normalized) {
      const score = scoreHeaderForRole(n, role);
      if (score > 0) candidates.push({ role, header, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score || nonEmptyCount(b.header) - nonEmptyCount(a.header));

  const result = Object.fromEntries(COLUMN_ROLES.map((role) => [role, null])) as ColumnMatches;
  const takenHeaders = new Set<string>();
  const takenRoles = new Set<ColumnRole>();

  for (const candidate of candidates) {
    if (takenRoles.has(candidate.role) || takenHeaders.has(candidate.header)) continue;
    result[candidate.role] = { header: candidate.header, score: candidate.score };
    takenRoles.add(candidate.role);
    takenHeaders.add(candidate.header);
  }

  return result;
}
