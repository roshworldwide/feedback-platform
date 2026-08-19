/**
 * Sections 1-5 of an audit report — the deterministic and taxonomy tiers.
 * Pure functions, no I/O, no AI: this file must never depend on a model
 * being available, because §1-4 are arithmetic and §5 is a keyword lookup.
 *
 * Every categorical value is case/whitespace-normalised before counting.
 * The reference sample carries "No issue" (29 rows) and "No Issue" (2 rows)
 * as two different strings — counting them separately gives 29/50 = 58%
 * instead of the correct 31/50 = 62%. That's the exact class of defect this
 * file exists to make impossible, which is why normalizeCanonicalRow() is
 * the one place a raw CSV value becomes a typed field.
 */

import type {
  CanonicalRow,
  ColumnMap,
  ColumnRole,
  ComputedMetrics,
  DispositionCount,
  MismatchPair,
  OverallSummary,
  ParameterFrequency,
  PerDispositionAccuracy,
  TaxonomyParameter,
} from "./types";

/**
 * Nearest whole percent — deliberately distinct from `src/lib/utils.ts`'s
 * `pct()`, which rounds to one decimal. The reference report labels its own
 * rates "(nearest whole %)" and its figures (68%, 53%, 62%) are exactly
 * that, not one-decimal and not floored.
 */
export function pctWhole(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 100);
}

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function titleCase(key: string): string {
  return key
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** "No issue" / "No Issue" → true; "Issue Found" (any case) → false; anything else → null. */
export function normalizeAccuracy(raw: string): boolean | null {
  const key = normalizeKey(raw);
  if (key === "no issue") return true;
  if (key === "issue found") return false;
  return null;
}

/** The one place a raw uploaded row, plus the column map, becomes a typed row. */
export function normalizeCanonicalRow(
  raw: Record<string, string>,
  columnMap: ColumnMap,
  rowIndex: number,
): CanonicalRow {
  const get = (role: ColumnRole): string => {
    const header = columnMap[role];
    if (!header) return "";
    return (raw[header] ?? "").trim();
  };
  const dispositionRaw = get("disposition");
  const correctedRaw = get("correctedDisposition");
  return {
    rowIndex,
    raw,
    disposition: dispositionRaw,
    dispositionKey: normalizeKey(dispositionRaw),
    qaName: get("qaName"),
    accurate: normalizeAccuracy(get("accuracy")),
    correctedDisposition: correctedRaw,
    correctedDispositionKey: normalizeKey(correctedRaw),
    observation: get("observation"),
    improvement: get("improvement"),
    identifier: get("identifier"),
    link: get("link"),
  };
}

export function computeOverallSummary(rows: CanonicalRow[]): OverallSummary {
  const totalAudited = rows.length;
  const accurate = rows.filter((row) => row.accurate === true).length;
  const inaccurate = rows.filter((row) => row.accurate === false).length;
  return {
    totalAudited,
    accurate,
    inaccurate,
    accuracyRatePct: pctWhole(accurate, totalAudited),
  };
}

export function computeDispositionDistribution(rows: CanonicalRow[]): DispositionCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.dispositionKey) continue;
    counts.set(row.dispositionKey, (counts.get(row.dispositionKey) ?? 0) + 1);
  }
  const total = rows.length;
  return Array.from(counts.entries())
    .map(([key, count]) => ({
      disposition: titleCase(key),
      count,
      pctOfTotal: pctWhole(count, total),
    }))
    .sort((a, b) => b.count - a.count || a.disposition.localeCompare(b.disposition));
}

/**
 * Only inaccurate rows with a non-empty corrected disposition are a
 * "mismatch" — a row marked inaccurate with no correction recorded has
 * nothing to pair, so it's excluded here without being excluded from §1's
 * inaccurate total (computeOverallSummary counts it regardless).
 */
export function computeMismatchAnalysis(rows: CanonicalRow[]): MismatchPair[] {
  const counts = new Map<string, MismatchPair>();
  for (const row of rows) {
    if (row.accurate !== false) continue;
    if (!row.correctedDispositionKey) continue;
    const key = `${row.dispositionKey}→${row.correctedDispositionKey}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, {
        original: titleCase(row.dispositionKey),
        corrected: titleCase(row.correctedDispositionKey),
        count: 1,
      });
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

export function computePerDispositionAccuracy(rows: CanonicalRow[]): PerDispositionAccuracy[] {
  const totals = new Map<string, number>();
  const accurates = new Map<string, number>();
  for (const row of rows) {
    if (!row.dispositionKey) continue;
    totals.set(row.dispositionKey, (totals.get(row.dispositionKey) ?? 0) + 1);
    if (row.accurate === true) {
      accurates.set(row.dispositionKey, (accurates.get(row.dispositionKey) ?? 0) + 1);
    }
  }
  return Array.from(totals.entries())
    .map(([key, total]) => {
      const accurate = accurates.get(key) ?? 0;
      return {
        disposition: titleCase(key),
        total,
        accurate,
        accuracyRatePct: pctWhole(accurate, total),
      };
    })
    .sort((a, b) => b.total - a.total || a.disposition.localeCompare(b.disposition));
}

/** Which active taxonomy parameters a free-text blob mentions, by id. */
export function tagRow(text: string, taxonomy: TaxonomyParameter[]): string[] {
  const haystack = text.toLowerCase();
  const matched: string[] = [];
  for (const param of taxonomy) {
    if (!param.isActive) continue;
    if (param.patterns.some((pattern) => pattern.trim() && haystack.includes(pattern.toLowerCase()))) {
      matched.push(param.id);
    }
  }
  return matched;
}

export function computeParameterFrequency(
  taggedRows: { rowIndex: number; issueTags: string[] }[],
  taxonomy: TaxonomyParameter[],
  totalRows: number,
): ParameterFrequency[] {
  const byParam = new Map<string, number[]>();
  for (const row of taggedRows) {
    for (const tag of row.issueTags) {
      const list = byParam.get(tag) ?? [];
      list.push(row.rowIndex);
      byParam.set(tag, list);
    }
  }
  return taxonomy
    .filter((param) => param.isActive)
    .map((param) => {
      const rowIndexes = byParam.get(param.id) ?? [];
      return {
        parameterId: param.id,
        label: param.label,
        issuesFound: rowIndexes.length,
        issueRatePct: pctWhole(rowIndexes.length, totalRows),
        rowIndexes,
      };
    })
    .sort((a, b) => b.issuesFound - a.issuesFound || a.label.localeCompare(b.label));
}

/**
 * The one orchestrator every caller uses. `rowTagsOverride` lets a row's
 * human-edited tags (from the Review step) win over a fresh taxonomy match —
 * editing a row's tags recomputes only this, never §1-4's fixed arithmetic.
 */
export function computeDeterministic(
  rows: CanonicalRow[],
  taxonomy: TaxonomyParameter[],
  rowTagsOverride?: Map<number, string[]>,
): { metrics: ComputedMetrics; rowTags: Map<number, string[]> } {
  const rowTags = new Map<number, string[]>();
  for (const row of rows) {
    const override = rowTagsOverride?.get(row.rowIndex);
    rowTags.set(row.rowIndex, override ?? tagRow(`${row.observation} ${row.improvement}`, taxonomy));
  }
  const metrics: ComputedMetrics = {
    overall: computeOverallSummary(rows),
    dispositionDistribution: computeDispositionDistribution(rows),
    mismatchAnalysis: computeMismatchAnalysis(rows),
    perDispositionAccuracy: computePerDispositionAccuracy(rows),
    parameterFrequency: computeParameterFrequency(
      rows.map((row) => ({ rowIndex: row.rowIndex, issueTags: rowTags.get(row.rowIndex) ?? [] })),
      taxonomy,
      rows.length,
    ),
  };
  return { metrics, rowTags };
}
