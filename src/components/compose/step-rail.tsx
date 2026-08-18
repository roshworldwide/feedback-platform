"use client";

/**
 * The step rail.
 *
 * Persistent, always showing all five steps and which one you are on, because
 * a wizard that hides its shape makes people afraid to move. Every step is
 * reachable in any order — a report is not written top to bottom, and refusing
 * to let someone check the recipients before they finish the copy is a rule
 * that serves the form rather than the author.
 *
 * The current step lives in the URL, so this rail is navigation, not state.
 */

import * as React from "react";
import { Check } from "lucide-react";
import { Spinner } from "@/components/ui";
import { COMPOSE_STEPS, STEP_META, stepIndex, type ComposeStep } from "./vocabulary";

export type StepRailProps = {
  current: ComposeStep;
  onGo: (step: ComposeStep) => void;
  /** Steps whose required fields are complete. Drawn with a tick. */
  complete: Partial<Record<ComposeStep, boolean>>;
  /** Steps with a blocking problem. The rail states the count, not the detail. */
  problems: Partial<Record<ComposeStep, number>>;
  saving: boolean;
  /** The last successful save, already formatted. Null before the first one. */
  savedLabel: string | null;
};

export function StepRail({
  current,
  onGo,
  complete,
  problems,
  saving,
  savedLabel,
}: StepRailProps) {
  const currentIndex = stepIndex(current);

  return (
    <nav aria-label="Compose steps" className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <ol
        className="flex flex-col"
        style={{ listStyle: "none", margin: 0, padding: 0, gap: "var(--space-1)" }}
      >
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
                      active
                        ? "transparent"
                        : failures > 0
                          ? "var(--signal-abort)"
                          : "var(--stroke-rim)"
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
                    style={{
                      display: "block",
                      fontWeight: active ? 600 : 400,
                      color: "var(--content-primary)",
                    }}
                  >
                    {meta.label}
                    {active ? <span className="sr-only"> (current step)</span> : null}
                  </span>
                  <span
                    className="t-caption"
                    style={{
                      display: "block",
                      color:
                        failures > 0
                          ? "var(--signal-abort)"
                          : "var(--content-tertiary)",
                    }}
                  >
                    {failures > 0
                      ? `${failures} ${failures === 1 ? "thing" : "things"} to fix`
                      : meta.hint}
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
        {saving ? (
          <>
            <span style={{ color: "var(--content-tertiary)" }}>
              <Spinner size={12} />
            </span>
            Saving the draft…
          </>
        ) : savedLabel ? (
          `Draft saved ${savedLabel}`
        ) : (
          `Step ${currentIndex + 1} of ${COMPOSE_STEPS.length}`
        )}
      </p>
    </nav>
  );
}
