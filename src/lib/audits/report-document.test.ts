import { describe, expect, it } from "vitest";
import { buildReportDocument, type TableSection } from "./report-document";
import { computeDeterministic, normalizeCanonicalRow } from "./compute";
import { buildSample50RawRows, SAMPLE_COLUMN_MAP } from "./__fixtures__/sample-50";
import { EMPTY_NARRATIVE } from "./types";
import type { NarrativeResult, TaxonomyParameter } from "./types";

const TAXONOMY: TaxonomyParameter[] = [
  { id: "latency", label: "Latency", patterns: ["latency"], sortOrder: 1, isActive: true },
];

function fixture() {
  const rows = buildSample50RawRows().map((raw, index) => normalizeCanonicalRow(raw, SAMPLE_COLUMN_MAP, index));
  const { metrics } = computeDeterministic(rows, TAXONOMY);
  return { rows, metrics };
}

describe("all 7 sections are always present", () => {
  it("with narrative unavailable (no AI key)", () => {
    const { rows, metrics } = fixture();
    const sections = buildReportDocument({ rows, computed: metrics, narrative: EMPTY_NARRATIVE });
    expect(sections.map((s) => s.number)).toEqual(["01", "02", "03", "04", "05", "06", "07"]);
    // Never an empty section: unavailable §6/§7 still carry a note, not silence.
    const s06 = sections[5] as TableSection;
    const s07 = sections[6] as TableSection;
    expect(s06.note).toBeTruthy();
    expect(s07.note).toBeTruthy();
  });

  it("with narrative available", () => {
    const { rows, metrics } = fixture();
    const narrative: NarrativeResult = {
      fatalErrors: [{ rowIndex: 19, fatalFlag: "STT failure", reason: "Bot acted on mis-transcribed input." }],
      fatalErrorsAvailable: true,
      qualifyingFatalRowIndexes: [19],
      observations: [{ theme: "Hot inflated", finding: "8 of 10 mismatches are Hot→Warm.", recommendation: "Tighten the Hot threshold." }],
      observationsAvailable: true,
    };
    const sections = buildReportDocument({ rows, computed: metrics, narrative });
    expect(sections.map((s) => s.number)).toEqual(["01", "02", "03", "04", "05", "06", "07"]);
    const s06 = sections[5] as TableSection;
    const s07 = sections[6] as TableSection;
    expect(s06.note).toBeUndefined();
    expect(s06.rows).toHaveLength(1);
    expect(s07.note).toBeUndefined();
    expect(s07.rows).toHaveLength(1);
  });
});

describe("§1's judgement-derived row is distinguishable from its 4 arithmetic rows", () => {
  it("carries a footnote naming §6 as its source; the other 4 rows do not", () => {
    const { rows, metrics } = fixture();
    const sections = buildReportDocument({ rows, computed: metrics, narrative: EMPTY_NARRATIVE });
    const s01 = sections[0];
    if (s01.kind !== "key-value") throw new Error("§1 must be a key-value section");
    const fatalRow = s01.rows.find((r) => r.label === "Fatal errors");
    expect(fatalRow?.footnote).toBeTruthy();
    const arithmeticRows = s01.rows.filter((r) => r.label !== "Fatal errors");
    for (const row of arithmeticRows) expect(row.footnote).toBeUndefined();
  });

  it("shows 'pending review' rather than a fabricated zero when §6 hasn't run", () => {
    const { rows, metrics } = fixture();
    const sections = buildReportDocument({ rows, computed: metrics, narrative: EMPTY_NARRATIVE });
    const s01 = sections[0];
    if (s01.kind !== "key-value") throw new Error("§1 must be a key-value section");
    const fatalRow = s01.rows.find((r) => r.label === "Fatal errors");
    expect(fatalRow?.value).not.toBe("0");
    expect(fatalRow?.value).toMatch(/pending/i);
  });
});

describe("every rate cell states its own denominator via the section it's in", () => {
  it("§4's accuracy percentage sits beside the total and correct counts it was derived from", () => {
    const { rows, metrics } = fixture();
    const sections = buildReportDocument({ rows, computed: metrics, narrative: EMPTY_NARRATIVE });
    const s04 = sections[3] as TableSection;
    expect(s04.columns).toEqual(["Disposition", "Total Audited", "Correct", "Accuracy"]);
    const hotRow = s04.rows.find((r) => r.cells[0].text === "Hot");
    expect(hotRow?.cells.map((c) => c.text)).toEqual(["Hot", "31", "21", "68%"]);
  });
});
