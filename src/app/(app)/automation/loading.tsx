/**
 * The Automation skeleton — four panels, in order, at their real heights, so
 * the table does not shove the calendar down the page when it arrives.
 */

import type { ReactNode } from "react";
import { Card, CardBody, CardHeader, CardTitle, Skeleton } from "@/components/ui";

function PanelSkeleton({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{title}</CardTitle>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

export default function AutomationLoading() {
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
      <PanelSkeleton title="Recurring series">
        <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} height="44px" />
          ))}
        </div>
      </PanelSkeleton>

      <PanelSkeleton title="Calendar">
        <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
          <Skeleton width="240px" height="44px" shape="capsule" />
          <Skeleton height="560px" shape="lg" />
        </div>
      </PanelSkeleton>

      <PanelSkeleton title="Readiness">
        <div
          className="grid"
          style={{
            gap: "var(--space-4)",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          }}
        >
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} height="220px" shape="lg" />
          ))}
        </div>
      </PanelSkeleton>

      <PanelSkeleton title="Rules">
        <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} height="72px" shape="lg" />
          ))}
        </div>
      </PanelSkeleton>
    </div>
  );
}
