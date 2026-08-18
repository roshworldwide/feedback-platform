"use client";

/**
 * Engagement over time — openers and clickers by day.
 *
 * Two lines, no fill, no gradient, no second axis. Both series are counts of
 * PEOPLE, deduplicated by the metric layer: a recipient who opens nine times
 * contributes one opener, and a click is never added to opens. The lines are
 * therefore directly comparable, which is the whole reason they share an axis.
 *
 * The caption states the attribution rule, because a day here is the day the
 * report was sent, not the moment someone opened it.
 */

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/ui";
import { LineChart as LineChartIcon } from "lucide-react";

export type EngagementPoint = {
  /** `YYYY-MM-DD`, local. */
  key: string;
  /** "04 Aug" — what the axis shows. */
  label: string;
  opens: number;
  clicks: number;
};

export type EngagementChartProps = {
  points: EngagementPoint[];
};

const AXIS_INK = "var(--content-tertiary)";

function Key({ ink, children }: { ink: string; children: string }) {
  return (
    <span
      className="t-caption inline-flex items-center"
      style={{ gap: "var(--space-2)", color: "var(--content-secondary)" }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "10px",
          height: "2px",
          borderRadius: "var(--radius-capsule)",
          background: ink,
        }}
      />
      {children}
    </span>
  );
}

export function EngagementChart({ points }: EngagementChartProps) {
  const total = points.reduce((sum, point) => sum + point.opens + point.clicks, 0);

  if (points.length === 0 || total === 0) {
    return (
      <EmptyState
        icon={LineChartIcon}
        title="No opens or clicks in this period"
        description="Nothing was opened or clicked on the reports sent in this window. The chart draws again as soon as the first recipient opens one."
      />
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <div className="flex flex-wrap items-center" style={{ gap: "var(--space-5)" }}>
        <Key ink="var(--content-primary)">People who opened</Key>
        <Key ink="var(--signal-link)">People who clicked</Key>
      </div>

      <div style={{ width: "100%", height: "260px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
          >
            <CartesianGrid
              stroke="var(--stroke-hairline)"
              strokeDasharray="2 6"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: AXIS_INK, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--stroke-hairline)" }}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: AXIS_INK, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              cursor={{ stroke: "var(--stroke-rim)", strokeWidth: 1 }}
              contentStyle={{
                background: "var(--surface-raised)",
                border: "1px solid var(--stroke-rim)",
                borderRadius: "var(--radius-sm)",
                boxShadow: "var(--e3)",
                color: "var(--content-primary)",
                fontFamily: "var(--font-text)",
                fontSize: "13px",
              }}
              labelStyle={{ color: "var(--content-secondary)" }}
              itemStyle={{ color: "var(--content-primary)" }}
            />
            <Line
              type="monotone"
              dataKey="opens"
              name="Opened"
              stroke="var(--content-primary)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="clicks"
              name="Clicked"
              stroke="var(--signal-link)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
