/**
 * The canonical report model — the one source every renderer (on-screen
 * AURUM, the flattened email HTML, the PDF) reads from. All 7 sections are
 * built unconditionally: §6/§7 render as an explicit "unavailable" row
 * rather than being omitted, because a missing section reads as "nothing to
 * report" when the truth is "nobody asked the model." Every rate-bearing
 * cell carries its own denominator in the label, per the product rule that a
 * number is never shown without what it's a fraction of.
 */

import type { CanonicalRow, ComputedMetrics, NarrativeResult } from "./types";

export type ReportSectionNumber = "01" | "02" | "03" | "04" | "05" | "06" | "07";

export type KeyValueRow = { label: string; value: string; highlighted?: boolean; footnote?: string };
export type KeyValueSection = {
  kind: "key-value";
  number: ReportSectionNumber;
  title: string;
  rows: KeyValueRow[];
};

export type TableCell = { text: string; footnote?: string };
export type TableRow = { cells: TableCell[]; sourceRowIndexes?: number[] };
export type TableSection = {
  kind: "table";
  number: ReportSectionNumber;
  title: string;
  columns: string[];
  rows: TableRow[];
  /** e.g. "Narrative unavailable — no AI key configured." Rendered above the (possibly empty) rows. */
  note?: string;
};

export type ReportSection = KeyValueSection | TableSection;

function pctText(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

function cell(text: string): TableCell {
  return { text };
}

function section01(computed: ComputedMetrics, narrative: NarrativeResult): KeyValueSection {
  const fatalKnown = narrative.fatalErrorsAvailable;
  return {
    kind: "key-value",
    number: "01",
    title: "Overall Audit Summary",
    rows: [
      { label: "Total leads audited", value: String(computed.overall.totalAudited) },
      { label: "Accurate dispositions", value: String(computed.overall.accurate) },
      { label: "Inaccurate dispositions", value: String(computed.overall.inaccurate) },
      {
        label: "Fatal errors",
        value: fatalKnown ? String(narrative.fatalErrors.length) : "— pending review",
        footnote: "From §6, the AI/judgement tier — not part of this row's arithmetic.",
      },
      {
        label: "Overall accuracy rate (nearest whole %)",
        value: pctText(computed.overall.accuracyRatePct),
        highlighted: true,
      },
    ],
  };
}

function section02(computed: ComputedMetrics): TableSection {
  return {
    kind: "table",
    number: "02",
    title: "Disposition Distribution",
    columns: ["Disposition", "Count", "% of Total"],
    rows: computed.dispositionDistribution.map((d) => ({
      cells: [cell(d.disposition), cell(String(d.count)), cell(pctText(d.pctOfTotal))],
    })),
  };
}

function section03(computed: ComputedMetrics): TableSection {
  return {
    kind: "table",
    number: "03",
    title: "Disposition Mismatch Analysis",
    columns: ["Original Disposition", "Correction Applied", "Count"],
    rows: computed.mismatchAnalysis.map((m) => ({
      cells: [cell(m.original), cell(`${m.original} → ${m.corrected}`), cell(String(m.count))],
    })),
  };
}

function section04(computed: ComputedMetrics): TableSection {
  return {
    kind: "table",
    number: "04",
    title: "Per-Disposition Accuracy Breakdown",
    columns: ["Disposition", "Total Audited", "Correct", "Accuracy"],
    rows: computed.perDispositionAccuracy.map((p) => ({
      cells: [cell(p.disposition), cell(String(p.total)), cell(String(p.accurate)), cell(pctText(p.accuracyRatePct))],
    })),
  };
}

function section05(computed: ComputedMetrics): TableSection {
  return {
    kind: "table",
    number: "05",
    title: "Parameter-Wise Issue Frequency",
    columns: ["Parameter", "Issues Found", "Issue Rate"],
    rows: computed.parameterFrequency.map((p) => ({
      cells: [cell(p.label), cell(String(p.issuesFound)), cell(pctText(p.issueRatePct))],
      sourceRowIndexes: p.rowIndexes,
    })),
  };
}

function section06(rows: CanonicalRow[], narrative: NarrativeResult): TableSection {
  const byIndex = new Map(rows.map((row) => [row.rowIndex, row]));
  const columns = ["Lead #", "Phone Number", "Disposition", "Fatal Flag", "Lead Link", "Nature / Reason"];

  if (narrative.fatalErrorsAvailable) {
    return {
      kind: "table",
      number: "06",
      title: "Fatal Errors",
      columns,
      rows: narrative.fatalErrors.map((entry, i) => {
        const row = byIndex.get(entry.rowIndex);
        return {
          cells: [
            cell(String(i + 1)),
            cell(row?.identifier ?? "—"),
            cell(row?.disposition ?? "—"),
            cell(entry.fatalFlag),
            cell(row?.link ?? "—"),
            cell(entry.reason),
          ],
          sourceRowIndexes: [entry.rowIndex],
        };
      }),
    };
  }

  // No AI available: list the deterministic candidates so a human has a
  // concrete starting point rather than an empty section.
  return {
    kind: "table",
    number: "06",
    title: "Fatal Errors",
    columns,
    note: narrative.unavailableReason ?? "Narrative unavailable — no AI key configured.",
    rows: narrative.qualifyingFatalRowIndexes.map((rowIndex, i) => {
      const row = byIndex.get(rowIndex);
      return {
        cells: [
          cell(String(i + 1)),
          cell(row?.identifier ?? "—"),
          cell(row?.disposition ?? "—"),
          cell("— pending human review"),
          cell(row?.link ?? "—"),
          cell(`Corrected to ${row?.correctedDisposition ?? "—"} — write up whether this call is unreliable.`),
        ],
        sourceRowIndexes: [rowIndex],
      };
    }),
  };
}

function section07(narrative: NarrativeResult): TableSection {
  const columns = ["Theme", "Finding", "Suggestion / Recommendation"];
  if (narrative.observationsAvailable) {
    return {
      kind: "table",
      number: "07",
      title: "Observations & Insights",
      columns,
      rows: narrative.observations.map((o) => ({
        cells: [cell(o.theme), cell(o.finding), cell(o.recommendation)],
      })),
    };
  }
  return {
    kind: "table",
    number: "07",
    title: "Observations & Insights",
    columns,
    note: narrative.unavailableReason ?? "Narrative unavailable — no AI key configured.",
    rows: [],
  };
}

export function buildReportDocument(input: {
  rows: CanonicalRow[];
  computed: ComputedMetrics;
  narrative: NarrativeResult;
}): ReportSection[] {
  const { rows, computed, narrative } = input;
  return [
    section01(computed, narrative),
    section02(computed),
    section03(computed),
    section04(computed),
    section05(computed),
    section06(rows, narrative),
    section07(narrative),
  ];
}
