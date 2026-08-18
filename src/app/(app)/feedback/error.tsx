"use client";

/**
 * The Feedback boundary. Names the state, states the cause it was given, and
 * offers the one action that can help. No rating is invented in its place.
 */

import { RotateCcw } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function FeedbackError({
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
        <h2 className="t-title-3" style={{ margin: 0, color: "var(--content-primary)" }}>
          Couldn&rsquo;t load the feedback inbox
        </h2>
        <p
          className="t-subhead prose-measure"
          style={{ margin: 0, color: "var(--content-secondary)" }}
        >
          {error.message || "The inbox stopped before any rating could be read."}{" "}
          Your filters are still in the address bar, so nothing you chose has
          been lost.
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
