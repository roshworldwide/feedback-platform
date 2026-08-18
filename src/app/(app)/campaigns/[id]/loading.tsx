/**
 * The header block, the tab rail and the funnel, drawn in their final
 * positions. Nothing moves when the numbers arrive.
 */

import { Skeleton } from "@/components/ui";

export default function CampaignDetailLoading() {
  return (
    <div
      className="flex flex-col"
      style={{ gap: "var(--space-6)" }}
      role="status"
      aria-label="Loading this campaign"
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
        <div className="flex" style={{ gap: "var(--space-3)" }}>
          <Skeleton height="20px" width="104px" shape="capsule" />
          <Skeleton height="20px" width="72px" shape="capsule" />
          <Skeleton height="20px" width="128px" shape="capsule" />
        </div>
        <Skeleton height="var(--space-8)" width="60%" />
        <div
          className="grid"
          style={{
            gap: "var(--space-4)",
            gridTemplateColumns: "repeat(auto-fit, minmax(196px, 1fr))",
          }}
        >
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex flex-col" style={{ gap: "var(--space-2)" }}>
              <Skeleton height="var(--space-3)" width="64px" />
              <Skeleton height="var(--space-5)" width="80%" />
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
        {["Performance", "Recipients", "Content", "Activity"].map((label) => (
          <Skeleton key={label} height="var(--space-5)" width="96px" />
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
        {[100, 96, 74, 42, 28].map((width) => (
          <Skeleton
            key={width}
            height="var(--space-4)"
            width={`${width}%`}
            shape="capsule"
          />
        ))}
      </div>

      <div
        className="grid"
        style={{
          gap: "var(--space-4)",
          gridTemplateColumns: "repeat(auto-fit, minmax(212px, 1fr))",
        }}
      >
        {Array.from({ length: 8 }, (_, index) => (
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
            <Skeleton height="var(--space-3)" width="88px" />
            <Skeleton height="40px" width="60%" />
            <Skeleton height="var(--space-3)" width="100%" />
          </div>
        ))}
      </div>
    </div>
  );
}
