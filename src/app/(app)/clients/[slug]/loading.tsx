/**
 * Header, tab rail and the four overview panels, drawn where they will land.
 */

import { Skeleton } from "@/components/ui";

export default function ClientDetailLoading() {
  return (
    <div
      className="flex flex-col"
      style={{ gap: "var(--space-6)" }}
      role="status"
      aria-label="Loading this client"
    >
      <div
        className="flex flex-col"
        style={{
          gap: "var(--space-4)",
          padding: "var(--space-6)",
          background: "var(--surface-raised)",
          border: "1px solid var(--stroke-rim)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--e1)",
        }}
      >
        <div className="flex items-center" style={{ gap: "var(--space-4)" }}>
          <Skeleton height="56px" width="56px" shape="capsule" />
          <div className="flex flex-col" style={{ gap: "var(--space-2)", flex: "1 1 auto" }}>
            <Skeleton height="var(--space-8)" width="42%" />
            <Skeleton height="var(--space-3)" width="140px" />
          </div>
          <Skeleton height="20px" width="88px" shape="capsule" />
        </div>

        <div
          className="grid"
          style={{
            gap: "var(--space-4)",
            gridTemplateColumns: "repeat(auto-fit, minmax(196px, 1fr))",
          }}
        >
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex flex-col" style={{ gap: "var(--space-2)" }}>
              <Skeleton height="var(--space-3)" width="72px" />
              <Skeleton height="var(--space-5)" width="86%" />
            </div>
          ))}
        </div>
      </div>

      <div
        className="flex"
        style={{
          gap: "var(--space-5)",
          paddingBottom: "var(--space-3)",
          borderBottom: "1px solid var(--stroke-hairline)",
        }}
      >
        {["Overview", "Contacts", "Campaigns", "Feedback", "Details"].map((label) => (
          <Skeleton key={label} height="var(--space-5)" width="88px" />
        ))}
      </div>

      <div
        className="grid"
        style={{
          gap: "var(--space-4)",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
        }}
      >
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
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
            <Skeleton height="var(--space-5)" width="52%" />
            {Array.from({ length: 5 }, (_, line) => (
              <Skeleton key={line} height="var(--space-4)" shape="capsule" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
