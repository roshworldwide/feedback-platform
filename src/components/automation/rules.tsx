"use client";

/**
 * Rules, read as sentences.
 *
 * "If a campaign has no external open after 3 days, notify the campaign
 * owner." A rule a person can read aloud is a rule a person can argue with;
 * three columns of trigger, threshold and action is a rule nobody checks.
 */

import * as React from "react";
import { Bell } from "lucide-react";
import { EmptyState, Switch } from "@/components/ui";
import { ruleSentence, type ActionState } from "./vocabulary";

export type RuleRow = {
  id: string;
  name: string;
  trigger: string;
  threshold: number;
  action: string;
  isActive: boolean;
};

export type SetRuleActive = (id: string, active: boolean) => Promise<ActionState>;

function Rule({ row, onToggle }: { row: RuleRow; onToggle: SetRuleActive }) {
  const [checked, setChecked] = React.useState(row.isActive);
  const [serverValue, setServerValue] = React.useState(row.isActive);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const sentence = ruleSentence(row);

  // Adjusted during render, not in an effect: the server is the source of
  // truth and the switch must never sit one frame behind it.
  if (serverValue !== row.isActive) {
    setServerValue(row.isActive);
    setChecked(row.isActive);
  }

  const strong = { color: "var(--content-primary)", fontWeight: 600 };

  return (
    <li
      className="flex flex-wrap items-center"
      style={{
        gap: "var(--space-4)",
        padding: "var(--space-4)",
        borderRadius: "calc(var(--radius-lg) - var(--space-3))",
        background: "var(--fill-quiet)",
        border: "1px solid var(--stroke-hairline)",
        opacity: checked ? 1 : 0.7,
      }}
    >
      <div style={{ flex: "1 1 320px", minWidth: 0 }}>
        <p
          className="t-body prose-measure"
          style={{ margin: 0, color: "var(--content-secondary)" }}
        >
          {sentence.leadIn} <strong style={strong}>{sentence.threshold}</strong>
          {sentence.middle} <strong style={strong}>{sentence.action}</strong>
          {sentence.tail}
        </p>
        <p className="t-caption" style={{ margin: "var(--space-1) 0 0", color: "var(--content-tertiary)" }}>
          {row.name}
          {checked ? "" : " · paused"}
        </p>
        {message ? (
          <p role="status" className="t-caption" style={{ margin: "var(--space-1) 0 0", color: "var(--signal-abort)" }}>
            {message}
          </p>
        ) : null}
      </div>

      <Switch
        checked={checked}
        disabled={pending}
        label={`${checked ? "Pause" : "Resume"} the rule ${row.name}`}
        onCheckedChange={(next) => {
          setChecked(next);
          setMessage(null);
          startTransition(async () => {
            const result = await onToggle(row.id, next);
            if (!result.ok) {
              setChecked(!next);
              setMessage(result.message);
            }
          });
        }}
      />
    </li>
  );
}

export type RuleListProps = {
  rows: RuleRow[];
  setActive: SetRuleActive;
};

export function RuleList({ rows, setActive }: RuleListProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No rules are set"
        description="Nothing is watching for silence or for a low rating yet. A rule is one sentence: a condition, a threshold and who to tell."
      />
    );
  }

  return (
    <ul
      className="flex flex-col"
      style={{ gap: "var(--space-3)", margin: 0, padding: 0, listStyle: "none" }}
    >
      {rows.map((row) => (
        <Rule key={row.id} row={row} onToggle={setActive} />
      ))}
    </ul>
  );
}
