"use client";

/**
 * The rail plus the active step panel — the `compose-editor.tsx` equivalent.
 * Unlike Compose's continuously-edited document, each audit step confirms
 * once and advances; there's no single in-memory doc to own here, so this
 * component is mostly routing (which panel is active) rather than state.
 */

import { useRouter } from "next/navigation";
import { StepRail } from "./step-rail";
import { StepMap } from "./step-map";
import { StepCompute } from "./step-compute";
import { StepReview } from "./step-review";
import { StepSend } from "./step-send";
import { CouldntLoadInline } from "@/components/campaigns/couldnt-load";
import { stepHref, type AuditStep } from "./vocabulary";
import type { AuditRunDetail, AuditRowDetail } from "@/lib/queries/audits";

export type AuditStepViewProps = {
  step: AuditStep;
  runId: string;
  run: AuditRunDetail;
  complete: Partial<Record<AuditStep, boolean>>;
  rows: AuditRowDetail[] | null;
  rowsReason: string | null;
};

export function AuditStepView({ step, runId, run, complete, rows, rowsReason }: AuditStepViewProps) {
  const router = useRouter();

  function go(next: AuditStep) {
    router.push(stepHref(runId, next));
  }

  return (
    <div className="grid" style={{ gap: "var(--space-6)", gridTemplateColumns: "220px minmax(0, 1fr)", alignItems: "start" }}>
      <StepRail current={step} onGo={go} complete={complete} problems={{}} busy={false} busyLabel="" />

      <div style={{ minWidth: 0 }}>
        {step === "upload" ? (
          // A run only reaches this page after Upload already succeeded —
          // landing here directly just moves on to Map.
          <StepMap runId={runId} />
        ) : step === "map" ? (
          <StepMap runId={runId} />
        ) : step === "compute" ? (
          <StepCompute runId={runId} alreadyComputed={run.status === "computed" || run.status === "sent"} />
        ) : step === "review" ? (
          rowsReason ? (
            <CouldntLoadInline what="the audited rows" reason={rowsReason} />
          ) : (
            <StepReview
              runId={runId}
              clientName={run.clientName}
              periodLabel={run.periodLabel}
              metrics={run.metrics}
              narrative={run.narrative}
              rows={rows ?? []}
            />
          )
        ) : (
          <StepSend runId={runId} clientId={run.clientId} clientName={run.clientName} status={run.status} campaignId={run.campaignId} />
        )}
      </div>
    </div>
  );
}
