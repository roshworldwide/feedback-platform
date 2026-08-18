/**
 * `/compose` never renders a screen of its own — it resolves the most
 * recently edited draft and redirects into it, or creates one. This is only
 * ever visible for the moment that lookup takes; it draws the shape of the
 * editor it is about to land in, not a spinner with nothing to count.
 */

import { Skeleton } from "@/components/ui";

export default function ComposeRedirectLoading() {
  return (
    <div
      className="flex flex-wrap items-start"
      style={{ gap: "var(--space-6)" }}
      role="status"
      aria-label="Opening your most recent draft"
    >
      <div style={{ flex: "1 1 240px", maxWidth: "296px" }}>
        <Skeleton height="360px" shape="lg" />
      </div>
      <div className="flex flex-col" style={{ flex: "999 1 560px", gap: "var(--space-4)", minWidth: 0 }}>
        <Skeleton height="var(--space-8)" width="180px" />
        <Skeleton height="240px" shape="lg" />
        <Skeleton height="160px" shape="lg" />
      </div>
    </div>
  );
}
