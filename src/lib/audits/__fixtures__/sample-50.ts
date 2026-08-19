/**
 * A synthetic 50-row fixture engineered to reproduce the exact tallies
 * verified against the real reference sample ("Jaro- 09-07- cold leads")
 * without checking real client data (phone numbers, lead links) into git:
 *
 *   50 audited, 31 accurate, 19 inaccurate, 62% overall.
 *   Hot 31 (62%), Warm 19 (38%).
 *   Mismatches: Hot→Warm 8, Warm→Cold 6, Warm→Not Interested 2,
 *               Hot→Not Interested 1, Hot→Cold 1, Warm→Hot 1.
 *   Per-disposition: Hot 31/21 (68%), Warm 19/10 (53%).
 *
 * The accuracy column deliberately mixes "No issue" and "No Issue" — the
 * exact case-spelling split the real sample has (29 + 2 of the 31 accurate
 * rows) — so a regression to case-sensitive counting is caught here, not
 * just asserted in the abstract.
 */

import type { ColumnMap } from "../types";

export const SAMPLE_COLUMN_MAP: ColumnMap = {
  disposition: "Disposition",
  accuracy: "Was the disposition accurately selected ?",
  correctedDisposition: "If not correct what is the real disposition",
  qaName: "QA Name",
  observation: "Observation",
  improvement: "What can we improve",
  identifier: "Phone Number",
  link: "Lead Link",
};

type RawRow = Record<string, string>;

function row(
  disposition: string,
  accuracy: string,
  corrected: string,
  index: number,
): RawRow {
  return {
    "QA name": "",
    "Phone Number": `+9198765${String(10000 + index).slice(-5)}`,
    "Lead Link": `https://activate.convin.ai/leads/${index}`,
    Disposition: disposition,
    "QA Name": index % 2 === 0 ? "Bhavya" : "Sakshi",
    "Was the disposition accurately selected ?": accuracy,
    "If not correct what is the real disposition": corrected,
    "Lead quality": "",
    "What can we improve": "General call flow could be smoother.",
    Observation: "Call proceeded with no notable issue.",
  };
}

export function buildSample50RawRows(): RawRow[] {
  const rows: RawRow[] = [];
  let index = 0;

  // Hot, accurate: 21 rows — 19 "No issue" + 2 "No Issue" (the case split).
  for (let i = 0; i < 19; i += 1) rows.push(row("Hot", "No issue", "", index++));
  for (let i = 0; i < 2; i += 1) rows.push(row("Hot", "No Issue", "", index++));

  // Hot, inaccurate: 10 rows — 8 → Warm, 1 → Not Interested, 1 → Cold.
  for (let i = 0; i < 8; i += 1) rows.push(row("Hot", "Issue Found", "Warm", index++));
  rows.push(row("Hot", "Issue Found", "Not Interested", index++));
  rows.push(row("Hot", "Issue Found", "Cold", index++));

  // Warm, accurate: 10 rows — all "No issue".
  for (let i = 0; i < 10; i += 1) rows.push(row("Warm", "No issue", "", index++));

  // Warm, inaccurate: 9 rows — 6 → Cold, 2 → Not Interested, 1 → Hot.
  for (let i = 0; i < 6; i += 1) rows.push(row("Warm", "Issue Found", "Cold", index++));
  for (let i = 0; i < 2; i += 1) rows.push(row("Warm", "Issue Found", "Not Interested", index++));
  rows.push(row("Warm", "Issue Found", "Hot", index++));

  return rows;
}
