/**
 * Four KPI cards, a filter bar and a list — drawn where they will land, so no
 * count arrives into a space that has just changed size.
 */

import { Skeleton } from "@/components/ui";

export default function ClientsLoading() {
  return (
    <div
      className="flex flex-col"
      style={{ gap: "var(--space-6)" }}
      role="status"
      aria-label="Loading clients"
    >
      <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <Skeleton height="var(--space-8)" width="180px" />
        <Skeleton height="var(--space-4)" width="300px" />
      </div>

      <div
        className="grid"
        style={{
          gap: "var(--space-4)",
          gridTemplateColumns: "repeat(auto-fit, minmax(212px, 1fr))",
        }}
      >
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="flex flex-col"
            style={{
              gap: "var(--space-2)",
              padding: "var(--space-5)",
              background: "var(--surface-raised)",
              border: "1px solid var(--stroke-rim)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--e1)",
            }}
          >
            <Skeleton height="var(--space-3)" width="96px" />
            <Skeleton height="40px" width="56%" />
            <Skeleton height="var(--space-3)" width="100%" />
          </div>
        ))}
      </div>

      <div
        className="grid"
        style={{
          gap: "var(--space-4)",
          padding: "var(--space-5)",
          background: "var(--surface-raised)",
          border: "1px solid var(--stroke-rim)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--e1)",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex flex-col" style={{ gap: "var(--space-2)" }}>
            <Skeleton height="var(--space-3)" width="72px" />
            <Skeleton height="var(--cap-m-h)" shape="capsule" />
          </div>
        ))}
      </div>

      <div
        className="flex flex-col"
        style={{
          gap: "var(--space-4)",
          padding: "var(--space-4)",
          background: "var(--surface-raised)",
          border: "1px solid var(--stroke-rim)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--e1)",
        }}
      >
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} height="var(--space-5)" />
        ))}
      </div>
    </div>
  );
}
