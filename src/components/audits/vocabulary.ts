/**
 * The audit wizard's shared vocabulary — the same role `compose/vocabulary.ts`
 * plays for Compose. Step state lives in the URL (`?step=`), never in
 * component state, so a refresh or a shared link resumes exactly where the
 * author left off.
 */

import type { AuditRunStatus } from "@/lib/audits/types";
import type { RecipientChoice } from "@/components/compose/vocabulary";

export const AUDIT_STEPS = ["upload", "map", "compute", "review", "send"] as const;
export type AuditStep = (typeof AUDIT_STEPS)[number];

export type StepMeta = { step: AuditStep; label: string; hint: string };

export const STEP_META: readonly StepMeta[] = [
  { step: "upload", label: "Upload", hint: "A CSV, or a Google Sheets link" },
  { step: "map", label: "Map columns", hint: "Match the file's headers to what the report needs" },
  { step: "compute", label: "Compute", hint: "The arithmetic, the taxonomy, the AI narrative" },
  { step: "review", label: "Review", hint: "Every number traces to a row. Sign off before it sends" },
  { step: "send", label: "Send", hint: "Pick recipients and go" },
];

export function stepIndex(step: AuditStep): number {
  return AUDIT_STEPS.indexOf(step);
}

export function nextStep(step: AuditStep): AuditStep | null {
  const i = stepIndex(step);
  return i < AUDIT_STEPS.length - 1 ? AUDIT_STEPS[i + 1] : null;
}

export function previousStep(step: AuditStep): AuditStep | null {
  const i = stepIndex(step);
  return i > 0 ? AUDIT_STEPS[i - 1] : null;
}

export function stepHref(runId: string, step: AuditStep): string {
  return `/audits/${runId}?step=${step}`;
}

export function parseStep(value: string | string[] | undefined): AuditStep {
  const raw = Array.isArray(value) ? value[0] : value;
  return (AUDIT_STEPS as readonly string[]).includes(raw ?? "") ? (raw as AuditStep) : "map";
}

/** What each step needs to be considered done, driving the rail's checkmarks. */
export function stepComplete(step: AuditStep, status: AuditRunStatus): boolean {
  const order: AuditRunStatus[] = ["uploaded", "mapped", "computed", "sent"];
  const reached = (s: AuditRunStatus) => order.indexOf(status) >= order.indexOf(s);
  switch (step) {
    case "upload":
      return true; // a run only exists once uploaded
    case "map":
      return reached("mapped");
    case "compute":
      return reached("computed");
    case "review":
      return reached("computed");
    case "send":
      return status === "sent";
    default:
      return false;
  }
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

export type PreflightCheck = {
  id: string;
  label: string;
  tone: "pass" | "warn" | "fail";
  detail: string;
  fix: AuditStep;
};

export type SendPreflightInput = {
  status: AuditRunStatus;
  clientId: string | null;
  chosen: RecipientChoice[];
};

/** The same shape Compose's Review step uses — a send cannot pass a rule this list shows as failing. */
export function sendPreflight(input: SendPreflightInput): PreflightCheck[] {
  const clientRecipients = input.chosen.filter((c) => !c.isInternal && c.isActive).length;
  return [
    {
      id: "computed",
      label: "Report is computed",
      tone: input.status === "computed" || input.status === "sent" ? "pass" : "fail",
      detail:
        input.status === "computed" || input.status === "sent"
          ? "Sections 1-5 are ready."
          : "Run Compute before sending.",
      fix: "compute",
    },
    {
      id: "client",
      label: "Client is set",
      tone: input.clientId ? "pass" : "fail",
      detail: input.clientId ? "The report is attributed to a client record." : "No client — this was set at upload.",
      fix: "upload",
    },
    {
      id: "recipient",
      label: "At least one client recipient",
      tone: clientRecipients > 0 ? "pass" : "fail",
      detail:
        clientRecipients > 0
          ? `${clientRecipients} client recipient${clientRecipients === 1 ? "" : "s"} selected.`
          : "Choose at least one client contact.",
      fix: "send",
    },
  ];
}

export function blockingFailures(checks: PreflightCheck[]): PreflightCheck[] {
  return checks.filter((c) => c.tone === "fail");
}

export { activeOnly, isEmailShaped, recipientSentence, summariseRecipients } from "@/components/compose/vocabulary";
export type { AdHocRecipient, RecipientChoice, RecipientSummary } from "@/components/compose/vocabulary";
