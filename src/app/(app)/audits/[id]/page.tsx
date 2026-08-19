/**
 * Audits — steps 2-5, URL-driven via `?step=`, mirroring
 * `compose/[draftId]/page.tsx`'s shape exactly.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CouldntLoad } from "@/components/campaigns/couldnt-load";
import { firstParam, type SearchParams } from "@/components/campaigns/vocabulary";
import { parseStep, stepComplete, type AuditStep } from "@/components/audits/vocabulary";
import { AuditStepView } from "@/components/audits/audit-step-view";
import { getAuditRun, listAuditRunRows } from "@/lib/queries/audits";

export const metadata: Metadata = { title: "Audit" };

/**
 * Headroom for `generateNarrativeAction`'s AI call, invoked from this route's
 * Compute step — `maxDuration` has to live in route-segment config, not in
 * the "use server" actions file itself (which may only export async
 * functions), so it's declared here instead.
 */
export const maxDuration = 60;

export default async function AuditRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const step = parseStep(firstParam(await searchParams, "step") ?? undefined);

  const run = await getAuditRun(id);
  if (!run.ok) {
    return (
      <CouldntLoad what="this audit run" reason={run.reason} next="Nothing was changed and nothing was lost. Reload the page, or go back to Audits." />
    );
  }
  if (!run.data) notFound();

  const needsRows = step === "review" || step === "send";
  const rows = needsRows ? await listAuditRunRows(id) : null;

  const complete: Partial<Record<AuditStep, boolean>> = Object.fromEntries(
    (["upload", "map", "compute", "review", "send"] as AuditStep[]).map((s) => [s, stepComplete(s, run.data!.status)]),
  );

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
      <div>
        <h1 className="t-title-1" style={{ margin: 0, color: "var(--content-primary)" }}>
          {run.data.clientName}
        </h1>
        <p className="t-subhead" style={{ margin: "var(--space-1) 0 0", color: "var(--content-secondary)" }}>
          {run.data.periodLabel || run.data.name}
        </p>
      </div>

      <AuditStepView
        step={step}
        runId={id}
        run={run.data}
        complete={complete}
        rows={rows?.ok ? rows.data : null}
        rowsReason={rows && !rows.ok ? rows.reason : null}
      />
    </div>
  );
}
