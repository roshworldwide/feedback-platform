"use client";

/**
 * "Generate summary" — the AI Feedback Summary.
 *
 * Disabled with a one-line explanation when no key is configured, never a
 * button that fails when pressed. A provider error is always a plain
 * sentence from the server, never the raw exception v1 rendered.
 */

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui";

export type AiSummaryPanelProps = {
  aiAvailable: boolean;
  period: { from: string; to: string };
  excludeInternal: boolean;
  excludeTests: boolean;
};

export function AiSummaryPanel({
  aiAvailable,
  period,
  excludeInternal,
  excludeTests,
}: AiSummaryPanelProps) {
  const [state, setState] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  async function generate() {
    if (state === "loading") return;
    setState("loading");
    setError(null);
    setText("");

    try {
      const response = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: period.from,
          to: period.to,
          excludeInternal,
          excludeTests,
        }),
      });

      if (!response.ok || !response.body) {
        const message = await response.text();
        setError(message || "The AI service did not respond. Try again.");
        setState("error");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setText(accumulated);
      }
      setState("done");
    } catch {
      setError("Could not reach the AI service. Check your connection and try again.");
      setState("error");
    }
  }

  if (!aiAvailable) {
    return (
      <p className="t-footnote" style={{ margin: 0, color: "var(--content-tertiary)" }}>
        AI summaries are off — no API key is configured.
      </p>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
      <Button
        variant="glass"
        size="m"
        leadingIcon={Sparkles}
        loading={state === "loading"}
        onClick={() => void generate()}
      >
        {state === "done" ? "Regenerate summary" : "Generate summary"}
      </Button>

      {state === "error" && error ? (
        <p role="alert" className="t-footnote" style={{ margin: 0, color: "var(--signal-abort)" }}>
          {error}
        </p>
      ) : null}

      {text ? (
        <div
          style={{
            padding: "var(--space-4)",
            borderRadius: "var(--radius-lg)",
            background: "var(--surface-raised)",
            border: "1px solid var(--stroke-hairline)",
          }}
        >
          <pre
            className="t-subhead"
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "inherit",
              color: "var(--content-primary)",
            }}
          >
            {text}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
