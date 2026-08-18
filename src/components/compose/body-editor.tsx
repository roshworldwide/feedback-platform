"use client";

/**
 * The body.
 *
 * Markdown, deliberately small: the renderer accepts headings, lists, quotes,
 * links, bold, italic, code and rules and nothing else, because a report body
 * is prose and an analyst pasting a chart's tooltip must not be able to author
 * HTML inside a client's inbox.
 *
 * The three variables are shown as chips rather than left as raw braces. Each
 * chip inserts at the cursor; each chip already in use carries a × that removes
 * every occurrence of it, so a variable can be taken back out without hunting
 * through the prose for the second one you forgot.
 */

import * as React from "react";
import { Plus, X } from "lucide-react";
import { TextArea } from "@/components/ui";
import {
  COMPOSE_VARIABLES,
  removeVariable,
  usedVariables,
  variableChip,
  type ComposeVariable,
} from "./vocabulary";

export type BodyEditorProps = {
  value: string;
  onChange: (value: string) => void;
  id: string;
  describedBy?: string;
  disabled?: boolean;
};

export function BodyEditor({
  value,
  onChange,
  id,
  describedBy,
  disabled = false,
}: BodyEditorProps) {
  const ref = React.useRef<HTMLTextAreaElement | null>(null);
  const used = React.useMemo(() => [...new Set(usedVariables(value))], [value]);

  function insert(token: ComposeVariable) {
    const chip = variableChip(token);
    const node = ref.current;
    if (!node) {
      onChange(value + chip);
      return;
    }
    const start = node.selectionStart ?? value.length;
    const end = node.selectionEnd ?? start;
    const next = `${value.slice(0, start)}${chip}${value.slice(end)}`;
    onChange(next);
    // The caret lands after the chip on the next frame, once React has
    // repainted the value — otherwise it snaps back to the end.
    requestAnimationFrame(() => {
      node.focus();
      const caret = start + chip.length;
      node.setSelectionRange(caret, caret);
    });
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
      <TextArea
        ref={ref}
        id={id}
        value={value}
        rows={14}
        disabled={disabled}
        aria-describedby={describedBy}
        placeholder={
          "Hi {{contact_first_name}},\n\n" +
          "## What changed this month\n\n" +
          "- Resolution time fell to 4.2 hours\n" +
          "- CSAT held at 4.6 across 1,240 conversations\n\n" +
          "> The full breakdown by queue is in the report."
        }
        onChange={(event) => onChange(event.currentTarget.value)}
        style={{ fontFamily: "var(--font-mono)", fontSize: "14px", lineHeight: "22px" }}
      />

      <div className="flex flex-wrap items-center" style={{ gap: "var(--space-2)" }}>
        <span
          className="t-caption"
          id={`${id}-variables`}
          style={{ color: "var(--content-tertiary)" }}
        >
          Insert:
        </span>

        {COMPOSE_VARIABLES.map((variable) => {
          const inUse = used.includes(variable.token);
          return (
            <span
              key={variable.token}
              className="inline-flex items-center"
              style={{
                gap: "var(--space-1)",
                height: "28px",
                paddingLeft: "var(--space-3)",
                paddingRight: inUse ? "var(--space-1)" : "var(--space-3)",
                borderRadius: "var(--radius-capsule)",
                background: inUse ? "var(--fill-quiet)" : "transparent",
                border: `1px solid ${
                  inUse ? "var(--stroke-rim)" : "var(--stroke-hairline)"
                }`,
              }}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => insert(variable.token)}
                aria-label={`Insert ${variable.label} at the cursor`}
                className="t-micro relative inline-flex items-center"
                style={{
                  gap: "var(--space-1)",
                  minHeight: "28px",
                  background: "transparent",
                  border: 0,
                  padding: 0,
                  color: inUse ? "var(--content-primary)" : "var(--content-accent)",
                  fontWeight: 600,
                  cursor: disabled ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
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
                {inUse ? null : <Plus size={11} strokeWidth={2.25} aria-hidden="true" />}
                {variable.label}
              </button>

              {inUse ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(removeVariable(value, variable.token))}
                  aria-label={`Remove every ${variable.label} from the body`}
                  className="relative"
                  style={{
                    width: "22px",
                    height: "22px",
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "var(--radius-capsule)",
                    background: "transparent",
                    border: 0,
                    color: "var(--content-tertiary)",
                    cursor: disabled ? "not-allowed" : "pointer",
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
                  <X size={11} strokeWidth={2.25} aria-hidden="true" />
                </button>
              ) : null}
            </span>
          );
        })}
      </div>

      <p className="t-caption" style={{ margin: 0, color: "var(--content-tertiary)" }}>
        A variable the renderer does not know is left visible in the preview
        rather than blanked, so a typo is something you can see and fix.
      </p>
    </div>
  );
}
