/**
 * "Couldn't load".
 *
 * The query layer returns a result, never a throw and never a zero. When a
 * read fails this is what the screen shows: the state, the cause the database
 * gave, and the next action. It never renders a number, because a fabricated
 * zero is indistinguishable from a real one — that is exactly how v1 came to
 * report an at-risk count of nought.
 */

import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui";

export type CouldntLoadProps = {
  /** What could not be read, in the words the user would use. */
  what: string;
  /** The reason the database gave. Shown verbatim. */
  reason: string;
  /** What to do next. Defaults to reloading. */
  next?: string;
};

export function CouldntLoad({ what, reason, next }: CouldntLoadProps) {
  return (
    <Card
      accent="abort"
      role="alert"
      style={{
        display: "flex",
        gap: "var(--space-4)",
        padding: "var(--space-6)",
        alignItems: "flex-start",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "grid",
          placeItems: "center",
          width: "var(--space-8)",
          height: "var(--space-8)",
          flex: "none",
          borderRadius: "var(--radius-capsule)",
          background: "var(--fill-quiet)",
          color: "var(--signal-abort)",
        }}
      >
        <AlertTriangle size={18} strokeWidth={1.75} />
      </span>

      <div style={{ minWidth: 0 }}>
        <p
          className="t-headline"
          style={{ margin: 0, color: "var(--content-primary)" }}
        >
          Couldn&rsquo;t load {what}
        </p>
        <p
          className="t-subhead prose-measure"
          style={{
            margin: "var(--space-2) 0 0",
            color: "var(--content-secondary)",
          }}
        >
          {reason}
        </p>
        <p
          className="t-footnote prose-measure"
          style={{
            margin: "var(--space-2) 0 0",
            color: "var(--content-tertiary)",
          }}
        >
          {next ?? "Nothing was changed. Reload the page to try the read again."}
        </p>
      </div>
    </Card>
  );
}

/** A quieter form for a panel inside a screen that otherwise loaded. */
export function CouldntLoadInline({ what, reason }: CouldntLoadProps) {
  return (
    <p
      role="alert"
      className="t-footnote prose-measure"
      style={{ margin: 0, color: "var(--signal-abort)" }}
    >
      Couldn&rsquo;t load {what} — {reason}
    </p>
  );
}
