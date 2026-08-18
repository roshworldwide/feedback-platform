"use client";

/**
 * Star rating — display and input.
 *
 * Amber is permitted here and nowhere else: a star is not a signal colour, it
 * is a literal object, and a grey star reads as "unrated" rather than "rated
 * low". Input mode gives every star a 44pt target, an individual `aria-label`
 * and full keyboard operation — arrows to move, 1–5 to set, 0 to clear.
 */

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** The one literal colour in the system. Stars are amber; nothing else is. */
const AMBER = "#F59E0B";

const SIZE: Record<"s" | "m" | "l", number> = { s: 14, m: 18, l: 24 };

export type StarRatingProps = {
  /** null renders as unrated — never as zero. */
  value: number | null;
  max?: number;
  size?: "s" | "m" | "l";
  className?: string;
  /** Shows "4.0" beside the stars. Averages are given, never invented. */
  showValue?: boolean;
};

export function StarRating({
  value,
  max = 5,
  size = "m",
  className,
  showValue = false,
}: StarRatingProps) {
  const px = SIZE[size];
  const filled = value === null ? 0 : Math.round(value);

  return (
    <span
      className={cn("inline-flex items-center", className)}
      style={{ gap: "var(--space-1)" }}
      role="img"
      aria-label={
        value === null ? "Not yet rated" : `${value} out of ${max} stars`
      }
    >
      {Array.from({ length: max }, (_, index) => (
        <Star
          key={index}
          size={px}
          strokeWidth={1.5}
          aria-hidden="true"
          style={{
            flex: "none",
            color: index < filled ? AMBER : "var(--content-quaternary)",
            fill: index < filled ? AMBER : "transparent",
          }}
        />
      ))}
      {showValue ? (
        <span
          className="t-footnote tabular"
          style={{ marginLeft: "var(--space-1)", color: "var(--content-secondary)" }}
        >
          {value === null ? "—" : value.toFixed(1)}
        </span>
      ) : null}
    </span>
  );
}

export type StarRatingInputProps = {
  value: number | null;
  onValueChange: (value: number | null) => void;
  max?: number;
  /** Required — the group needs a name, and a rating needs its campaign. */
  label: string;
  name?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
};

export function StarRatingInput({
  value,
  onValueChange,
  max = 5,
  label,
  disabled = false,
  className,
  id,
}: StarRatingInputProps) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const [hovered, setHovered] = React.useState<number | null>(null);
  const shown = hovered ?? value ?? 0;

  function set(next: number) {
    if (disabled) return;
    onValueChange(next === 0 ? null : next);
    refs.current[Math.max(0, next - 1)]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const current = value ?? 0;

    if (event.key >= "1" && event.key <= String(max)) {
      event.preventDefault();
      set(Number(event.key));
      return;
    }
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        set(Math.min(max, current + 1));
        break;
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        set(Math.max(0, current - 1));
        break;
      case "Home":
        event.preventDefault();
        set(1);
        break;
      case "End":
        event.preventDefault();
        set(max);
        break;
      case "0":
      case "Delete":
      case "Backspace":
        event.preventDefault();
        onValueChange(null);
        break;
      default:
        break;
    }
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      onPointerLeave={() => setHovered(null)}
      className={cn("inline-flex items-center", className)}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      {Array.from({ length: max }, (_, index) => {
        const star = index + 1;
        const active = star <= shown;
        const selected = value === star;
        return (
          <button
            key={star}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={star === 1 ? "1 star" : `${star} stars`}
            disabled={disabled}
            tabIndex={selected || (value === null && star === 1) ? 0 : -1}
            onClick={() => set(star)}
            onPointerEnter={() => setHovered(star)}
            style={{
              width: "44px",
              height: "44px",
              display: "grid",
              placeItems: "center",
              background: "transparent",
              border: 0,
              borderRadius: "var(--radius-capsule)",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            <Star
              size={24}
              strokeWidth={1.5}
              aria-hidden="true"
              style={{
                color: active ? AMBER : "var(--content-tertiary)",
                fill: active ? AMBER : "transparent",
                transform: active ? "scale(1)" : "scale(0.94)",
                transition:
                  "transform var(--dur-snap) var(--ease-snap), " +
                  "color var(--dur-glide) var(--ease-glide), " +
                  "fill var(--dur-glide) var(--ease-glide)",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
