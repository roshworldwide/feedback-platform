"use client";

import * as React from "react";
import { RotateCw } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function AuditsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error("Audits screen failed to render", error);
  }, [error]);

  return (
    <Card accent="abort" role="alert" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", padding: "var(--space-6)" }}>
      <div>
        <h1 className="t-title-3" style={{ margin: 0, color: "var(--content-primary)" }}>
          Couldn&rsquo;t load audits
        </h1>
        <p className="t-subhead prose-measure" style={{ margin: "var(--space-2) 0 0", color: "var(--content-secondary)" }}>
          {error.message || "The list of audit runs did not come back from the database."}
        </p>
        <p className="t-footnote prose-measure" style={{ margin: "var(--space-2) 0 0", color: "var(--content-tertiary)" }}>
          Nothing was changed.{error.digest ? ` Reference ${error.digest}.` : ""}
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
