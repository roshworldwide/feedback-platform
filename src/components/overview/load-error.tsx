/**
 * The "Couldn't load" panel.
 *
 * Every loader in this application returns a result rather than throwing, and
 * every screen renders the failure explicitly. A panel that cannot read its
 * data says so, names the reason it was given and states the next action — it
 * never falls back to zero, because a fabricated zero is indistinguishable
 * from a real one. That is precisely how v1's dashboard came to report an
 * at-risk count of nought for eleven months.
 *
 * Shared by Overview, Feedback, Automation and Settings so the failure reads
 * the same everywhere.
 */

import { TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui";

export type LoadErrorProps = {
  /** Named as the thing the reader expected to see — "the period totals". */
  what: string;
  /** The reason, exactly as the loader gave it. Never paraphrased upward. */
  message: string;
  /** The next action. Sentence case, a verb the user would say aloud. */
  next?: string;
  className?: string;
};

export function LoadError({
  what,
  message,
  next = "Reload the page. If it keeps failing, tell an admin what this panel says.",
  className,
}: LoadErrorProps) {
  return (
    <Card accent="caution" className={className} role="status">
      <div
        className="flex"
        style={{ gap: "var(--space-3)", padding: "var(--space-5)" }}
      >
        <TriangleAlert
          size={18}
          strokeWidth={1.75}
          aria-hidden="true"
          style={{ flex: "none", color: "var(--signal-caution)", marginTop: "2px" }}
        />
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
            {message}
          </p>
          <p
            className="t-caption prose-measure"
            style={{
              margin: "var(--space-2) 0 0",
              color: "var(--content-tertiary)",
            }}
          >
            {next}
          </p>
        </div>
      </div>
    </Card>
  );
}
