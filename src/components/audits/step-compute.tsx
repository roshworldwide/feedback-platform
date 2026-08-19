"use client";

/**
 * Step 3 · Compute.
 *
 * Two phases, two actions — the arithmetic (instant) and the AI narrative
 * (can take real seconds). The deterministic numbers appear the moment
 * they're ready rather than waiting behind the AI call; a skeleton draws the
 * destination, not a spinner standing in for a count that already exists.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button, Card, CardBody, CardHeader, CardTitle, Spinner, useToast } from "@/components/ui";
import { computeReportAction, generateNarrativeAction } from "@/app/(app)/audits/actions";

export type StepComputeProps = { runId: string; alreadyComputed: boolean };

type Phase = "idle" | "arithmetic" | "narrative" | "done" | "error";

export function StepCompute({ runId, alreadyComputed }: StepComputeProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [phase, setPhase] = React.useState<Phase>(alreadyComputed ? "done" : "idle");
  const [totals, setTotals] = React.useState<{ totalAudited: number; accuracyRatePct: number | null } | null>(null);

  async function run() {
    setPhase("arithmetic");
    const computed = await computeReportAction(runId);
    if (!computed.ok) {
      toast({ message: computed.message, tone: "abort" });
      setPhase("error");
      return;
    }
    setTotals({
      totalAudited: computed.data.metrics.overall.totalAudited,
      accuracyRatePct: computed.data.metrics.overall.accuracyRatePct,
    });

    setPhase("narrative");
    const narrative = await generateNarrativeAction(runId);
    if (!narrative.ok) {
      // §1-5 are already saved regardless — a narrative failure never blocks Review.
      toast({ message: narrative.message, tone: "caution" });
    }
    setPhase("done");
  }

  return (
    <Card elevation="e1">
      <CardHeader>
        <CardTitle as="h2" description="Sections 1-5 are arithmetic and a keyword taxonomy — never dependent on AI. Sections 6-7 draft with it, when a key is configured.">
          Compute the report
        </CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col" style={{ gap: "var(--space-4)" }}>
        {phase === "idle" ? (
          <Button variant="solid" onClick={run} style={{ alignSelf: "flex-start" }}>
            Compute the report
          </Button>
        ) : (
          <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
            <PhaseRow
              label="Arithmetic and taxonomy — sections 1-5"
              state={phase === "arithmetic" ? "active" : totals || phase === "done" ? "done" : "pending"}
              detail={totals ? `${totals.totalAudited} audited, ${totals.accuracyRatePct ?? "—"}% accurate.` : undefined}
            />
            <PhaseRow
              label="AI narrative — sections 6-7"
              state={phase === "narrative" ? "active" : phase === "done" ? "done" : "pending"}
            />
          </div>
        )}

        {phase === "done" ? (
          <Button variant="solid" onClick={() => router.push(`/audits/${runId}?step=review`)} style={{ alignSelf: "flex-start" }}>
            Continue to Review
          </Button>
        ) : null}
        {phase === "error" ? (
          <Button variant="tinted" onClick={run} style={{ alignSelf: "flex-start" }}>
            Try again
          </Button>
        ) : null}
      </CardBody>
    </Card>
  );
}

function PhaseRow({ label, state, detail }: { label: string; state: "pending" | "active" | "done"; detail?: string }) {
  return (
    <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
      <span
        aria-hidden="true"
        style={{
          display: "grid",
          placeItems: "center",
          width: "22px",
          height: "22px",
          flex: "none",
          borderRadius: "var(--radius-capsule)",
          background: state === "pending" ? "transparent" : "var(--fill-quiet)",
          border: state === "pending" ? "1px solid var(--stroke-rim)" : undefined,
          color: state === "done" ? "var(--signal-nominal)" : "var(--content-tertiary)",
        }}
      >
        {state === "active" ? <Spinner size={13} /> : state === "done" ? <Check size={13} strokeWidth={2.5} /> : null}
      </span>
      <span className="t-subhead" style={{ color: "var(--content-primary)" }}>
        {label}
        {detail ? (
          <span className="t-footnote" style={{ display: "block", color: "var(--content-tertiary)" }}>
            {detail}
          </span>
        ) : null}
      </span>
    </div>
  );
}
