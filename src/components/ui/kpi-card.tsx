"use client";

/**
 * KPI card.
 *
 * Every KPI carries its formula. v1 shipped a card labelled "Open Rate" that
 * counted a click as a second open; the fix is not a better label but a card
 * that cannot exist without stating its own arithmetic — hence `formula` is a
 * required prop, taken from `FORMULAE` in `src/lib/metrics.ts`.
 *
 * No decimal is ever invented here. A null value renders as an em dash,
 * because absence is not zero.
 */

import * as React from "react";
import { ArrowDown, ArrowUp, Info, Minus } from "lucide-react";
import { trendOf, type Trend } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { Card } from "./card";
import type { CardAccent } from "./card";
import { Skeleton } from "./skeleton";

const TREND_INK: Record<Trend, string> = {
  up: "var(--signal-nominal)",
  down: "var(--signal-abort)",
  flat: "var(--content-tertiary)",
  unknown: "var(--content-tertiary)",
};

/* ── The ⓘ tooltip ────────────────────────────────────────────────────────── */

export type InfoTipProps = {
  /** The sentence a reader needs in order to trust the number. */
  text: string;
  /** Names the thing being explained, for the screen-reader label. */
  about: string;
  className?: string;
};

export function InfoTip({ text, about, className }: InfoTipProps) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label={`How ${about} is calculated`}
        aria-describedby={id}
        aria-expanded={open}
        onPointerEnter={() => setOpen(true)}
        onPointerLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className="relative inline-grid place-items-center"
        style={{
          width: "20px",
          height: "20px",
          borderRadius: "var(--radius-capsule)",
          background: "transparent",
          border: 0,
          color: "var(--content-tertiary)",
          cursor: "help",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "50% auto auto 50%",
            width: "44px",
            height: "44px",
            transform: "translate(-50%, -50%)",
          }}
        />
        <Info size={14} strokeWidth={1.75} aria-hidden="true" />
      </button>

      <span
        id={id}
        role="tooltip"
        className="t-caption"
        style={{
          position: "absolute",
          bottom: "calc(100% + var(--space-2))",
          left: "50%",
          transform: open
            ? "translate(-50%, 0)"
            : "translate(-50%, var(--space-1))",
          width: "max-content",
          maxWidth: "240px",
          padding: "var(--space-2) var(--space-3)",
          borderRadius: "var(--radius-sm)",
          background: "var(--surface-raised)",
          border: "1px solid var(--stroke-rim)",
          boxShadow: "var(--e3)",
          color: "var(--content-primary)",
          opacity: open ? 1 : 0,
          visibility: open ? "visible" : "hidden",
          pointerEvents: "none",
          zIndex: 20,
          transition: open
            ? "opacity var(--dur-enter) var(--ease-enter), transform var(--dur-enter) var(--ease-enter), visibility 0s"
            : "opacity var(--dur-exit) var(--ease-exit), transform var(--dur-exit) var(--ease-exit), visibility 0s var(--dur-exit)",
        }}
      >
        {text}
      </span>
    </span>
  );
}

/* ── Sparkline ────────────────────────────────────────────────────────────── */

function Sparkline({ points, label }: { points: number[]; label: string }) {
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = 100 / (points.length - 1);

  const path = points
    .map((point, index) => {
      const x = index * stepX;
      const y = 24 - ((point - min) / span) * 24;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      style={{ width: "100%", height: "24px", display: "block", overflow: "visible" }}
    >
      {/* One stroke. No gridlines, no fill, no gradient. */}
      <path
        d={path}
        fill="none"
        stroke="var(--content-tertiary)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ── KpiCard ──────────────────────────────────────────────────────────────── */

export type KpiCardProps = {
  /** Set as an overline — the name of the measurement, not a sentence. */
  label: string;
  /** Already formatted by the caller (fmtPct, fmtInt…). null renders as "—". */
  value: string | number | null;
  /** A unit set beside the value — "%", "ratings", "days". */
  unit?: string;
  /** REQUIRED. Use a string from FORMULAE so the definition is stated once. */
  formula: string;
  /** Percentage-point change against the comparison period. null is unknown. */
  delta?: number | null;
  /** True where falling is an improvement — bounce rate, unsubscribes. */
  deltaInverted?: boolean;
  /** Names the comparison: "vs previous 30 days". */
  deltaLabel?: string;
  /** Appended to the delta figure. */
  deltaSuffix?: string;
  sparkline?: number[];
  sparklineLabel?: string;
  /** Where an exclusion applies, state it here — never apply it silently. */
  footnote?: React.ReactNode;
  accent?: CardAccent;
  loading?: boolean;
  className?: string;
};

export function KpiCard({
  label,
  value,
  unit,
  formula,
  delta,
  deltaInverted = false,
  deltaLabel,
  deltaSuffix = " pts",
  sparkline,
  sparklineLabel,
  footnote,
  accent,
  loading = false,
  className,
}: KpiCardProps) {
  const trend = trendOf(delta ?? null, deltaInverted);
  const DeltaIcon =
    delta === null || delta === undefined
      ? Minus
      : delta > 0
        ? ArrowUp
        : delta < 0
          ? ArrowDown
          : Minus;

  return (
    <Card accent={accent} className={className}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
          padding: "var(--space-5)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-1)",
            minHeight: "20px",
          }}
        >
          <span className="t-overline" style={{ color: "var(--content-secondary)" }}>
            {label}
          </span>
          <InfoTip text={formula} about={label.toLowerCase()} />
        </div>

        {loading ? (
          <Skeleton height="40px" width="60%" />
        ) : (
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
            <span
              className="t-title-1 tabular"
              style={{ color: "var(--content-primary)" }}
            >
              {value === null || value === undefined ? "—" : value}
            </span>
            {unit && value !== null && value !== undefined ? (
              <span className="t-footnote" style={{ color: "var(--content-tertiary)" }}>
                {unit}
              </span>
            ) : null}
          </div>
        )}

        {delta !== undefined ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-1)",
              color: TREND_INK[trend],
            }}
          >
            <DeltaIcon size={14} strokeWidth={2} aria-hidden="true" />
            <span className="t-footnote tabular">
              {delta === null
                ? "—"
                : `${delta > 0 ? "+" : ""}${delta}${deltaSuffix}`}
            </span>
            {deltaLabel ? (
              <span
                className="t-footnote"
                style={{ color: "var(--content-tertiary)" }}
              >
                {deltaLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        {sparkline && sparkline.length > 1 ? (
          <div style={{ marginTop: "var(--space-1)" }}>
            <Sparkline
              points={sparkline}
              label={sparklineLabel ?? `${label} over the period`}
            />
          </div>
        ) : null}

        {footnote ? (
          <p
            className="t-caption"
            style={{ margin: 0, color: "var(--content-tertiary)" }}
          >
            {footnote}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
