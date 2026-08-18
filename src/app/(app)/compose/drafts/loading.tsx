/**
 * The skeleton draws the destination — search, the filter, then rows at their
 * final compact height — so the wait is spent orienting rather than doubting.
 * No spinner stands where a count will be.
 */

import { Skeleton } from "@/components/ui";

export default function ComposeDraftsLoading() {
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
        <Skeleton height="var(--cap-m-h)" width="220px" shape="capsule" />
      </div>

      <div
        className="flex flex-col"
        style={{
          border: "1px solid var(--stroke-rim)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        {Array.from({ length: 10 }, (_, index) => (
          <div
            key={index}
            className="flex items-center"
            style={{
              gap: "var(--space-4)",
              height: "56px",
              padding: "0 var(--space-4)",
              borderTop: index === 0 ? "none" : "1px solid var(--stroke-hairline)",
            }}
          >
            <Skeleton height="var(--space-4)" width="22%" />
            <Skeleton height="var(--space-4)" width="14%" />
            <Skeleton height="var(--space-4)" width="10%" />
            <Skeleton height="var(--space-4)" width="12%" shape="capsule" />
            <Skeleton height="var(--space-4)" width="12%" />
          </div>
        ))}
      </div>
    </div>
  );
}
