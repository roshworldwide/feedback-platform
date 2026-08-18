/**
 * Campaign status as a capsule.
 *
 * Tone is meaning: sending is in flight, failed is broken, cancelled is a
 * deliberate stop. Gold is never a status — a sent campaign is nominal, not
 * ceremonial.
 */

import { Pill, type PillTone } from "@/components/ui";
// The leaf module, never the query layer: `@/lib/queries/campaigns` reaches
// `next/headers` through its lazy database import, and a client component that
// pulls it in cannot be bundled at all.
import { STATUS_LABEL, type CampaignStatus } from "./vocabulary";

const TONE: Record<CampaignStatus, PillTone> = {
  draft: "neutral",
  scheduled: "neutral",
  sending: "caution",
  sent: "nominal",
  failed: "abort",
  cancelled: "neutral",
};

export function StatusPill({ status }: { status: CampaignStatus }) {
  return (
    <Pill tone={TONE[status]} dot>
      {STATUS_LABEL[status]}
    </Pill>
  );
}

/** Internal recipients and test sends are marked, never quietly folded in. */
export function TestSendPill() {
  return <Pill tone="caution">Test send</Pill>;
}

export function AudiencePill({ isInternal }: { isInternal: boolean }) {
  return (
    <Pill tone={isInternal ? "caution" : "neutral"}>
      {isInternal ? "Internal" : "Client"}
    </Pill>
  );
}
