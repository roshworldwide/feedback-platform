import { Skeleton } from "@/components/ui";

export default function AuditRunLoading() {
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-6)" }} role="status" aria-label="Loading this audit run">
      <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <Skeleton height="var(--space-8)" width="220px" />
        <Skeleton height="var(--space-4)" width="160px" />
      </div>
      <div className="grid" style={{ gap: "var(--space-6)", gridTemplateColumns: "220px minmax(0, 1fr)" }}>
        <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} height="var(--space-8)" />
          ))}
        </div>
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
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} height="var(--space-6)" />
          ))}
        </div>
      </div>
    </div>
  );
}
