/**
 * Client health as a capsule.
 *
 * The five states are exactly the five the `client_health` view can return.
 * A missing row is "No sends", never "Healthy" — v1 defaulted the unknown to
 * the good case, which is how an account could go silent for two months and
 * still show green.
 */

import { Pill, type PillTone } from "@/components/ui";
import { HEALTH_LABEL, type Health } from "./vocabulary";

const TONE: Record<Health, PillTone> = {
  healthy: "nominal",
  watch: "caution",
  "at-risk": "abort",
  "no-sends": "neutral",
  inactive: "neutral",
};

export function HealthPill({ health }: { health: Health | null }) {
  if (health === null) {
    return <Pill tone="neutral">Health unknown</Pill>;
  }
  return (
    <Pill tone={TONE[health]} dot>
      {HEALTH_LABEL[health]}
    </Pill>
  );
}
