"use client";

/**
 * Names the state, the cause and the next action. Two ways out: run the read
 * again, or step back to the list — never a dead end.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, RotateCw } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function CampaignDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Campaign detail failed to render", error);
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
          Couldn&rsquo;t load this campaign
        </h1>
        <p
          className="t-subhead prose-measure"
          style={{
            margin: "var(--space-2) 0 0",
            color: "var(--content-secondary)",
          }}
        >
          {error.message ||
            "The campaign, its recipients or its activity did not come back from the database."}
        </p>
        <p
          className="t-footnote prose-measure"
          style={{
            margin: "var(--space-2) 0 0",
            color: "var(--content-tertiary)",
          }}
        >
          Nothing about this report was changed.
          {error.digest ? ` Reference ${error.digest}.` : ""}
        </p>
      </div>

      <div className="flex flex-wrap" style={{ gap: "var(--space-3)" }}>
        <Button variant="tinted" leadingIcon={RotateCw} onClick={reset}>
          Try again
        </Button>
        <Button as={Link} href="/campaigns" variant="plain" leadingIcon={ArrowLeft}>
          Back to campaigns
        </Button>
      </div>
    </Card>
  );
}
