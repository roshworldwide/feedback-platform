import { FileWarning } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCanonicalRow } from "@/lib/audits/compute";
import { buildReportDocument } from "@/lib/audits/report-document";
import { ReportView } from "@/components/audits/report-view";
import type { CanonicalRow, ColumnMap, ComputedMetrics, NarrativeResult } from "@/lib/audits/types";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function NotAvailable() {
  return (
    <section
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--stroke-rim)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--e3)",
        padding: "var(--space-8) var(--space-6)",
        textAlign: "center",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-grid",
          placeItems: "center",
          width: "var(--space-12)",
          height: "var(--space-12)",
          borderRadius: "var(--radius-capsule)",
          background: "var(--fill-quiet)",
          color: "var(--content-tertiary)",
          marginBottom: "var(--space-4)",
        }}
      >
        <FileWarning size={22} strokeWidth={1.75} />
      </span>
      <h1 className="t-title-3" style={{ margin: 0, color: "var(--content-primary)" }}>
        This report isn&rsquo;t available
      </h1>
      <p className="t-subhead" style={{ margin: "var(--space-2) 0 0", color: "var(--content-secondary)" }}>
        The link may be incomplete, or this report hasn&rsquo;t been sent yet.
      </p>
    </section>
  );
}

/**
 * Public and unauthenticated — reads via the admin client, since a recipient
 * opening this from an email has no session. Gated strictly to `status =
 * 'sent'`, so a guessed or leaked run id can never expose a draft in
 * progress; anything else renders the same calm "not available" notice
 * `/f/[token]` shows for an invalid token, never a distinguishable error.
 */
export default async function PublicReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: runData } = await admin
    .from("audit_runs")
    .select("id, status, period_label, column_map, metrics, narrative, clients:client_id ( name )")
    .eq("id", id)
    .eq("status", "sent")
    .maybeSingle();

  if (!runData) return <NotAvailable />;

  const run = runData as unknown as Row;
  const clientName = str((run.clients as Row | null)?.name);
  if (!clientName) return <NotAvailable />;

  const columnMap = (run.column_map ?? {}) as ColumnMap;
  const { data: rowsData } = await admin
    .from("audit_rows")
    .select("row_index, raw")
    .eq("run_id", id)
    .order("row_index", { ascending: true });

  const rows: CanonicalRow[] = ((rowsData ?? []) as unknown as Row[]).map((r) =>
    normalizeCanonicalRow(r.raw as Record<string, string>, columnMap, Number(r.row_index)),
  );

  const metrics = (run.metrics ?? {}) as unknown as ComputedMetrics;
  const narrative = (run.narrative ?? {}) as unknown as NarrativeResult;
  const sections = buildReportDocument({ rows, computed: metrics, narrative });

  return <ReportView clientName={clientName} periodLabel={str(run.period_label)} sections={sections} />;
}
