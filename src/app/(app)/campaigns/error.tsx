"use client";

/**
 * An error names the state, the cause and the next action — and never blames
 * the reader. The filter set lives in the URL, so retrying re-runs exactly the
 * query that failed with everything the user chose still in place.
 */

import * as React from "react";
import { RotateCw } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function CampaignsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Campaigns screen failed to render", error);
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
          Couldn&rsquo;t load campaigns
        </h1>
        <p
          className="t-subhead prose-measure"
          style={{
            margin: "var(--space-2) 0 0",
            color: "var(--content-secondary)",
          }}
        >
          {error.message ||
            "The campaign list did not come back from the database."}
        </p>
        <p
          className="t-footnote prose-measure"
          style={{
            margin: "var(--space-2) 0 0",
            color: "var(--content-tertiary)",
          }}
        >
          Your filters are still in the address bar, so trying again runs the
          same query. Nothing was changed.
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
