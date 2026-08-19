"use client";

/**
 * Step 2 · Map columns.
 *
 * Headers are never hardcoded. A best guess is pre-filled — fresh from
 * `fuzzyMatchColumns`, or this client's last mapping when its header still
 * exists in this file — but every role always shows on screen and needs
 * confirmation. Saving here writes the mapping onto every row, so it never
 * needs re-guessing on the next visit.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, CardTitle, Field, Select, Spinner, useToast } from "@/components/ui";
import { COLUMN_ROLES, type ColumnMap, type ColumnRole } from "@/lib/audits/types";
import { saveMappingAction, suggestMappingAction } from "@/app/(app)/audits/actions";

const ROLE_LABEL: Record<ColumnRole, string> = {
  disposition: "Disposition",
  accuracy: "Was the disposition accurate?",
  correctedDisposition: "Corrected disposition (if not accurate)",
  qaName: "QA name",
  observation: "Observation",
  improvement: "What can we improve",
  identifier: "Phone number / identifier",
  link: "Lead link",
};

export type StepMapProps = { runId: string };

export function StepMap({ runId }: StepMapProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [map, setMap] = React.useState<ColumnMap>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void suggestMappingAction(runId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        toast({ message: result.message, tone: "abort" });
        return;
      }
      setHeaders(result.data.headers);
      const hasCurrent = Object.keys(result.data.currentMap).length > 0;
      setMap(hasCurrent ? result.data.currentMap : result.data.suggestedMap);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const missing = COLUMN_ROLES.filter((role) => !map[role]);

  async function save() {
    setSaving(true);
    const result = await saveMappingAction(runId, map);
    setSaving(false);
    if (!result.ok) {
      toast({ message: result.message, tone: "abort" });
      return;
    }
    toast({ message: `${result.data.rowCount} rows mapped.`, tone: "nominal" });
    router.push(`/audits/${runId}?step=compute`);
  }

  if (loading) {
    return (
      <p className="t-subhead flex items-center" style={{ gap: "var(--space-3)", color: "var(--content-secondary)" }}>
        <Spinner size={16} /> Reading the file&rsquo;s headers…
      </p>
    );
  }

  return (
    <Card elevation="e1">
      <CardHeader>
        <CardTitle
          as="h2"
          description={
            missing.length > 0
              ? `${missing.length} column${missing.length === 1 ? "" : "s"} still need a match.`
              : "Every column is matched. Confirm to compute the report."
          }
        >
          Map columns
        </CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col" style={{ gap: "var(--space-4)" }}>
        {COLUMN_ROLES.map((role) => (
          <Field key={role} label={ROLE_LABEL[role]} required>
            <Select
              value={map[role] ?? ""}
              onChange={(e) => setMap((current) => ({ ...current, [role]: e.currentTarget.value || undefined }))}
              options={[
                { value: "", label: "— choose a column —" },
                ...headers.map((h) => ({ value: h, label: h })),
              ]}
            />
          </Field>
        ))}

        <Button variant="solid" loading={saving} disabled={missing.length > 0} onClick={save} style={{ alignSelf: "flex-start" }}>
          Continue to Compute
        </Button>
      </CardBody>
    </Card>
  );
}
