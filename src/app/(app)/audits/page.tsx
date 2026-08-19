/**
 * Audits — past and in-progress runs.
 *
 * Mirrors the Clients list page's shape: independent reads, each failure
 * isolated rather than taking the whole screen down, a "New audit" button
 * that routes into the full upload flow (too large for a Sheet), and taxonomy
 * management one click away.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button, Card, CardBody, Pill } from "@/components/ui";
import { CouldntLoad } from "@/components/campaigns/couldnt-load";
import { TaxonomySheet } from "@/components/audits/taxonomy-sheet";
import { listAuditRuns, type AuditRunSummary } from "@/lib/queries/audits";
import { fmtDate, fmtInt } from "@/lib/utils";
import { getSessionProfile } from "@/lib/supabase/server";
import type { AuditRunStatus } from "@/lib/audits/types";

export const metadata: Metadata = { title: "Audits" };

const STATUS_TONE: Record<AuditRunStatus, "neutral" | "nominal" | "caution" | "abort"> = {
  uploaded: "neutral",
  mapped: "neutral",
  computed: "caution",
  sent: "nominal",
  failed: "abort",
};

const STATUS_LABEL: Record<AuditRunStatus, string> = {
  uploaded: "Uploaded",
  mapped: "Mapped",
  computed: "Computed",
  sent: "Sent",
  failed: "Failed",
};

function stepFor(status: AuditRunStatus): string {
  switch (status) {
    case "uploaded":
      return "map";
    case "mapped":
      return "compute";
    case "computed":
      return "review";
    default:
      return "send";
  }
}

function RunRow({ run }: { run: AuditRunSummary }) {
  return (
    <li>
      <Link
        href={`/audits/${run.id}?step=${stepFor(run.status)}`}
        className="flex items-center"
        style={{
          gap: "var(--space-4)",
          minHeight: "56px",
          padding: "var(--space-3) var(--space-4)",
          borderTop: "1px solid var(--stroke-hairline)",
          color: "var(--content-primary)",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          <span className="t-subhead" style={{ display: "block", fontWeight: 600 }}>
            {run.clientName}
          </span>
          <span className="t-footnote" style={{ display: "block", color: "var(--content-tertiary)" }}>
            {run.periodLabel || run.name} · {fmtInt(run.rowCount)} rows · {fmtDate(run.createdAt)}
          </span>
        </div>
        <Pill tone={STATUS_TONE[run.status]}>{STATUS_LABEL[run.status]}</Pill>
      </Link>
    </li>
  );
}

export default async function AuditsPage() {
  const [runs, profile] = await Promise.all([listAuditRuns(), getSessionProfile()]);
  const canDelete = profile?.role === "admin" || profile?.role === "team_lead";

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
      <div className="flex flex-wrap items-center justify-between" style={{ gap: "var(--space-3)" }}>
        <div>
          <h1 className="t-title-1" style={{ margin: 0, color: "var(--content-primary)" }}>
            Audits
          </h1>
          <p className="t-subhead" style={{ margin: "var(--space-1) 0 0", color: "var(--content-secondary)" }}>
            Upload a call-audit CSV, review the report, send it as a campaign.
          </p>
        </div>
        <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
          <TaxonomySheet canDelete={canDelete} />
          <Button variant="metal" size="m" leadingIcon={Plus} href="/audits/new">
            New audit
          </Button>
        </div>
      </div>

      {!runs.ok ? (
        <CouldntLoad what="past audit runs" reason={runs.reason} />
      ) : runs.data.length === 0 ? (
        <Card elevation="e1">
          <CardBody>
            <p className="t-subhead" style={{ margin: 0, color: "var(--content-secondary)" }}>
              No audits yet. Upload a CSV to start the first one.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card elevation="e1">
          <CardBody style={{ padding: 0 }}>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {runs.data.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
