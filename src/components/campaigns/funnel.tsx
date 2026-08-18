/**
 * The send funnel, horizontal.
 *
 * Every stage carries three facts: how many reached it, what share of the
 * original send that is, and how many were lost since the previous stage.
 * v1 drew five bars and labelled none of the gaps between them, which is the
 * only part anybody can act on.
 *
 * The bars are decoration over text. Read with the images off, each row still
 * says "Delivered — 158 of 161, 3 lost since Sent".
 */

import { funnelOf, type CampaignStats } from "@/lib/metrics";
import { fmtInt, fmtPct } from "@/lib/utils";

export function Funnel({ stats }: { stats: CampaignStats }) {
  const steps = funnelOf(stats);
  const start = steps[0].value;

  return (
    <ol
      className="flex flex-col"
      style={{ gap: "var(--space-4)", margin: 0, padding: 0, listStyle: "none" }}
    >
      {steps.map((step, index) => {
        const share = step.ofStart ?? 0;
        return (
          <li key={step.key} className="flex flex-col" style={{ gap: "var(--space-2)" }}>
            <div
              className="flex flex-wrap items-baseline justify-between"
              style={{ gap: "var(--space-3)" }}
            >
              <span
                className="t-footnote"
                style={{ color: "var(--content-secondary)", fontWeight: 600 }}
              >
                {step.label}
              </span>

              <span
                className="flex items-baseline"
                style={{ gap: "var(--space-3)" }}
              >
                <span
                  className="t-headline tabular"
                  style={{ color: "var(--content-primary)" }}
                >
                  {fmtInt(step.value)}
                </span>
                <span
                  className="t-footnote tabular"
                  style={{ color: "var(--content-tertiary)" }}
                >
                  {fmtPct(step.ofStart)} of sent
                </span>
                <span
                  className="t-footnote tabular"
                  style={{
                    color:
                      step.dropOff && step.dropOff > 0
                        ? "var(--signal-caution)"
                        : "var(--content-tertiary)",
                    minWidth: "128px",
                    textAlign: "right",
                  }}
                >
                  {step.dropOff === null
                    ? "Start of the funnel"
                    : step.dropOff === 0
                      ? "No drop-off"
                      : `${fmtInt(step.dropOff)} lost since ${steps[index - 1].label.toLowerCase()}`}
                </span>
              </span>
            </div>

            <div
              aria-hidden="true"
              style={{
                height: "var(--space-4)",
                borderRadius: "var(--radius-capsule)",
                background: "var(--fill-quiet)",
                border: "1px solid var(--stroke-hairline)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.max(0, Math.min(100, share))}%`,
                  borderRadius: "var(--radius-capsule)",
                  background:
                    "color-mix(in oklab, var(--signal-link) 34%, transparent)",
                  transition: "width var(--dur-enter) var(--ease-enter)",
                }}
              />
            </div>
          </li>
        );
      })}

      <li>
        <p
          className="t-caption"
          style={{ margin: 0, color: "var(--content-tertiary)" }}
        >
          The funnel starts at {fmtInt(start)} external recipients. Internal
          colleagues on this send are excluded from every stage.
        </p>
      </li>
    </ol>
  );
}
