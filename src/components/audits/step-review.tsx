"use client";

/**
 * Step 4 · Review.
 *
 * The computed report, in AURUM, with every number traceable to the rows
 * behind it. A human signs this off — fatal flags, issue tags and the
 * narrative text are all editable here; the machine only drafted them.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, CardTitle, Checkbox, TextArea, useToast } from "@/components/ui";
import { ReportView } from "@/components/audits/report-view";
import { buildReportDocument } from "@/lib/audits/report-document";
import type { ComputedMetrics, NarrativeResult } from "@/lib/audits/types";
import type { AuditRowDetail } from "@/lib/queries/audits";
import { updateNarrativeAction, updateRowAction } from "@/app/(app)/audits/actions";

export type StepReviewProps = {
  runId: string;
  clientName: string;
  periodLabel: string;
  metrics: ComputedMetrics;
  narrative: NarrativeResult;
  rows: AuditRowDetail[];
};

export function StepReview({ runId, clientName, periodLabel, metrics, narrative: initialNarrative, rows: initialRows }: StepReviewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [narrative, setNarrative] = React.useState(initialNarrative);
  const [rows, setRows] = React.useState(initialRows);
  const [highlighted, setHighlighted] = React.useState<Set<number> | null>(null);
  const [editingNarrative, setEditingNarrative] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const sections = React.useMemo(
    () => buildReportDocument({ rows, computed: metrics, narrative }),
    [rows, metrics, narrative],
  );

  const rowByIndex = React.useMemo(() => new Map(rows.map((r) => [r.rowIndex, r])), [rows]);
  const visibleRows = highlighted ? rows.filter((r) => highlighted.has(r.rowIndex)) : rows;

  async function toggleFatal(rowIndex: number, isFatal: boolean) {
    setRows((current) => current.map((r) => (r.rowIndex === rowIndex ? { ...r, isFatal } : r)));
    const result = await updateRowAction(runId, rowIndex, { isFatal });
    if (!result.ok) toast({ message: result.message, tone: "abort" });
  }

  async function saveFatalReason(rowIndex: number, fatalReason: string) {
    const result = await updateRowAction(runId, rowIndex, { fatalReason });
    if (!result.ok) toast({ message: result.message, tone: "abort" });
  }

  async function saveNarrativeEdits() {
    setSaving(true);
    const result = await updateNarrativeAction(runId, {
      fatalErrors: narrative.fatalErrors,
      observations: narrative.observations,
    });
    setSaving(false);
    if (!result.ok) {
      toast({ message: result.message, tone: "abort" });
      return;
    }
    setNarrative(result.data.narrative);
    setEditingNarrative(false);
    toast({ message: "Narrative saved.", tone: "nominal" });
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      <Card elevation="e1">
        <CardBody>
          <ReportView
            clientName={clientName}
            periodLabel={periodLabel}
            sections={sections}
            onDrillThrough={(indexes) => setHighlighted(new Set(indexes))}
          />
        </CardBody>
      </Card>

      <Card elevation="e1">
        <CardHeader
          action={
            highlighted ? (
              <Button size="s" variant="plain" onClick={() => setHighlighted(null)}>
                Clear filter
              </Button>
            ) : null
          }
        >
          <CardTitle
            as="h2"
            description={highlighted ? `Showing ${visibleRows.length} of ${rows.length} rows, from the number you clicked.` : `All ${rows.length} audited rows. Mark fatal calls and edit issue tags here.`}
          >
            Rows
          </CardTitle>
        </CardHeader>
        <CardBody style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "640px" }}>
            <thead>
              <tr>
                {["#", "Disposition", "QA", "Identifier", "Fatal", "Reason"].map((h) => (
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
              {visibleRows.map((row) => (
                <tr key={row.rowIndex}>
                  <td className="t-footnote tabular" style={{ padding: "var(--space-2)", borderTop: "1px solid var(--stroke-hairline)" }}>
                    {row.rowIndex + 1}
                  </td>
                  <td className="t-footnote" style={{ padding: "var(--space-2)", borderTop: "1px solid var(--stroke-hairline)" }}>
                    {row.disposition}
                  </td>
                  <td className="t-footnote" style={{ padding: "var(--space-2)", borderTop: "1px solid var(--stroke-hairline)" }}>
                    {row.qaName}
                  </td>
                  <td className="t-footnote" style={{ padding: "var(--space-2)", borderTop: "1px solid var(--stroke-hairline)" }}>
                    {row.identifier}
                  </td>
                  <td style={{ padding: "var(--space-2)", borderTop: "1px solid var(--stroke-hairline)" }}>
                    <Checkbox
                      checked={row.isFatal}
                      label="Fatal"
                      onCheckedChange={(checked) => toggleFatal(row.rowIndex, checked)}
                    />
                  </td>
                  <td style={{ padding: "var(--space-2)", borderTop: "1px solid var(--stroke-hairline)", minWidth: "220px" }}>
                    {row.isFatal ? (
                      <TextArea
                        rows={2}
                        defaultValue={rowByIndex.get(row.rowIndex)?.fatalReason ?? ""}
                        onBlur={(e) => saveFatalReason(row.rowIndex, e.currentTarget.value)}
                        placeholder="Why is this call unreliable?"
                      />
                    ) : (
                      <span className="t-footnote" style={{ color: "var(--content-tertiary)" }}>
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card elevation="e1">
        <CardHeader action={<Button size="s" variant="plain" onClick={() => setEditingNarrative((v) => !v)}>{editingNarrative ? "Cancel" : "Edit narrative"}</Button>}>
          <CardTitle as="h2" description="§6-7 are AI-drafted or human-written — never both silently. Edit the text directly.">
            Narrative
          </CardTitle>
        </CardHeader>
        {editingNarrative ? (
          <CardBody className="flex flex-col" style={{ gap: "var(--space-4)" }}>
            {narrative.fatalErrors.map((entry, i) => (
              <div key={i} className="flex flex-col" style={{ gap: "var(--space-2)" }}>
                <span className="t-caption" style={{ color: "var(--content-tertiary)" }}>
                  Fatal error — row {entry.rowIndex + 1}
                </span>
                <TextArea
                  rows={2}
                  defaultValue={entry.reason}
                  onBlur={(e) =>
                    setNarrative((current) => ({
                      ...current,
                      fatalErrors: current.fatalErrors.map((f, idx) => (idx === i ? { ...f, reason: e.currentTarget.value } : f)),
                    }))
                  }
                />
              </div>
            ))}
            {narrative.observations.map((entry, i) => (
              <div key={i} className="flex flex-col" style={{ gap: "var(--space-2)" }}>
                <span className="t-caption" style={{ color: "var(--content-tertiary)" }}>
                  {entry.theme}
                </span>
                <TextArea
                  rows={3}
                  defaultValue={`${entry.finding}\n\n${entry.recommendation}`}
                  onBlur={(e) => {
                    const [finding = "", recommendation = ""] = e.currentTarget.value.split("\n\n");
                    setNarrative((current) => ({
                      ...current,
                      observations: current.observations.map((o, idx) => (idx === i ? { ...o, finding, recommendation } : o)),
                    }));
                  }}
                />
              </div>
            ))}
            <Button variant="solid" loading={saving} onClick={saveNarrativeEdits} style={{ alignSelf: "flex-start" }}>
              Save narrative
            </Button>
          </CardBody>
        ) : null}
      </Card>

      <Button variant="solid" onClick={() => router.push(`/audits/${runId}?step=send`)} style={{ alignSelf: "flex-start" }}>
        Continue to Send
      </Button>
    </div>
  );
}
