"use client";

/**
 * The state, the cause, the next action — and no number anywhere, because a
 * count that could not be taken is not zero.
 */

import * as React from "react";
import { RotateCw } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function ClientsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Clients screen failed to render", error);
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
        <h1
          className="t-title-3"
          style={{ margin: 0, color: "var(--content-primary)" }}
        >
          Couldn&rsquo;t load clients
        </h1>
        <p
          className="t-subhead prose-measure"
          style={{
            margin: "var(--space-2) 0 0",
            color: "var(--content-secondary)",
          }}
        >
          {error.message ||
            "The client list and its counts did not come back from the database."}
        </p>
        <p
          className="t-footnote prose-measure"
          style={{
            margin: "var(--space-2) 0 0",
            color: "var(--content-tertiary)",
          }}
        >
          No count is shown rather than a zero, and nothing was changed. Your
          filters are still in the address bar.
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
