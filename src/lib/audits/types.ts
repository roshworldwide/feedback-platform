/**
 * Shared shapes for the audit pipeline — the leaf module every other file in
 * `src/lib/audits/` and `src/components/audits/` imports from, so the row,
 * mapping and report shapes are declared exactly once. Mirrors the role
 * `compose/vocabulary.ts` plays for Compose.
 */

/** The 8 roles a column must be mapped to before a run can be computed. */
export const COLUMN_ROLES = [
  "disposition",
  "accuracy",
  "correctedDisposition",
  "qaName",
  "observation",
  "improvement",
  "identifier",
  "link",
] as const;
export type ColumnRole = (typeof COLUMN_ROLES)[number];

/** role → the source CSV header it was mapped to. */
export type ColumnMap = Partial<Record<ColumnRole, string>>;

export type AuditRunStatus = "uploaded" | "mapped" | "computed" | "sent" | "failed";

/**
 * One uploaded row, normalised through the column map. `raw` keeps the
 * original header→value pairs verbatim so a figure can always be traced back
 * to the row that produced it; every other field is derived from it once,
 * here — the one place `"No issue"`/`"No Issue"` fold to a single boolean.
 */
export type CanonicalRow = {
  rowIndex: number;
  raw: Record<string, string>;
  /** Display label as typed, e.g. "Hot". */
  disposition: string;
  /** Lowercased/trimmed, for grouping — never shown. */
  dispositionKey: string;
  qaName: string;
  /** true = "No issue"/"No Issue" (accurate); false = "Issue Found"; null = unrecognised value. */
  accurate: boolean | null;
  correctedDisposition: string;
  correctedDispositionKey: string;
  observation: string;
  improvement: string;
  identifier: string;
  link: string;
};

export type TaxonomyParameter = {
  id: string;
  label: string;
  patterns: string[];
  sortOrder: number;
  isActive: boolean;
};

export type OverallSummary = {
  totalAudited: number;
  accurate: number;
  inaccurate: number;
  /** Nearest whole percent — see compute.ts's pctWhole(). Null when totalAudited is 0. */
  accuracyRatePct: number | null;
};

export type DispositionCount = {
  disposition: string;
  count: number;
  pctOfTotal: number | null;
};

export type MismatchPair = {
  original: string;
  corrected: string;
  count: number;
};

export type PerDispositionAccuracy = {
  disposition: string;
  total: number;
  accurate: number;
  accuracyRatePct: number | null;
};

export type ParameterFrequency = {
  parameterId: string;
  label: string;
  issuesFound: number;
  /** Out of total rows — matches the reference report's "% of 50". */
  issueRatePct: number | null;
  rowIndexes: number[];
};

export type ComputedMetrics = {
  overall: OverallSummary;
  dispositionDistribution: DispositionCount[];
  mismatchAnalysis: MismatchPair[];
  perDispositionAccuracy: PerDispositionAccuracy[];
  parameterFrequency: ParameterFrequency[];
};

export type FatalErrorEntry = {
  rowIndex: number;
  fatalFlag: string;
  reason: string;
};

export type ObservationEntry = {
  theme: string;
  finding: string;
  recommendation: string;
};

/**
 * Sections 6-7 — the judgement tier. Availability is tracked per section, not
 * as one flag: a malformed AI response for §7 must degrade only §7, never
 * take §6 down with it (and vice versa). `qualifyingFatalRowIndexes` is a
 * deterministic pre-filter that's always populated, key-or-no-key, so "a
 * human writes it up" always has something concrete to work from rather than
 * an empty section.
 */
export type NarrativeResult = {
  fatalErrors: FatalErrorEntry[];
  fatalErrorsAvailable: boolean;
  qualifyingFatalRowIndexes: number[];
  observations: ObservationEntry[];
  observationsAvailable: boolean;
  unavailableReason?: string;
};

export const EMPTY_METRICS: ComputedMetrics = {
  overall: { totalAudited: 0, accurate: 0, inaccurate: 0, accuracyRatePct: null },
  dispositionDistribution: [],
  mismatchAnalysis: [],
  perDispositionAccuracy: [],
  parameterFrequency: [],
};

export const EMPTY_NARRATIVE: NarrativeResult = {
  fatalErrors: [],
  fatalErrorsAvailable: false,
  qualifyingFatalRowIndexes: [],
  observations: [],
  observationsAvailable: false,
  unavailableReason: "Narrative unavailable — no AI key configured.",
};
