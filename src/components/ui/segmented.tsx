"use client";

/**
 * Segmented control — two to four options, every one of them visible.
 *
 * The selection is a pill that TRANSLATES on the glide curve. It never fades
 * out and back in: the eye must be able to follow the choice from where it was
 * to where it now is.
 *
 * Segments are sized to their own label, not to an equal 1/n share — "Today"
 * and "7d" are never the same width. The pill therefore can't be positioned
 * with a `100% / count` formula (that produces a capsule that doesn't match
 * the segment under it — too narrow for a long label, offset for a short
 * one). It is measured off the actual button bounds instead, and re-measured
 * on resize since a label's rendered width isn't known until layout.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export type SegmentedOption<Value extends string> = {
  value: Value;
  label: string;
  disabled?: boolean;
};

export type SegmentedProps<Value extends string> = {
  /** Two to four. A fifth option is a Select, not a segmented control. */
  options: readonly SegmentedOption<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
  /** Required: the group needs a name a screen reader can announce. */
  label: string;
  size?: "s" | "m";
  fullWidth?: boolean;
  className?: string;
  id?: string;
};

export function Segmented<Value extends string>({
  options,
  value,
  onValueChange,
  label,
  size = "m",
  fullWidth = false,
  className,
  id,
}: SegmentedProps<Value>) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const count = options.length;
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const height = size === "s" ? "var(--cap-s-h)" : "var(--cap-m-h)";
  const labelStep = size === "s" ? "var(--cap-xs-label)" : "var(--cap-s-label)";

  const [pill, setPill] = React.useState<{ left: number; width: number } | null>(null);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    const selected = refs.current[index];
    if (!container || !selected) return;

    function measure() {
      const containerLeft = container!.getBoundingClientRect().left;
      const rect = selected!.getBoundingClientRect();
      setPill({ left: rect.left - containerLeft, width: rect.width });
    }

    measure();

    // A label's rendered width isn't known until layout — a font swap or a
    // container resize (sidebar collapse, viewport change) can change it
    // without `index` changing, so the pill re-measures rather than assuming
    // its last position still fits.
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    for (const node of refs.current) if (node) observer.observe(node);
    return () => observer.disconnect();
  }, [index, count, options]);

  function move(delta: number) {
    for (let step = 1; step <= count; step++) {
      const next = (index + delta * step + count * step) % count;
      const option = options[next];
      if (!option.disabled) {
        onValueChange(option.value);
        refs.current[next]?.focus();
        return;
      }
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Home":
        event.preventDefault();
        onValueChange(options[0].value);
        refs.current[0]?.focus();
        break;
      case "End":
        event.preventDefault();
        onValueChange(options[count - 1].value);
        refs.current[count - 1]?.focus();
        break;
      default:
        break;
    }
  }

  return (
    <div
      id={id}
      ref={containerRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("relative inline-flex items-center", fullWidth && "w-full", className)}
      style={{
        height,
        padding: "var(--space-1)",
        borderRadius: "var(--radius-capsule)",
        background: "var(--fill-quiet)",
        border: "1px solid var(--stroke-hairline)",
      }}
    >
      {/* The selection itself — one element, translated, never re-drawn.
          Measured off the selected button's own bounds (see the effect
          above), never assumed to be 1/n of the track. */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "var(--space-1)",
          bottom: "var(--space-1)",
          left: pill ? `${pill.left}px` : "var(--space-1)",
          width: pill ? `${pill.width}px` : `calc((100% - var(--space-2)) / ${count})`,
          borderRadius: "var(--radius-capsule)",
          background: "var(--surface-raised)",
          border: "1px solid var(--stroke-rim)",
          boxShadow: "var(--e1)",
          opacity: pill ? 1 : 0,
          transition:
            "left var(--dur-glide) var(--ease-glide), width var(--dur-glide) var(--ease-glide), opacity var(--dur-glide) var(--ease-glide)",
        }}
      />

      {options.map((option, optionIndex) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[optionIndex] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => !option.disabled && onValueChange(option.value)}
            className="relative"
            style={{
              // Sized to its own label — "Today" and "7d" are never equal
              // width. The pill above tracks whatever width this resolves
              // to; it never assumes a 1/n share.
              flex: fullWidth ? "1 1 0" : "0 0 auto",
              height: "100%",
              paddingInline: "var(--space-4)",
              borderRadius: "var(--radius-capsule)",
              background: "transparent",
              border: 0,
              fontFamily: "var(--font-text)",
              fontSize: labelStep,
              fontWeight: selected ? 600 : 400,
              letterSpacing: "var(--tr-subhead)",
              color: selected ? "var(--content-primary)" : "var(--content-secondary)",
              cursor: option.disabled ? "not-allowed" : "pointer",
              opacity: option.disabled ? 0.4 : 1,
              transition: "color var(--dur-glide) var(--ease-glide)",
              whiteSpace: "nowrap",
            }}
          >
            {/* Below 44pt the pixels shrink but the target does not. */}
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
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
