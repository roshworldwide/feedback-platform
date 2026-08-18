"use client";

/**
 * A failed render of the flow loses nothing: the draft is a row, saved at every
 * step change. The step is in the address bar, so retrying returns to the same
 * panel with the same document.
 */

import * as React from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function ComposeDraftError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Compose flow failed to render", error);
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
          Couldn&rsquo;t open this draft
        </h1>
        <p
          className="t-subhead prose-measure"
          style={{ margin: "var(--space-2) 0 0", color: "var(--content-secondary)" }}
        >
          {error.message || "The draft did not come back from the database."}
        </p>
        <p
          className="t-footnote prose-measure"
          style={{ margin: "var(--space-2) 0 0", color: "var(--content-tertiary)" }}
        >
          The draft is saved at every step change, so nothing written earlier was
          lost, and no campaign was created. The step you were on is still in the
          address bar.
          {error.digest ? ` Reference ${error.digest}.` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center" style={{ gap: "var(--space-3)" }}>
        <Button variant="tinted" leadingIcon={RotateCw} onClick={reset}>
          Try again
        </Button>
        <Button as={Link} href="/compose" variant="plain">
          All drafts
        </Button>
      </div>
    </Card>
  );
}
