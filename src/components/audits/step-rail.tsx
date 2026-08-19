"use client";

/**
 * The audit wizard's step rail — the same shape as Compose's, ported for
 * this feature's five steps. Every step stays reachable in any order; the
 * rail states a problem count, never the detail.
 */

import { Check } from "lucide-react";
import { Spinner } from "@/components/ui";
import { AUDIT_STEPS, STEP_META, stepIndex, type AuditStep } from "./vocabulary";

export type StepRailProps = {
  current: AuditStep;
  onGo: (step: AuditStep) => void;
  complete: Partial<Record<AuditStep, boolean>>;
  problems: Partial<Record<AuditStep, number>>;
  busy: boolean;
  busyLabel: string;
};

export function StepRail({ current, onGo, complete, problems, busy, busyLabel }: StepRailProps) {
  const currentIndex = stepIndex(current);

  return (
    <nav aria-label="Audit steps" className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <ol className="flex flex-col" style={{ listStyle: "none", margin: 0, padding: 0, gap: "var(--space-1)" }}>
        {STEP_META.map((meta, index) => {
          const active = meta.step === current;
          const done = complete[meta.step] === true && !active;
          const failures = problems[meta.step] ?? 0;
          const passed = index < currentIndex;

          return (
            <li key={meta.step}>
              <button
                type="button"
                onClick={() => onGo(meta.step)}
                aria-current={active ? "step" : undefined}
                className="flex w-full items-start text-left"
                style={{
                  gap: "var(--space-3)",
                  minHeight: "44px",
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  background: active ? "var(--fill-quiet)" : "transparent",
                  border: 0,
                  color: "var(--content-primary)",
                  cursor: "pointer",
                  transition: "background-color var(--dur-glide) var(--ease-glide)",
                }}
              >
                <span
                  aria-hidden="true"
                  className="t-micro tabular"
                  style={{
                    flex: "none",
                    width: "24px",
                    height: "24px",
                    marginTop: "2px",
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "var(--radius-capsule)",
                    background: active
                      ? "var(--fill-accent-solid)"
                      : done || passed
                        ? "var(--fill-quiet)"
                        : "transparent",
                    border: `1px solid ${
                      active ? "transparent" : failures > 0 ? "var(--signal-abort)" : "var(--stroke-rim)"
                    }`,
                    color: active
                      ? "var(--content-on-accent)"
                      : failures > 0
                        ? "var(--signal-abort)"
                        : "var(--content-secondary)",
                    fontWeight: 600,
                  }}
                >
                  {done ? <Check size={13} strokeWidth={2.5} /> : index + 1}
                </span>

                <span style={{ minWidth: 0 }}>
                  <span
                    className="t-subhead"
                    style={{ display: "block", fontWeight: active ? 600 : 400, color: "var(--content-primary)" }}
                  >
                    {meta.label}
                    {active ? <span className="sr-only"> (current step)</span> : null}
                  </span>
                  <span
                    className="t-caption"
                    style={{ display: "block", color: failures > 0 ? "var(--signal-abort)" : "var(--content-tertiary)" }}
                  >
                    {failures > 0 ? `${failures} ${failures === 1 ? "thing" : "things"} to fix` : meta.hint}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <p
        className="t-caption"
        role="status"
        aria-live="polite"
        style={{
          margin: 0,
          paddingInline: "var(--space-3)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          color: "var(--content-tertiary)",
          minHeight: "var(--space-4)",
        }}
      >
        {busy ? (
          <>
            <span style={{ color: "var(--content-tertiary)" }}>
              <Spinner size={12} />
            </span>
            {busyLabel}
          </>
        ) : (
          `Step ${currentIndex + 1} of ${AUDIT_STEPS.length}`
        )}
      </p>
    </nav>
  );
}
