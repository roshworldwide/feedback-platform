/**
 * The sending identity.
 *
 * These values are read from the deployment environment, which is where they
 * are actually enforced at send time. They are shown here read-only and said
 * to be read-only, rather than offered as a form that appears to save and
 * changes nothing — v1 had three such forms.
 */

import { CheckCircle2, CircleAlert } from "lucide-react";
import { Pill } from "@/components/ui";
import type { SenderConfig } from "./vocabulary";

export type SenderPanelProps = {
  config: SenderConfig | null;
  /** Why the configuration could not be read. */
  reason?: string | null;
};

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      className="flex flex-col"
      style={{
        gap: "var(--space-1)",
        padding: "var(--space-4)",
        borderRadius: "calc(var(--radius-lg) - var(--space-3))",
        background: "var(--fill-quiet)",
        border: "1px solid var(--stroke-hairline)",
      }}
    >
      <dt className="t-overline" style={{ color: "var(--content-tertiary)" }}>
        {label}
      </dt>
      <dd
        className="t-subhead"
        style={{ margin: 0, color: "var(--content-primary)", wordBreak: "break-word" }}
      >
        {value}
      </dd>
      {hint ? (
        <p className="t-caption" style={{ margin: 0, color: "var(--content-tertiary)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SenderPanel({ config, reason }: SenderPanelProps) {
  if (!config) {
    return (
      <p className="t-subhead prose-measure" style={{ margin: 0, color: "var(--content-secondary)" }}>
        The sending configuration could not be read
        {reason ? ` — ${reason}` : "."} Nothing is shown in its place, because a
        guessed mailbox is worse than no mailbox.
      </p>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <div className="flex flex-wrap items-center" style={{ gap: "var(--space-3)" }}>
        {config.verified ? (
          <Pill tone="nominal" dot>
            Delivery key present
          </Pill>
        ) : (
          <Pill tone="caution" dot>
            No delivery key
          </Pill>
        )}
        <p
          className="t-footnote prose-measure"
          style={{ margin: 0, color: "var(--content-secondary)" }}
        >
          {config.verified ? (
            <>
              <CheckCircle2
                size={14}
                strokeWidth={1.75}
                aria-hidden="true"
                style={{ display: "inline", verticalAlign: "-2px", marginRight: "6px" }}
              />
              Mail can be sent from this deployment. Domain verification itself
              lives with the mail provider, not here.
            </>
          ) : (
            <>
              <CircleAlert
                size={14}
                strokeWidth={1.75}
                aria-hidden="true"
                style={{ display: "inline", verticalAlign: "-2px", marginRight: "6px" }}
              />
              No delivery key is configured, so sending will fail. Set one before
              scheduling anything.
            </>
          )}
        </p>
      </div>

      <dl
        className="grid"
        style={{
          gap: "var(--space-3)",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          margin: 0,
        }}
      >
        <Row label="Mailbox" value={config.mailbox} />
        <Row label="From name" value={config.fromName} />
        <Row
          label="Reply to"
          value={config.replyTo}
          hint="Replies land here, not in the sending mailbox."
        />
        <Row
          label="Internal domains"
          value={config.internalDomains.join(", ") || "None set"}
          hint="Recipients at these domains are marked internal and excluded from every headline figure."
        />
        <Row label="Links resolve to" value={config.appUrl} />
      </dl>

      <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <h3 className="t-overline" style={{ margin: 0, color: "var(--content-secondary)" }}>
          Signature
        </h3>
        <p
          className="t-body prose-measure"
          style={{
            margin: 0,
            padding: "var(--space-4)",
            borderRadius: "calc(var(--radius-lg) - var(--space-3))",
            background: "var(--fill-quiet)",
            border: "1px solid var(--stroke-hairline)",
            color: "var(--content-primary)",
            whiteSpace: "pre-wrap",
          }}
        >
          {config.signature}
        </p>
      </div>

      <p className="t-caption prose-measure" style={{ margin: 0, color: "var(--content-tertiary)" }}>
        These values come from the deployment environment and are applied at
        send time. Changing them is a deploy, not an edit here — so nothing on
        this panel pretends to save.
      </p>
    </div>
  );
}
