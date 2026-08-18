"use client";

/**
 * An error names the state, the cause and the next action — and never blames
 * the reader. Drafts are rows in the database, so nothing written earlier is
 * lost by a failed read of the library.
 */

import * as React from "react";
import { RotateCw } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function ComposeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Compose library failed to render", error);
  }, [error]);

  return (
    <Card
      accent="abort"
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        padding: "var(--space-6)",
      }}
    >
      <div>
        <h1 className="t-title-3" style={{ margin: 0, color: "var(--content-primary)" }}>
          Couldn&rsquo;t load your drafts
        </h1>
        <p
          className="t-subhead prose-measure"
          style={{ margin: "var(--space-2) 0 0", color: "var(--content-secondary)" }}
        >
          {error.message || "The draft library did not come back from the database."}
        </p>
        <p
          className="t-footnote prose-measure"
          style={{ margin: "var(--space-2) 0 0", color: "var(--content-tertiary)" }}
        >
          Every draft is a row in the database, so nothing you wrote earlier was
          lost. Trying again runs the same read.
          {error.digest ? ` Reference ${error.digest}.` : ""}
        </p>
      </div>

      <div>
        <Button variant="tinted" leadingIcon={RotateCw} onClick={reset}>
          Try again
        </Button>
      </div>
    </Card>
  );
}
