"use client";

/**
 * Step 1 · Upload.
 *
 * A CSV or a Google Sheets link, parsed server-side — the file never touches
 * an intermediate step before landing here. The parsed row count and a
 * 5-row preview render before anything else happens, per this feature's own
 * ordering rule.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button, Card, CardBody, CardHeader, CardTitle, Field, Segmented, TextInput, useToast } from "@/components/ui";
import { ClientSelect } from "@/components/compose/client-select";
import type { ClientOption } from "@/components/compose/vocabulary";
import { uploadCsvAction } from "@/app/(app)/audits/actions";

export type StepUploadProps = {
  clients: ClientOption[] | null;
  clientsReason?: string | null;
};

type Source = "file" | "sheets";

export function StepUpload({ clients, clientsReason }: StepUploadProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [clientId, setClientId] = React.useState<string | null>(null);
  const [source, setSource] = React.useState<Source>("file");
  const [file, setFile] = React.useState<File | null>(null);
  const [sheetsUrl, setSheetsUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<{ rowCount: number; headers: string[]; rows: Record<string, string>[] } | null>(
    null,
  );

  async function submit() {
    if (!clientId) {
      toast({ message: "Pick a client first — an audit run cannot exist without one.", tone: "abort" });
      return;
    }
    if (source === "file" && !file) {
      toast({ message: "Choose a CSV file to upload.", tone: "abort" });
      return;
    }
    if (source === "sheets" && sheetsUrl.trim() === "") {
      toast({ message: "Paste a Google Sheets link.", tone: "abort" });
      return;
    }

    setBusy(true);
    const form = new FormData();
    form.set("clientId", clientId);
    if (source === "file" && file) form.set("file", file);
    if (source === "sheets") form.set("sheetsUrl", sheetsUrl.trim());

    const result = await uploadCsvAction(form);
    setBusy(false);

    if (!result.ok) {
      toast({ message: result.message, tone: "abort" });
      return;
    }

    setPreview({ rowCount: result.data.rowCount, headers: result.data.headers, rows: result.data.preview });
    toast({ message: `${result.data.rowCount} rows read. Continuing to Map columns…`, tone: "nominal" });
    router.push(`/audits/${result.data.runId}?step=map`);
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      <Card elevation="e1">
        <CardHeader>
          <CardTitle as="h2" description="A campaign cannot be created without a client — this is a reference to a record, never text you type.">
            Client
          </CardTitle>
        </CardHeader>
        <CardBody>
          <Field label="Client" required>
            <ClientSelect
              id="audit-upload-client"
              clients={clients}
              clientsReason={clientsReason}
              value={clientId}
              onChange={setClientId}
            />
          </Field>
        </CardBody>
      </Card>

      <Card elevation="e1">
        <CardHeader
          action={
            <Segmented
              label="Source"
              size="s"
              value={source}
              onValueChange={(v) => setSource(v as Source)}
              options={[
                { value: "file", label: "CSV file" },
                { value: "sheets", label: "Google Sheets" },
              ]}
            />
          }
        >
          <CardTitle as="h2" description="Parsed on the server. The file's contents are never logged.">
            Source
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col" style={{ gap: "var(--space-4)" }}>
          {source === "file" ? (
            <Field label="CSV file" hint="Dropped headers don't need to match anything — you'll map them next.">
              <label
                className="flex items-center justify-center"
                style={{
                  gap: "var(--space-3)",
                  minHeight: "96px",
                  border: "1px dashed var(--stroke-rim)",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--fill-quiet)",
                  cursor: "pointer",
                  color: "var(--content-secondary)",
                }}
              >
                <Upload size={18} strokeWidth={1.75} aria-hidden="true" />
                <span className="t-subhead">{file ? file.name : "Choose a CSV file, or drop it here"}</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
                  style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
                />
              </label>
            </Field>
          ) : (
            <Field label="Google Sheets link" hint='Must be shared as "Anyone with the link can view."'>
              <TextInput
                placeholder="https://docs.google.com/spreadsheets/d/…"
                value={sheetsUrl}
                onChange={(e) => setSheetsUrl(e.currentTarget.value)}
              />
            </Field>
          )}

          <Button variant="solid" leadingIcon={FileSpreadsheet} loading={busy} onClick={submit}>
            Upload
          </Button>
        </CardBody>
      </Card>

      {preview ? (
        <Card elevation="e1">
          <CardHeader>
            <CardTitle as="h2" description={`${preview.rowCount} rows read.`}>
              Preview
            </CardTitle>
          </CardHeader>
          <CardBody style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
              <thead>
                <tr>
                  {preview.headers.map((h) => (
                    <th
                      key={h}
                      className="t-overline"
                      style={{ textAlign: "left", padding: "var(--space-2)", borderBottom: "1px solid var(--stroke-rim)", color: "var(--content-secondary)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i}>
                    {preview.headers.map((h) => (
                      <td
                        key={h}
                        className="t-footnote"
                        style={{ padding: "var(--space-2)", borderTop: "1px solid var(--stroke-hairline)", color: "var(--content-primary)" }}
                      >
                        {row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
