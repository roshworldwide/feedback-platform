import { describe, expect, it } from "vitest";
import {
  computeDeterministic,
  computeDispositionDistribution,
  computeMismatchAnalysis,
  computeOverallSummary,
  computePerDispositionAccuracy,
  normalizeAccuracy,
  normalizeCanonicalRow,
  pctWhole,
  tagRow,
} from "./compute";
import { buildSample50RawRows, SAMPLE_COLUMN_MAP } from "./__fixtures__/sample-50";
import type { CanonicalRow, TaxonomyParameter } from "./types";

function canonicalRows(): CanonicalRow[] {
  return buildSample50RawRows().map((raw, index) => normalizeCanonicalRow(raw, SAMPLE_COLUMN_MAP, index));
}

describe("the sample fixture matches the reference report figure for figure", () => {
  const rows = canonicalRows();

  it("§1 overall summary is 50 / 31 / 19 / 62%", () => {
    expect(computeOverallSummary(rows)).toEqual({
      totalAudited: 50,
      accurate: 31,
      inaccurate: 19,
      accuracyRatePct: 62,
    });
  });

  it("§2 disposition distribution is Hot 31 (62%), Warm 19 (38%)", () => {
    expect(computeDispositionDistribution(rows)).toEqual([
      { disposition: "Hot", count: 31, pctOfTotal: 62 },
      { disposition: "Warm", count: 19, pctOfTotal: 38 },
    ]);
  });

  it("§3 mismatch analysis has all six pairs with the right counts", () => {
    const pairs = computeMismatchAnalysis(rows);
    const byPair = new Map(pairs.map((p) => [`${p.original}→${p.corrected}`, p.count]));
    expect(byPair.get("Hot→Warm")).toBe(8);
    expect(byPair.get("Warm→Cold")).toBe(6);
    expect(byPair.get("Warm→Not Interested")).toBe(2);
    expect(byPair.get("Hot→Not Interested")).toBe(1);
    expect(byPair.get("Hot→Cold")).toBe(1);
    expect(byPair.get("Warm→Hot")).toBe(1);
    expect(pairs).toHaveLength(6);
    expect(pairs.reduce((sum, p) => sum + p.count, 0)).toBe(19);
  });

  it("§4 per-disposition accuracy is Hot 31/21 (68%), Warm 19/10 (53%)", () => {
    expect(computePerDispositionAccuracy(rows)).toEqual([
      { disposition: "Hot", total: 31, accurate: 21, accuracyRatePct: 68 },
      { disposition: "Warm", total: 19, accurate: 10, accuracyRatePct: 53 },
    ]);
  });
});

describe("the case-spelling bug cannot recur", () => {
  it("normalizeAccuracy folds both spellings to the same boolean", () => {
    expect(normalizeAccuracy("No issue")).toBe(true);
    expect(normalizeAccuracy("No Issue")).toBe(true);
    expect(normalizeAccuracy("  no issue  ")).toBe(true);
    expect(normalizeAccuracy("Issue Found")).toBe(false);
  });

  it("counting 'No issue' (29) and 'No Issue' (2) separately would give 58%, not 62%", () => {
    const rows = canonicalRows();
    const summary = computeOverallSummary(rows);
    // The defect this file exists to prevent: 29/50 = 58%, the wrong answer a
    // case-sensitive count would produce.
    expect(summary.accuracyRatePct).not.toBe(58);
    expect(summary.accuracyRatePct).toBe(62);
  });
});

describe("an empty corrected disposition is excluded from §3 without distorting §1", () => {
  const rows = canonicalRows();
  const unresolved = normalizeCanonicalRow(
    {
      Disposition: "Hot",
      "Was the disposition accurately selected ?": "Issue Found",
      "If not correct what is the real disposition": "",
    },
    SAMPLE_COLUMN_MAP,
    rows.length,
  );
  const withUnresolved = [...rows, unresolved];

  it("is still counted in §1's inaccurate total", () => {
    const summary = computeOverallSummary(withUnresolved);
    expect(summary.totalAudited).toBe(51);
    expect(summary.inaccurate).toBe(20);
  });

  it("adds no new pair and does not change any existing pair's count in §3", () => {
    const before = computeMismatchAnalysis(rows);
    const after = computeMismatchAnalysis(withUnresolved);
    expect(after).toEqual(before);
    expect(after.reduce((sum, p) => sum + p.count, 0)).toBe(19);
  });
});

describe("pctWhole rounds to the nearest whole percent, not one decimal", () => {
  it("matches the reference report's own '(nearest whole %)' label", () => {
    expect(pctWhole(21, 31)).toBe(68); // 67.74...% → 68, not 67.7
    expect(pctWhole(10, 19)).toBe(53); // 52.63...% → 53, not 52.6
  });

  it("returns null for a zero denominator rather than dividing by it", () => {
    expect(pctWhole(0, 0)).toBeNull();
  });
});

describe("taxonomy tagging", () => {
  const taxonomy: TaxonomyParameter[] = [
    { id: "latency", label: "Latency", patterns: ["latency", "slow", "delay"], sortOrder: 1, isActive: true },
    { id: "pronunciation", label: "Pronunciation issue", patterns: ["pronunciat", "accent"], sortOrder: 2, isActive: true },
    { id: "stt", label: "STT / Transcript issue", patterns: ["stt", "transcript"], sortOrder: 3, isActive: true },
  ];

  it("tags a known observation string with the expected parameter", () => {
    const tags = tagRow("Bot's latency was noticeable and pronunciation was a bit off.", taxonomy);
    expect(tags).toContain("latency");
    expect(tags).toContain("pronunciation");
    expect(tags).not.toContain("stt");
  });

  it("does not tag a parameter that's been deactivated", () => {
    const withInactive = taxonomy.map((p) => (p.id === "latency" ? { ...p, isActive: false } : p));
    const tags = tagRow("Bot's latency was noticeable.", withInactive);
    expect(tags).not.toContain("latency");
  });

  it("computeDeterministic's §5 frequency respects a row-tags override without touching §1-4", () => {
    const rows = canonicalRows();
    const fresh = computeDeterministic(rows, taxonomy);
    const overridden = computeDeterministic(
      rows,
      taxonomy,
      new Map([[0, ["latency"]]]),
    );
    expect(overridden.metrics.overall).toEqual(fresh.metrics.overall);
    const latencyFreq = overridden.metrics.parameterFrequency.find((p) => p.parameterId === "latency");
    expect(latencyFreq?.rowIndexes).toContain(0);
  });
});
