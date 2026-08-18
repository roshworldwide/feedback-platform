/**
 * The skeleton draws the flow in its final layout — the rail on the left with
 * its five steps, the panel on the right — so the shape of the work is legible
 * before the draft arrives.
 */

import { Skeleton } from "@/components/ui";

export default function ComposeDraftLoading() {
  return (
    <div
      className="flex flex-col"
      style={{ gap: "var(--space-6)" }}
      role="status"
      aria-label="Loading this draft"
    >
      <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
        <Skeleton height="var(--cap-s-h)" width="120px" shape="capsule" />
        <Skeleton height="var(--cap-m-h)" width="min(420px, 100%)" shape="sm" />
      </div>

      <div className="flex flex-wrap items-start" style={{ gap: "var(--space-6)" }}>
        <div
          className="flex flex-col"
          style={{
            flex: "1 1 240px",
            maxWidth: "296px",
            gap: "var(--space-3)",
            padding: "var(--space-4)",
            background: "var(--surface-raised)",
            border: "1px solid var(--stroke-rim)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--e1)",
          }}
        >
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} height="var(--space-8)" shape="sm" />
          ))}
        </div>

        <div
          className="flex flex-col"
          style={{ flex: "999 1 560px", gap: "var(--space-5)", minWidth: 0 }}
        >
          <Skeleton height="var(--space-8)" width="200px" />
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="flex flex-col"
              style={{
                gap: "var(--space-4)",
                padding: "var(--space-5)",
                background: "var(--surface-raised)",
                border: "1px solid var(--stroke-rim)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--e1)",
              }}
            >
              <Skeleton height="var(--space-6)" width="180px" />
              <Skeleton height="var(--cap-m-h)" shape="sm" />
              <Skeleton height="var(--cap-m-h)" shape="sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
