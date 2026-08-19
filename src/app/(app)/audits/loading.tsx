import { Skeleton } from "@/components/ui";

export default function AuditsLoading() {
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-6)" }} role="status" aria-label="Loading audits">
      <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <Skeleton height="var(--space-8)" width="140px" />
        <Skeleton height="var(--space-4)" width="320px" />
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
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} height="var(--space-6)" />
        ))}
      </div>
    </div>
  );
}
