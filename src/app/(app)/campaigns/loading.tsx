/**
 * The skeleton draws the destination in its final layout — filter bar, then
 * the table — so the wait is spent orienting rather than doubting. No spinner
 * stands where a count will be.
 */

import { Skeleton } from "@/components/ui";

export default function CampaignsLoading() {
  return (
    <div
      className="flex flex-col"
      style={{ gap: "var(--space-6)" }}
      role="status"
      aria-label="Loading campaigns"
    >
      <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <Skeleton height="var(--space-8)" width="220px" />
        <Skeleton height="var(--space-4)" width="320px" />
      </div>

      <div
        style={{
          padding: "var(--space-5)",
          background: "var(--surface-raised)",
          border: "1px solid var(--stroke-rim)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--e1)",
          display: "grid",
          gap: "var(--space-4)",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        {Array.from({ length: 9 }, (_, index) => (
          <div
            key={index}
            className="flex flex-col"
            style={{ gap: "var(--space-2)" }}
          >
            <Skeleton height="var(--space-3)" width="72px" />
            <Skeleton height="var(--cap-m-h)" shape="capsule" />
          </div>
        ))}
      </div>

      <div
        style={{
          padding: "var(--space-4)",
          background: "var(--surface-raised)",
          border: "1px solid var(--stroke-rim)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--e1)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} height="var(--space-5)" />
        ))}
      </div>
    </div>
  );
}
