/**
 * The skeleton draws the destination — the search bar, then the grid of draft
 * cards in their final proportions — so the wait is spent orienting rather
 * than doubting. No spinner stands where a count will be.
 */

import { Skeleton } from "@/components/ui";

export default function ComposeLoading() {
  return (
    <div
      className="flex flex-col"
      style={{ gap: "var(--space-6)" }}
      role="status"
      aria-label="Loading your drafts"
    >
      <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <Skeleton height="var(--space-8)" width="180px" />
        <Skeleton height="var(--space-4)" width="360px" />
      </div>

      <div
        className="flex flex-wrap items-end justify-between"
        style={{ gap: "var(--space-4)" }}
      >
        <Skeleton height="var(--cap-m-h)" width="min(420px, 100%)" shape="capsule" />
        <Skeleton height="var(--cap-m-h)" width="148px" shape="capsule" />
      </div>

      <div
        className="grid"
        style={{
          gap: "var(--space-4)",
          gridTemplateColumns: "repeat(auto-fill, minmax(288px, 1fr))",
        }}
      >
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="flex flex-col"
            style={{
              gap: "var(--space-3)",
              padding: "var(--space-2)",
              background: "var(--surface-raised)",
              border: "1px solid var(--stroke-rim)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--e1)",
            }}
          >
            <Skeleton height="168px" shape="sm" />
            <div
              className="flex flex-col"
              style={{ gap: "var(--space-2)", padding: "0 var(--space-3) var(--space-3)" }}
            >
              <Skeleton height="var(--space-5)" width="70%" />
              <Skeleton height="var(--space-4)" width="52%" />
              <Skeleton height="var(--space-3)" width="40%" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
