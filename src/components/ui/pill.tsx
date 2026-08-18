/**
 * Status pill — a capsule carrying one word of state, set in `t-micro`.
 *
 * Tone is meaning, never decoration: nominal is healthy, caution is watch,
 * abort is broken. Gold is never a status.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export type PillTone = "neutral" | "nominal" | "caution" | "abort" | "accent";

const TONE: Record<PillTone, { ink: string; fill: string; edge: string }> = {
  neutral: {
    ink: "var(--content-secondary)",
    fill: "var(--fill-quiet)",
    edge: "var(--stroke-hairline)",
  },
  nominal: {
    ink: "var(--signal-nominal)",
    fill: "color-mix(in oklab, var(--signal-nominal) 16%, transparent)",
    edge: "color-mix(in oklab, var(--signal-nominal) 34%, transparent)",
  },
  caution: {
    ink: "var(--signal-caution)",
    fill: "color-mix(in oklab, var(--signal-caution) 16%, transparent)",
    edge: "color-mix(in oklab, var(--signal-caution) 34%, transparent)",
  },
  abort: {
    ink: "var(--signal-abort)",
    fill: "color-mix(in oklab, var(--signal-abort) 16%, transparent)",
    edge: "color-mix(in oklab, var(--signal-abort) 34%, transparent)",
  },
  accent: {
    ink: "var(--content-accent)",
    fill: "color-mix(in oklab, var(--content-accent) 16%, transparent)",
    edge: "color-mix(in oklab, var(--content-accent) 34%, transparent)",
  },
};

export type PillProps = React.ComponentProps<"span"> & {
  tone?: PillTone;
  /** A 6pt dot before the label — use when the tone alone carries the state. */
  dot?: boolean;
};

export function Pill({
  tone = "neutral",
  dot = false,
  className,
  style,
  children,
  ...rest
}: PillProps) {
  const skin = TONE[tone];
  return (
    <span
      {...rest}
      className={cn("t-micro inline-flex items-center whitespace-nowrap", className)}
      style={{
        gap: "var(--space-1)",
        height: "20px",
        paddingInline: "var(--space-2)",
        borderRadius: "var(--radius-capsule)",
        background: skin.fill,
        border: `1px solid ${skin.edge}`,
        color: skin.ink,
        ...style,
      }}
    >
      {dot ? (
        <span
          aria-hidden="true"
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "var(--radius-capsule)",
            background: "currentColor",
            flex: "none",
          }}
        />
      ) : null}
      {children}
    </span>
  );
}
