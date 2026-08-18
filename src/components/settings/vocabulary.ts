/**
 * Settings vocabulary — the shapes the panels are given, and the words they
 * use. A leaf module with no server imports, shared by the server page and the
 * client panels so a role, a status and an outcome are named once.
 */

export type ActionState = { ok: boolean; message: string | null };

export const IDLE_ACTION: ActionState = { ok: true, message: null };

export type TeamMember = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  /** From `profiles.last_seen_at`. null means never seen, not "just now". */
  lastSeenAt: string | null;
  createdAt: string | null;
};

export type AuditEntryRow = {
  id: number;
  actor: string;
  action: string;
  target: string;
  summary: string;
  createdAt: string | null;
};

export type SenderConfig = {
  /** The mailbox everything is sent from, exactly as configured. */
  from: string;
  fromName: string;
  mailbox: string;
  replyTo: string;
  signature: string;
  internalDomains: string[];
  /** True when a delivery key is present. Never inferred from anything else. */
  verified: boolean;
  appUrl: string;
};

/** One parsed line of an import file, before anything is written. */
export type ImportRow = {
  line: number;
  clientSlug: string;
  email: string;
  fullName: string;
  title: string;
  /** Set when the line cannot be imported as it stands. */
  problem: string | null;
};

export type ImportOutcome = {
  inserted: number;
  skipped: number;
  failed: { line: number; email: string; reason: string }[];
};

export const IMPORT_COLUMNS = ["client_slug", "email", "full_name", "title"] as const;

/**
 * A very small CSV reader: comma-separated, double quotes escaped by doubling.
 * It never reorders, never trims a value into nothing, and reports the line
 * number of anything it cannot use rather than dropping it quietly.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index++) {
    const char = input[index];

    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index++;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((line) => line.some((value) => value.trim() !== ""));
}

/** One value, quoted only when it has to be. */
export function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvLine(values: (string | number | null)[]): string {
  return values.map(csvCell).join(",");
}
