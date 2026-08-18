"use client";

/**
 * The Overview boundary.
 *
 * Individual loaders already return a result rather than throwing, so reaching
 * this is a genuine failure of the screen itself. It names the state, states
 * the cause it was given, and offers the one action that can help — it does not
 * blame the reader and it does not show a zero in place of a number.
 */

import { RotateCcw } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function OverviewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card accent="caution" role="alert">
      <div
        className="flex flex-col"
        style={{ gap: "var(--space-3)", padding: "var(--space-6)" }}
      >
        <h2
          className="t-title-3"
          style={{ margin: 0, color: "var(--content-primary)" }}
        >
          Couldn&rsquo;t load the overview
        </h2>
        <p
          className="t-subhead prose-measure"
          style={{ margin: 0, color: "var(--content-secondary)" }}
        >
          {error.message ||
            "The screen stopped before any figure could be read."}{" "}
          Nothing has been shown in place of the missing numbers.
        </p>
        {error.digest ? (
          <p
            className="t-caption tabular"
            style={{ margin: 0, color: "var(--content-tertiary)" }}
          >
            Reference {error.digest} — quote this to an admin.
          </p>
        ) : null}
        <div style={{ marginTop: "var(--space-2)" }}>
          <Button variant="tinted" leadingIcon={RotateCcw} onClick={reset}>
            Try again
          </Button>
        </div>
      </div>
    </Card>
  );
}
