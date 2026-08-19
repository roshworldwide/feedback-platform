// @vitest-environment node
//
// narrative.ts calls src/lib/ai.ts's aiAvailable(), which calls
// src/lib/env.ts's serverEnv() — guarded to throw if `window` exists, since
// that would mean a server-only module leaked into a browser bundle. The
// project's default jsdom test environment provides a `window`, which trips
// that guard here even though this is a legitimate server-side call; running
// this one file under the plain Node environment avoids it without loosening
// the guard itself.
import { describe, expect, it } from "vitest";
import { buildNarrative, candidateFatalRows } from "./narrative";
import { computeDeterministic, normalizeCanonicalRow } from "./compute";
import { buildSample50RawRows, SAMPLE_COLUMN_MAP } from "./__fixtures__/sample-50";
import type { TaxonomyParameter } from "./types";

const TAXONOMY: TaxonomyParameter[] = [
  { id: "latency", label: "Latency", patterns: ["latency"], sortOrder: 1, isActive: true },
];

function canonicalRows() {
  return buildSample50RawRows().map((raw, index) => normalizeCanonicalRow(raw, SAMPLE_COLUMN_MAP, index));
}

describe("candidateFatalRows is deterministic and needs no AI key", () => {
  it("flags issue rows corrected to a severe disposition (Cold or Not Interested)", () => {
    const rows = canonicalRows();
    const candidates = candidateFatalRows(rows);
    // The fixture has 1 Hot→Cold, 1 Hot→Not Interested, 6 Warm→Cold, 2 Warm→Not Interested = 10.
    expect(candidates).toHaveLength(10);
  });

  it("never flags an accurate row or a mismatch to a non-severe disposition", () => {
    const rows = canonicalRows();
    const candidates = new Set(candidateFatalRows(rows));
    for (const row of rows) {
      if (row.accurate !== false) expect(candidates.has(row.rowIndex)).toBe(false);
    }
  });
});

describe("with no ANTHROPIC_API_KEY, the report still generates complete through §5, never throws", () => {
  it("buildNarrative returns a fully populated result labelled unavailable, with a non-empty qualifying-row list", async () => {
    const rows = canonicalRows();
    const { metrics } = computeDeterministic(rows, TAXONOMY);

    // §1-5 exist independently of buildNarrative — asserting them here proves
    // the deterministic tiers never depend on the AI call this test is about.
    expect(metrics.overall.totalAudited).toBe(50);
    expect(metrics.overall.accuracyRatePct).toBe(62);

    const narrative = await buildNarrative(rows, metrics, "Jaro Education");

    expect(narrative.fatalErrorsAvailable).toBe(false);
    expect(narrative.observationsAvailable).toBe(false);
    expect(narrative.fatalErrors).toEqual([]);
    expect(narrative.observations).toEqual([]);
    expect(narrative.unavailableReason).toBeTruthy();
    // The one thing that must not be empty even with no key: rows for a human to write up.
    expect(narrative.qualifyingFatalRowIndexes.length).toBeGreaterThan(0);
  });
});
