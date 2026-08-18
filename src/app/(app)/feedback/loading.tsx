/**
 * The Feedback skeleton — the three columns, in place, at the right widths.
 * The rail, the feed and the summary are all drawn where they will land, so
 * nothing jumps when the rows arrive.
 */

import { Skeleton } from "@/components/ui";

function CardSkeleton() {
  return (
    <div
      className="flex flex-col"
      style={{
        gap: "var(--space-3)",
        padding: "var(--space-5)",
        background: "var(--surface-raised)",
        border: "1px solid var(--stroke-rim)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--e1)",
      }}
    >
      <Skeleton width="40%" height="var(--space-4)" shape="capsule" />
      <Skeleton width="140px" height="24px" shape="capsule" />
      <Skeleton height="var(--space-12)" />
      <Skeleton width="52%" height="var(--space-4)" />
    </div>
  );
}

export default function FeedbackLoading() {
  return (
    <div
      className="grid lg:grid-cols-[260px_minmax(0,1fr)_300px]"
      style={{ gap: "var(--space-6)", alignItems: "start" }}
    >
      <div
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
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex flex-col" style={{ gap: "var(--space-2)" }}>
            <Skeleton width="38%" height="var(--space-3)" />
            <Skeleton height="var(--cap-m-h)" shape="capsule" />
          </div>
        ))}
      </div>

      <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
        <Skeleton width="180px" height="var(--space-4)" />
        {Array.from({ length: 4 }, (_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>

      <div
        className="flex flex-col"
        style={{
          gap: "var(--space-5)",
          padding: "var(--space-5)",
          background: "var(--surface-raised)",
          border: "1px solid var(--stroke-rim)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--e1)",
        }}
      >
        <Skeleton width="60%" height="var(--space-8)" />
        <Skeleton height="140px" shape="lg" />
        <Skeleton height="var(--space-16)" />
        <Skeleton height="var(--space-16)" />
      </div>
    </div>
  );
}
