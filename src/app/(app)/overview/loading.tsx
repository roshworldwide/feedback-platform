/**
 * The Overview skeleton.
 *
 * It draws the destination in the final layout — eight cards where eight cards
 * will be, each already carrying its own label and its own formula, so the wait
 * is spent orienting rather than doubting. Never a spinner where a count is
 * about to exist.
 */

import { Card, CardBody, CardHeader, CardTitle, KpiCard, Skeleton } from "@/components/ui";
import { FORMULAE } from "@/lib/metrics";
import { COUNT_DEFINITIONS } from "@/components/overview/kpi-grid";

const CARDS: { label: string; formula: string }[] = [
  { label: "Campaigns sent", formula: COUNT_DEFINITIONS.campaignsSent },
  { label: "Emails delivered", formula: COUNT_DEFINITIONS.delivered },
  { label: "Delivery rate", formula: FORMULAE.deliveryRate },
  { label: "Unique open rate", formula: FORMULAE.uniqueOpenRate },
  { label: "Click rate", formula: FORMULAE.clickRate },
  { label: "Click to open", formula: FORMULAE.clickToOpen },
  { label: "Response rate", formula: FORMULAE.responseRate },
  { label: "Average rating", formula: COUNT_DEFINITIONS.avgRating },
];

function PanelSkeleton({ title, height }: { title: string; height: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{title}</CardTitle>
      </CardHeader>
      <CardBody>
        <Skeleton height={height} shape="lg" />
      </CardBody>
    </Card>
  );
}

export default function OverviewLoading() {
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
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
        <div className="flex flex-wrap items-center" style={{ gap: "var(--space-6)" }}>
          <Skeleton width="248px" height="var(--cap-m-h)" shape="capsule" />
          <Skeleton width="220px" height="32px" shape="capsule" />
          <Skeleton width="200px" height="32px" shape="capsule" />
        </div>
        <Skeleton width="60%" height="var(--space-4)" />
      </div>

      <div
        className="grid"
        style={{
          gap: "var(--space-4)",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        }}
      >
        {CARDS.map((card) => (
          <KpiCard
            key={card.label}
            label={card.label}
            value={null}
            formula={card.formula}
            loading
          />
        ))}
      </div>

      <PanelSkeleton title="Engagement over time" height="260px" />

      <div
        className="grid"
        style={{
          gap: "var(--space-6)",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        <PanelSkeleton title="Customer satisfaction" height="320px" />
        <PanelSkeleton title="Needs attention" height="320px" />
      </div>

      <PanelSkeleton title="Recent campaigns" height="280px" />
      <PanelSkeleton title="Latest feedback" height="200px" />
    </div>
  );
}
