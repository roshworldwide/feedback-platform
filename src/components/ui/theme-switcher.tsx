"use client";

/**
 * Finish controls.
 *
 * `DarkModeToggle` swaps the light/dark default pair. `FinishPicker` offers all
 * five. Each swatch carries its own `data-finish`, so the token layer inside it
 * resolves to that finish — the preview is the real thing, not a painting of it.
 *
 * A finish change is a 320 ms cross-fade of the token layer only. Nothing in
 * this file changes a single dimension.
 */

import * as React from "react";
import { Check, Moon, Sun } from "lucide-react";
import { FINISHES, FINISH_META, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export type DarkModeToggleProps = {
  className?: string;
};

export function DarkModeToggle({ className }: DarkModeToggleProps) {
  const { mode, toggleMode } = useTheme();
  const dark = mode === "dark";

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-pressed={dark}
      aria-label={dark ? "Switch to the light finish" : "Switch to the dark finish"}
      title={dark ? "Switch to the light finish" : "Switch to the dark finish"}
      className={cn("relative inline-grid place-items-center", className)}
      style={{
        width: "var(--cap-m-h)",
        height: "var(--cap-m-h)",
        borderRadius: "var(--radius-capsule)",
        background: "var(--fill-quiet)",
        border: "1px solid var(--stroke-hairline)",
        color: "var(--content-primary)",
        cursor: "pointer",
        overflow: "hidden",
      }}
    >
      {/* Both marks are always present; only one is at rest. */}
      <Sun
        size={18}
        strokeWidth={1.75}
        aria-hidden="true"
        style={{
          gridArea: "1 / 1",
          opacity: dark ? 0 : 1,
          transform: dark ? "rotate(-90deg) scale(0.6)" : "rotate(0deg) scale(1)",
          transition:
            "opacity var(--dur-snap) var(--ease-snap), transform var(--dur-snap) var(--ease-snap)",
        }}
      />
      <Moon
        size={18}
        strokeWidth={1.75}
        aria-hidden="true"
        style={{
          gridArea: "1 / 1",
          opacity: dark ? 1 : 0,
          transform: dark ? "rotate(0deg) scale(1)" : "rotate(90deg) scale(0.6)",
          transition:
            "opacity var(--dur-snap) var(--ease-snap), transform var(--dur-snap) var(--ease-snap)",
        }}
      />
    </button>
  );
}

export type FinishPickerProps = {
  className?: string;
  /** Names the group for a screen reader. */
  label?: string;
};

export function FinishPicker({
  className,
  label = "Finish",
}: FinishPickerProps) {
  const { finish, setFinish } = useTheme();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const index = FINISHES.indexOf(finish);

  function focusAt(next: number) {
    const wrapped = (next + FINISHES.length) % FINISHES.length;
    setFinish(FINISHES[wrapped]);
    refs.current[wrapped]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusAt(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(FINISHES.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("grid", className)}
      style={{
        gap: "var(--space-3)",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
      }}
    >
      {FINISHES.map((value, position) => {
        const meta = FINISH_META[value];
        const selected = value === finish;
        return (
          <button
            key={value}
            ref={(node) => {
              refs.current[position] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => setFinish(value)}
            className="flex text-left"
            style={{
              gap: "var(--space-3)",
              alignItems: "center",
              minHeight: "44px",
              padding: "var(--space-3)",
              background: "var(--surface-raised)",
              // Concentric: the swatch inside takes this radius minus the gap.
              borderRadius: "var(--radius-lg)",
              border: `1px solid ${
                selected ? "var(--content-accent)" : "var(--stroke-rim)"
              }`,
              boxShadow: selected ? "var(--e2)" : "var(--e1)",
              color: "var(--content-primary)",
              cursor: "pointer",
              transition:
                "box-shadow var(--dur-glide) var(--ease-glide), border-color var(--dur-glide) var(--ease-glide)",
            }}
          >
            {/* The swatch scopes the token layer to the finish it advertises. */}
            <span
              data-finish={value}
              aria-hidden="true"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                alignItems: "stretch",
                width: "56px",
                height: "40px",
                flex: "none",
                overflow: "hidden",
                borderRadius: "calc(var(--radius-lg) - var(--space-3))",
                border: "1px solid var(--stroke-rim)",
                background: "var(--surface-canvas)",
              }}
            >
              <span style={{ background: "var(--surface-canvas)" }} />
              <span style={{ background: "var(--surface-grouped)" }} />
              <span style={{ background: "var(--fill-accent)" }} />
            </span>

            <span style={{ minWidth: 0, display: "block" }}>
              <span
                className="t-subhead"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-1)",
                  fontWeight: 600,
                }}
              >
                {meta.name}
                {selected ? (
                  <Check
                    size={14}
                    strokeWidth={2.25}
                    aria-hidden="true"
                    style={{ color: "var(--content-accent)" }}
                  />
                ) : null}
              </span>
              <span
                className="t-overline"
                style={{ display: "block", color: "var(--content-tertiary)" }}
              >
                {meta.role}
              </span>
              <span
                className="t-caption"
                style={{
                  display: "block",
                  marginTop: "var(--space-1)",
                  color: "var(--content-secondary)",
                }}
              >
                {meta.note}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
