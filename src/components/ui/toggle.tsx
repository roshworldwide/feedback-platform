"use client";

/**
 * Switch and Checkbox.
 *
 * The Switch thumb travels first, on the spring-snap curve; the track fill
 * cross-fades over 200 ms only AFTER the thumb has committed, so the eye reads
 * movement and then meaning rather than a single mushy blend.
 *
 * The Checkbox is a squircle and its checkmark DRAWS over 240 ms — the stroke
 * is dashed and its offset is animated, so the tick is written, not revealed.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

/* ── Switch ───────────────────────────────────────────────────────────────── */

const TRACK_W = 52;
const TRACK_H = 32;
const THUMB = 24;
const INSET = 4;
const TRAVEL = TRACK_W - THUMB - INSET * 2;

export type SwitchProps = Omit<
  React.ComponentProps<"button">,
  "onChange" | "value" | "ref"
> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Required when no visible <label> is wired to this control. */
  label?: string;
  ref?: React.Ref<HTMLButtonElement>;
};

export function Switch({
  checked,
  onCheckedChange,
  label,
  className,
  style,
  disabled,
  onClick,
  ref,
  ...rest
}: SwitchProps) {
  // Fill lags the thumb by exactly one thumb-travel.
  const fillTransition =
    "background-color 200ms var(--ease-glide) var(--dur-snap), " +
    "border-color 200ms var(--ease-glide) var(--dur-snap)";

  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        if (!disabled) onCheckedChange(!checked);
        onClick?.(event);
      }}
      className={cn("relative inline-flex items-center", className)}
      style={{
        width: `${TRACK_W}px`,
        height: `${TRACK_H}px`,
        flex: "none",
        padding: 0,
        border: `1px solid ${
          checked ? "transparent" : "var(--stroke-rim)"
        }`,
        borderRadius: "var(--radius-capsule)",
        backgroundColor: checked ? "var(--fill-accent-solid)" : "var(--fill-quiet)",
        transition: fillTransition,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
    >
      {/* 32pt of pixels, 44pt of target. */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          height: "44px",
          transform: "translateY(-50%)",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "50%",
          left: `${INSET - 1}px`,
          width: `${THUMB}px`,
          height: `${THUMB}px`,
          borderRadius: "var(--radius-capsule)",
          backgroundColor: checked
            ? "var(--content-on-accent)"
            : "var(--content-secondary)",
          boxShadow: "var(--e1)",
          transform: `translate(${checked ? TRAVEL : 0}px, -50%)`,
          // The thumb moves first, on the spring.
          transition:
            "transform var(--dur-snap) var(--ease-snap), " +
            "background-color 200ms var(--ease-glide) var(--dur-snap)",
        }}
      />
    </button>
  );
}

/* ── Checkbox ─────────────────────────────────────────────────────────────── */

const BOX = 22;
/** Length of the tick path, used to dash it closed and then draw it open. */
const TICK_LENGTH = 24;

export type CheckboxProps = Omit<
  React.ComponentProps<"button">,
  "onChange" | "value" | "ref"
> & {
  checked: boolean;
  /** Renders the bar state — a partial selection, never a guess. */
  indeterminate?: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
};

export function Checkbox({
  checked,
  indeterminate = false,
  onCheckedChange,
  label,
  className,
  style,
  disabled,
  onClick,
  ref,
  ...rest
}: CheckboxProps) {
  const on = checked || indeterminate;

  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      disabled={disabled}
      onClick={(event) => {
        if (!disabled) onCheckedChange(!checked);
        onClick?.(event);
      }}
      className={cn("relative inline-flex items-center text-left", className)}
      style={{
        gap: "var(--space-3)",
        minHeight: "44px",
        padding: 0,
        background: "transparent",
        border: 0,
        color: "var(--content-primary)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "relative",
          width: `${BOX}px`,
          height: `${BOX}px`,
          flex: "none",
          display: "grid",
          placeItems: "center",
          // A squircle, concentric inside the capsule target.
          borderRadius: "calc(var(--radius-sm) / 2)",
          background: on ? "var(--fill-accent-solid)" : "var(--fill-quiet)",
          border: `1px solid ${on ? "transparent" : "var(--stroke-rim)"}`,
          transition:
            "background-color var(--dur-glide) var(--ease-glide), " +
            "border-color var(--dur-glide) var(--ease-glide)",
        }}
      >
        <svg
          width={BOX}
          height={BOX}
          viewBox="0 0 22 22"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          {indeterminate ? (
            <path
              d="M6 11 H16"
              stroke="var(--content-on-accent)"
              strokeWidth={2.25}
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M6 11.4 L9.5 15 L16 7.6"
              stroke="var(--content-on-accent)"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={TICK_LENGTH}
              strokeDashoffset={checked ? 0 : TICK_LENGTH}
              style={{
                transition: "stroke-dashoffset 240ms var(--ease-standard)",
              }}
            />
          )}
        </svg>
      </span>
      {label ? <span className="t-subhead">{label}</span> : null}
    </button>
  );
}
