"use client";

/**
 * Export, backup and import.
 *
 * Every one of these says what it will do before it does it, and what it did
 * afterwards, in figures. The import never writes anything until the file has
 * been read, checked and shown back to the person who chose it — a silent
 * partial import is the one outcome nobody can undo.
 */

import * as React from "react";
import { Download, HardDriveDownload, Upload } from "lucide-react";
import { Button, Field, Pill } from "@/components/ui";
import {
  IMPORT_COLUMNS,
  parseCsv,
  type ImportOutcome,
  type ImportRow,
} from "./vocabulary";

export type FileResult =
  | { ok: true; filename: string; body: string; mime: string }
  | { ok: false; message: string };

export type ImportResult =
  | { ok: true; outcome: ImportOutcome }
  | { ok: false; message: string };

export type DataPanelProps = {
  exportCampaigns: () => Promise<FileResult>;
  backup: () => Promise<FileResult>;
  importContacts: (rows: ImportRow[]) => Promise<ImportResult>;
};

function download(file: { filename: string; body: string; mime: string }) {
  const blob = new Blob([file.body], { type: file.mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readImport(text: string): { rows: ImportRow[]; error: string | null } {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], error: "That file has no rows in it." };

  const header = table[0].map((cell) => cell.trim().toLowerCase());
  const missing = IMPORT_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return {
      rows: [],
      error: `That file is missing the ${missing.join(", ")} column${
        missing.length === 1 ? "" : "s"
      }. Nothing has been read.`,
    };
  }

  const index = (name: string) => header.indexOf(name);
  const rows: ImportRow[] = table.slice(1).map((line, offset) => {
    const value = (name: string) => (line[index(name)] ?? "").trim();
    const email = value("email").toLowerCase();
    const clientSlug = value("client_slug").toLowerCase();

    let problem: string | null = null;
    if (clientSlug === "") problem = "No client slug on this line.";
    else if (email === "") problem = "No email address on this line.";
    else if (!EMAIL.test(email)) problem = "That email address is not a valid address.";

    return {
      line: offset + 2,
      clientSlug,
      email,
      fullName: value("full_name"),
      title: value("title"),
      problem,
    };
  });

  return { rows, error: null };
}

export function DataPanel({
  exportCampaigns,
  backup,
  importContacts,
}: DataPanelProps) {
  const [busy, setBusy] = React.useState<"export" | "backup" | "import" | null>(null);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [parsed, setParsed] = React.useState<ImportRow[] | null>(null);
  const [outcome, setOutcome] = React.useState<ImportOutcome | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const fileId = React.useId();

  async function run(kind: "export" | "backup", action: () => Promise<FileResult>) {
    setBusy(kind);
    setMessage(null);
    const result = await action();
    setBusy(null);
    if (!result.ok) {
      setMessage({ ok: false, text: result.message });
      return;
    }
    download(result);
    setMessage({ ok: true, text: `${result.filename} is in your downloads.` });
  }

  const valid = parsed?.filter((row) => row.problem === null) ?? [];
  const invalid = parsed?.filter((row) => row.problem !== null) ?? [];

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
      {message ? (
        <p
          role="status"
          className="t-footnote"
          style={{
            margin: 0,
            color: message.ok ? "var(--signal-nominal)" : "var(--signal-abort)",
          }}
        >
          {message.text}
        </p>
      ) : null}

      <section className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <h3 className="t-headline" style={{ margin: 0, color: "var(--content-primary)" }}>
          Export campaigns
        </h3>
        <p
          className="t-subhead prose-measure"
          style={{ margin: 0, color: "var(--content-secondary)" }}
        >
          One row per sent report: the report number, the client, the day it
          went, and the counts from the metric layer — attempted, delivered,
          opened, clicked, rated. Internal recipients are already excluded from
          every one of those figures.
        </p>
        <div>
          <Button
            variant="tinted"
            leadingIcon={Download}
            loading={busy === "export"}
            onClick={() => void run("export", exportCampaigns)}
          >
            Export CSV
          </Button>
        </div>
      </section>

      <section className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <h3 className="t-headline" style={{ margin: 0, color: "var(--content-primary)" }}>
          Backup
        </h3>
        <p
          className="t-subhead prose-measure"
          style={{ margin: 0, color: "var(--content-secondary)" }}
        >
          A JSON file of clients, contacts, series and campaigns as they stand
          right now. It is a copy for safekeeping, not a restore point — putting
          it back is a deliberate act by an admin.
        </p>
        <div>
          <Button
            variant="tinted"
            leadingIcon={HardDriveDownload}
            loading={busy === "backup"}
            onClick={() => void run("backup", backup)}
          >
            Download backup
          </Button>
        </div>
      </section>

      <section className="flex flex-col" style={{ gap: "var(--space-3)" }}>
        <h3 className="t-headline" style={{ margin: 0, color: "var(--content-primary)" }}>
          Import contacts
        </h3>
        <p
          className="t-subhead prose-measure"
          style={{ margin: 0, color: "var(--content-secondary)" }}
        >
          A CSV with the columns {IMPORT_COLUMNS.join(", ")}. The file is read
          and checked here first; nothing is written until you say so, and a
          contact that already exists for that client is skipped rather than
          duplicated.
        </p>

        <Field label="Contacts file" hint="Comma separated, with a header row.">
          <input
            id={fileId}
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="t-subhead"
            style={{
              width: "100%",
              minHeight: "44px",
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-raised)",
              border: "1px solid var(--stroke-rim)",
              color: "var(--content-primary)",
            }}
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              setOutcome(null);
              setMessage(null);
              if (!file) {
                setParsed(null);
                return;
              }
              const text = await file.text();
              const read = readImport(text);
              if (read.error) {
                setParsed(null);
                setMessage({ ok: false, text: read.error });
                return;
              }
              setParsed(read.rows);
            }}
          />
        </Field>

        {parsed ? (
          <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
            <div className="flex flex-wrap items-center" style={{ gap: "var(--space-2)" }}>
              <Pill tone="nominal">{valid.length} ready to import</Pill>
              {invalid.length > 0 ? (
                <Pill tone="caution">{invalid.length} cannot be used</Pill>
              ) : null}
            </div>

            {invalid.length > 0 ? (
              <ul
                className="flex flex-col t-caption"
                style={{
                  gap: "var(--space-1)",
                  margin: 0,
                  padding: "var(--space-3)",
                  borderRadius: "calc(var(--radius-lg) - var(--space-3))",
                  background: "var(--fill-quiet)",
                  border: "1px solid var(--stroke-hairline)",
                  listStyle: "none",
                  color: "var(--content-secondary)",
                }}
              >
                {invalid.slice(0, 8).map((row) => (
                  <li key={row.line}>
                    <span className="tabular">Line {row.line}</span> — {row.problem}
                  </li>
                ))}
                {invalid.length > 8 ? (
                  <li style={{ color: "var(--content-tertiary)" }}>
                    and {invalid.length - 8} more.
                  </li>
                ) : null}
              </ul>
            ) : null}

            <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
              <Button
                variant="tinted"
                leadingIcon={Upload}
                disabled={valid.length === 0}
                loading={busy === "import"}
                onClick={() => {
                  setBusy("import");
                  setMessage(null);
                  void importContacts(valid).then((result) => {
                    setBusy(null);
                    if (!result.ok) {
                      setMessage({ ok: false, text: result.message });
                      return;
                    }
                    setOutcome(result.outcome);
                  });
                }}
              >
                Import {valid.length} contact{valid.length === 1 ? "" : "s"}
              </Button>
              <Button
                variant="plain"
                onClick={() => {
                  setParsed(null);
                  setOutcome(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                Clear file
              </Button>
            </div>
          </div>
        ) : null}

        {outcome ? (
          <div
            role="status"
            className="flex flex-col"
            style={{
              gap: "var(--space-2)",
              padding: "var(--space-4)",
              borderRadius: "calc(var(--radius-lg) - var(--space-3))",
              background: "var(--fill-quiet)",
              border: "1px solid var(--stroke-hairline)",
            }}
          >
            <p className="t-subhead" style={{ margin: 0, color: "var(--content-primary)" }}>
              {outcome.inserted} added, {outcome.skipped} already existed,{" "}
              {outcome.failed.length} could not be written.
            </p>
            {outcome.failed.length > 0 ? (
              <ul
                className="flex flex-col t-caption"
                style={{ gap: "2px", margin: 0, padding: 0, listStyle: "none", color: "var(--content-secondary)" }}
              >
                {outcome.failed.slice(0, 8).map((failure) => (
                  <li key={`${failure.line}-${failure.email}`}>
                    <span className="tabular">Line {failure.line}</span> —{" "}
                    {failure.email}: {failure.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
