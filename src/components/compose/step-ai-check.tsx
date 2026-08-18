"use client";

/**
 * AI Check.
 *
 * Polishes the body for tone, spacing and structure and shows the result as
 * a line diff — nothing is applied automatically. Every number in the body
 * is guaranteed unchanged: the server rejects any revision that adds,
 * drops or edits a figure, so a diff never even reaches this screen with a
 * fabricated number in it.
 */

import * as React from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { Button, Card, CardBody, EmptyState } from "@/components/ui";
import type { ComposeDoc } from "./vocabulary";

export type StepAiCheckProps = {
  doc: ComposeDoc;
  patch: (change: Partial<ComposeDoc>) => void;
  aiCheckAvailable: boolean;
};

type LineOp = { type: "equal" | "remove" | "add"; line: string };

function diffLines(a: string[], b: string[]): LineOp[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: LineOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "equal", line: a[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "remove", line: a[i] });
      i += 1;
    } else {
      ops.push({ type: "add", line: b[j] });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ type: "remove", line: a[i] });
    i += 1;
  }
  while (j < m) {
    ops.push({ type: "add", line: b[j] });
    j += 1;
  }
  return ops;
}

type Hunk = { id: number; removed: string[]; added: string[] };
type Block = { type: "context"; lines: string[] } | { type: "hunk"; hunk: Hunk };

function blocksOf(ops: LineOp[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  let hunkId = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.type === "equal") {
      const lines: string[] = [];
      while (i < ops.length && ops[i].type === "equal") {
        lines.push(ops[i].line);
        i += 1;
      }
      blocks.push({ type: "context", lines });
    } else {
      const removed: string[] = [];
      const added: string[] = [];
      while (i < ops.length && ops[i].type !== "equal") {
        if (ops[i].type === "remove") removed.push(ops[i].line);
        else added.push(ops[i].line);
        i += 1;
      }
      blocks.push({ type: "hunk", hunk: { id: hunkId, removed, added } });
      hunkId += 1;
    }
  }
  return blocks;
}

function applyDecisions(blocks: Block[], accepted: Set<number>): string {
  const out: string[] = [];
  for (const block of blocks) {
    if (block.type === "context") {
      out.push(...block.lines);
    } else {
      out.push(...(accepted.has(block.hunk.id) ? block.hunk.added : block.hunk.removed));
    }
  }
  return out.join("\n");
}

function hunksOf(blocks: Block[]): Hunk[] {
  return blocks
    .filter((block): block is Extract<Block, { type: "hunk" }> => block.type === "hunk")
    .map((block) => block.hunk);
}

export function StepAiCheck({ doc, patch, aiCheckAvailable }: StepAiCheckProps) {
  const [state, setState] = React.useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [blocks, setBlocks] = React.useState<Block[]>([]);
  const [accepted, setAccepted] = React.useState<Set<number>>(new Set());

  async function run() {
    if (doc.bodyMd.trim() === "") {
      setError("There is no body text to check yet. Write something on the Content step first.");
      setState("error");
      return;
    }
    setState("loading");
    setError(null);
    try {
      const response = await fetch("/api/ai/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: doc.bodyMd }),
      });
      const result = await response.json();
      if (!result.ok) {
        setError(result.message);
        setState("error");
        return;
      }
      const ops = diffLines(String(result.original).split("\n"), String(result.revised).split("\n"));
      const nextBlocks = blocksOf(ops);
      setBlocks(nextBlocks);
      setAccepted(new Set());
      setState(hunksOf(nextBlocks).length === 0 ? "idle" : "ready");
      if (hunksOf(nextBlocks).length === 0) {
        setError("The AI check found nothing to change.");
      }
    } catch {
      setError("Could not reach the AI service. Check your connection and try again.");
      setState("error");
    }
  }

  function toggle(id: number) {
    setAccepted((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function apply() {
    patch({ bodyMd: applyDecisions(blocks, accepted) });
    setBlocks([]);
    setAccepted(new Set());
    setState("idle");
  }

  function discard() {
    setBlocks([]);
    setAccepted(new Set());
    setState("idle");
  }

  if (!aiCheckAvailable) {
    return (
      <Card elevation="e1">
        <CardBody>
          <p className="t-subhead" style={{ margin: 0, color: "var(--content-secondary)" }}>
            AI Check is off — no API key is configured. This step is optional; skip ahead to
            Recipients whenever you are ready.
          </p>
        </CardBody>
      </Card>
    );
  }

  const hunks = hunksOf(blocks);

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      <Card elevation="e1">
        <CardBody>
          <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
            <p className="t-subhead" style={{ margin: 0, color: "var(--content-secondary)" }}>
              Polishes tone, spacing and structure in the report body. Every number is checked
              and guaranteed unchanged — nothing is applied until you accept it below. This step
              is optional.
            </p>
            <Button
              variant="glass"
              leadingIcon={Sparkles}
              loading={state === "loading"}
              onClick={() => void run()}
              style={{ alignSelf: "flex-start" }}
            >
              Check with AI
            </Button>
            {state === "error" && error ? (
              <p role="alert" className="t-footnote" style={{ margin: 0, color: "var(--signal-abort)" }}>
                {error}
              </p>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {state === "ready" && hunks.length > 0 ? (
        <Card elevation="e1">
          <CardBody>
            <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
              <div className="flex flex-wrap items-center justify-between" style={{ gap: "var(--space-3)" }}>
                <p className="t-headline" style={{ margin: 0 }}>
                  {hunks.length} {hunks.length === 1 ? "change" : "changes"} suggested
                </p>
                <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                  <Button variant="plain" size="s" onClick={() => setAccepted(new Set(hunks.map((h) => h.id)))}>
                    Accept all
                  </Button>
                  <Button variant="plain" size="s" onClick={() => setAccepted(new Set())}>
                    Reject all
                  </Button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {blocks.map((block, index) =>
                  block.type === "context" ? (
                    block.lines.length > 0 ? (
                      <p
                        key={`ctx-${index}`}
                        className="t-footnote tabular"
                        style={{
                          margin: 0,
                          whiteSpace: "pre-wrap",
                          color: "var(--content-tertiary)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {block.lines.join("\n")}
                      </p>
                    ) : null
                  ) : (
                    <div
                      key={`hunk-${block.hunk.id}`}
                      style={{
                        border: "1px solid var(--stroke-hairline)",
                        borderRadius: "var(--radius-md)",
                        padding: "var(--space-3)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-2)",
                      }}
                    >
                      {block.hunk.removed.map((line, i) => (
                        <p
                          key={`rm-${i}`}
                          className="t-footnote"
                          style={{
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            textDecoration: accepted.has(block.hunk.id) ? "line-through" : "none",
                            color: accepted.has(block.hunk.id)
                              ? "var(--content-tertiary)"
                              : "var(--signal-abort)",
                            background: accepted.has(block.hunk.id)
                              ? "transparent"
                              : "color-mix(in oklab, var(--signal-abort) 10%, transparent)",
                          }}
                        >
                          − {line || " "}
                        </p>
                      ))}
                      {block.hunk.added.map((line, i) => (
                        <p
                          key={`add-${i}`}
                          className="t-footnote"
                          style={{
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            color: accepted.has(block.hunk.id)
                              ? "var(--signal-nominal)"
                              : "var(--content-tertiary)",
                            background: accepted.has(block.hunk.id)
                              ? "color-mix(in oklab, var(--signal-nominal) 10%, transparent)"
                              : "transparent",
                            textDecoration: accepted.has(block.hunk.id) ? "none" : "line-through",
                          }}
                        >
                          + {line || " "}
                        </p>
                      ))}
                      <Button
                        variant={accepted.has(block.hunk.id) ? "solid" : "glass"}
                        size="s"
                        onClick={() => toggle(block.hunk.id)}
                        style={{ alignSelf: "flex-start" }}
                      >
                        {accepted.has(block.hunk.id) ? "Accepted — use AI version" : "Keep original"}
                      </Button>
                    </div>
                  ),
                )}
              </div>

              <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
                <Button variant="solid" onClick={apply}>
                  Apply changes
                </Button>
                <Button variant="glass" onClick={discard}>
                  Discard
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {state === "idle" && blocks.length === 0 && !error ? (
        <EmptyState
          icon={ChevronDown}
          title="No check run yet"
          description="Press Check with AI to see suggested changes to the report body."
        />
      ) : null}
    </div>
  );
}
