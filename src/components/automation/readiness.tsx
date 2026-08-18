/**
 * The readiness queue.
 *
 * Three lanes, and the rule that puts a report in each one is printed under
 * the lane's name. A queue whose rule is invisible is a queue nobody trusts —
 * v1 had a "pending" count that no one could reproduce by hand.
 */

import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { EmptyState, Pill } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { READINESS_LANES, type ReadinessLane } from "./vocabulary";

export type ReadinessCard = {
  id: string;
  label: string;
  clientName: string | null;
  scheduledFor: string | null;
  lane: ReadinessLane;
  /** Why it landed in this lane, stated per card. */
  reason: string;
};

export type ReadinessQueueProps = {
  cards: ReadinessCard[];
};

export function ReadinessQueue({ cards }: ReadinessQueueProps) {
  if (cards.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardCheck size={22} strokeWidth={1.5} />}
        title="Nothing is waiting to go out"
        description="No draft and no scheduled report is outstanding. New work appears here as soon as it is created."
        action={{ label: "Write a report", href: "/compose" }}
      />
    );
  }

  return (
    <div
      className="grid"
      style={{
        gap: "var(--space-4)",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
      }}
    >
      {READINESS_LANES.map((lane) => {
        const inLane = cards.filter((card) => card.lane === lane.value);
        return (
          <section
            key={lane.value}
            aria-label={lane.label}
            className="flex flex-col"
            style={{ gap: "var(--space-3)" }}
          >
            <div className="flex flex-col" style={{ gap: "2px" }}>
              <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                <h3
                  className="t-subhead"
                  style={{ margin: 0, color: "var(--content-primary)", fontWeight: 600 }}
                >
                  {lane.label}
                </h3>
                <span className="t-micro tabular" style={{ color: "var(--content-tertiary)" }}>
                  {inLane.length}
                </span>
              </div>
              <p
                className="t-caption"
                style={{ margin: 0, color: "var(--content-tertiary)" }}
              >
                {lane.rule}
              </p>
            </div>

            {inLane.length === 0 ? (
              <p
                className="t-caption"
                style={{
                  margin: 0,
                  padding: "var(--space-4)",
                  borderRadius: "calc(var(--radius-lg) - var(--space-3))",
                  border: "1px dashed var(--stroke-hairline)",
                  color: "var(--content-tertiary)",
                }}
              >
                Nothing in this lane.
              </p>
            ) : (
              <ul
                className="flex flex-col"
                style={{ gap: "var(--space-2)", margin: 0, padding: 0, listStyle: "none" }}
              >
                {inLane.map((card) => (
                  <li
                    key={card.id}
                    className="flex flex-col"
                    style={{
                      gap: "var(--space-2)",
                      padding: "var(--space-3)",
                      borderRadius: "calc(var(--radius-lg) - var(--space-3))",
                      background: "var(--fill-quiet)",
                      border: "1px solid var(--stroke-hairline)",
                    }}
                  >
                    <Link
                      href={`/campaigns/${card.id}`}
                      className="t-subhead"
                      style={{ color: "var(--content-primary)", textDecoration: "none" }}
                    >
                      {card.label}
                    </Link>
                    <div
                      className="flex flex-wrap items-center"
                      style={{ gap: "var(--space-2)" }}
                    >
                      {card.clientName ? (
                        <Pill tone="neutral">{card.clientName}</Pill>
                      ) : (
                        <Pill tone="caution">Client not resolved</Pill>
                      )}
                      <span
                        className="t-caption tabular"
                        style={{ color: "var(--content-tertiary)" }}
                      >
                        {card.scheduledFor
                          ? fmtDateTime(card.scheduledFor)
                          : "No date set"}
                      </span>
                    </div>
                    <p
                      className="t-caption"
                      style={{ margin: 0, color: "var(--content-secondary)" }}
                    >
                      {card.reason}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
