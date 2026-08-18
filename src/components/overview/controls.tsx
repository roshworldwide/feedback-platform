"use client";

/**
 * The control row, and the sentence underneath it.
 *
 * The two exclusions are ON by default and the caption states what they
 * removed, in figures, every single time this component renders. v1 shipped the
 * same two flags, consulted neither, and showed a dashboard shaped by one
 * one-recipient test send — so here the exclusion cannot be applied silently:
 * the caption is not conditional, it is the component.
 *
 * Every control writes to the URL and the server re-queries, so a period is a
 * shareable address and the numbers under it are the true numbers for it.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Segmented, Switch, type SegmentedOption } from "@/components/ui";
import { PERIODS, type PeriodKey } from "@/app/(app)/overview/periods";
import { fmtInt } from "@/lib/utils";

export type OverviewControlsProps = {
  period: PeriodKey;
  excludeInternal: boolean;
  excludeTests: boolean;
  /** From `period_stats`. null when the totals could not be read. */
  excludedInternal: number | null;
  excludedTestSends: number | null;
  /** Read aloud beside the period — "in the last 30 days". */
  spanLabel: string;
};

const PERIOD_OPTIONS: readonly SegmentedOption<PeriodKey>[] = PERIODS.map(
  (period) => ({ value: period.value, label: period.label }),
);

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * The exclusion, in words, for every combination of the two switches.
 * There is no branch of this function that returns nothing.
 */
export function exclusionCaption(
  excludeInternal: boolean,
  excludeTests: boolean,
  internal: number | null,
  tests: number | null,
): string {
  const unknown = internal === null || tests === null;

  if (unknown) {
    if (excludeInternal && excludeTests) {
      return "Excluding internal recipients and test sends — the excluded counts could not be read for this window.";
    }
    if (excludeInternal) {
      return "Excluding internal recipients. Test sends are included. The excluded counts could not be read for this window.";
    }
    if (excludeTests) {
      return "Excluding test sends. Internal recipients are included. The excluded counts could not be read for this window.";
    }
    return "Including internal recipients and test sends. Nothing is excluded from these figures.";
  }

  const internalPhrase = `${fmtInt(internal)} internal ${plural(
    internal,
    "recipient",
    "recipients",
  )}`;
  const testPhrase = `${fmtInt(tests)} test ${plural(tests, "send", "sends")}`;

  if (excludeInternal && excludeTests) {
    return `Excluding ${internalPhrase} and ${testPhrase}.`;
  }
  if (excludeInternal) {
    return `Excluding ${internalPhrase}. ${testPhrase} are included in these figures.`;
  }
  if (excludeTests) {
    return `Excluding ${testPhrase}. ${internalPhrase} are included in these figures.`;
  }
  return `Including ${internalPhrase} and ${testPhrase}. Nothing is excluded from these figures.`;
}

/** Only what differs from the default is written, so a shared URL says what it means. */
function hrefFor(
  period: PeriodKey,
  excludeInternal: boolean,
  excludeTests: boolean,
): string {
  const params = new URLSearchParams();
  if (period !== "30d") params.set("period", period);
  if (!excludeInternal) params.set("internal", "include");
  if (!excludeTests) params.set("tests", "include");
  const query = params.toString();
  return query ? `/overview?${query}` : "/overview";
}

export function OverviewControls({
  period,
  excludeInternal,
  excludeTests,
  excludedInternal,
  excludedTestSends,
  spanLabel,
}: OverviewControlsProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const go = React.useCallback(
    (next: {
      period?: PeriodKey;
      excludeInternal?: boolean;
      excludeTests?: boolean;
    }) => {
      startTransition(() => {
        router.replace(
          hrefFor(
            next.period ?? period,
            next.excludeInternal ?? excludeInternal,
            next.excludeTests ?? excludeTests,
          ),
          { scroll: false },
        );
      });
    },
    [router, period, excludeInternal, excludeTests],
  );

  const internalSwitchId = React.useId();
  const testSwitchId = React.useId();

  return (
    <section
      aria-label="Period and exclusions"
      className="flex flex-col"
      style={{
        gap: "var(--space-4)",
        padding: "var(--space-5)",
        background: "var(--surface-raised)",
        border: "1px solid var(--stroke-rim)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--e1)",
        opacity: pending ? 0.72 : 1,
        transition: "opacity var(--dur-glide) var(--ease-glide)",
      }}
    >
      <div
        className="flex flex-wrap items-center"
        style={{ gap: "var(--space-6)" }}
      >
        <Segmented
          options={PERIOD_OPTIONS}
          value={period}
          label="Period"
          onValueChange={(value) => go({ period: value })}
        />

        <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
          <Switch
            id={internalSwitchId}
            checked={excludeInternal}
            label="Exclude internal recipients"
            onCheckedChange={(checked) => go({ excludeInternal: checked })}
          />
          <label
            htmlFor={internalSwitchId}
            className="t-subhead"
            style={{ color: "var(--content-primary)", cursor: "pointer" }}
          >
            Exclude internal recipients
          </label>
        </div>

        <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
          <Switch
            id={testSwitchId}
            checked={excludeTests}
            label="Exclude test sends"
            onCheckedChange={(checked) => go({ excludeTests: checked })}
          />
          <label
            htmlFor={testSwitchId}
            className="t-subhead"
            style={{ color: "var(--content-primary)", cursor: "pointer" }}
          >
            Exclude test sends
          </label>
        </div>
      </div>

      {/* Not conditional. The exclusion is always stated, never silent. */}
      <p
        className="t-footnote prose-measure"
        aria-live="polite"
        style={{ margin: 0, color: "var(--content-secondary)" }}
      >
        {exclusionCaption(
          excludeInternal,
          excludeTests,
          excludedInternal,
          excludedTestSends,
        )}{" "}
        <span style={{ color: "var(--content-tertiary)" }}>
          Every figure below is {spanLabel}.
        </span>
      </p>
    </section>
  );
}
