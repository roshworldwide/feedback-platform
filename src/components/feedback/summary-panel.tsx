"use client";

/**
 * The right-hand summary — what the filtered set actually looks like.
 *
 * Every figure here describes exactly the ratings the feed is showing, under
 * exactly the filters in the rail. All five distribution rows are drawn, and a
 * breakdown that could not be read whole says how much of it was read.
 */

import type { ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StarRating } from "@/components/ui";
import { fmtInt, fmtRating } from "@/lib/utils";

export type TrendPoint = {
  key: string;
  label: string;
  /** null on a day with no ratings — never drawn as zero. */
  avg: number | null;
  ratings: number;
};

export type Breakdown = { key: string; name: string; ratings: number; avg: number | null };

export type SummaryPanelProps = {
  average: number | null;
  ratings: number;
  distribution: { star: number; count: number; pct: number }[];
  trend: TrendPoint[];
  byClient: Breakdown[];
  bySeries: Breakdown[];
  truncated: boolean;
  scanLimit: number;
};

const AXIS_INK = "var(--content-tertiary)";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col" style={{ gap: "var(--space-3)" }}>
      <h3 className="t-overline" style={{ margin: 0, color: "var(--content-secondary)" }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function BreakdownList({ rows, empty }: { rows: Breakdown[]; empty: string }) {
  if (rows.length === 0) {
    return (
      <p className="t-caption" style={{ margin: 0, color: "var(--content-tertiary)" }}>
        {empty}
      </p>
    );
  }
  return (
    <ul
      className="flex flex-col"
      style={{ gap: "var(--space-2)", margin: 0, padding: 0, listStyle: "none" }}
    >
      {rows.map((row) => (
        <li
          key={row.key}
          className="flex items-center"
          style={{ gap: "var(--space-3)" }}
        >
          <span
            className="t-footnote"
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              color: "var(--content-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.name}
          </span>
          <span
            className="t-caption tabular"
            style={{ color: "var(--content-tertiary)", whiteSpace: "nowrap" }}
          >
            {fmtInt(row.ratings)}
          </span>
          <span
            className="t-footnote tabular"
            style={{ color: "var(--content-primary)", whiteSpace: "nowrap" }}
          >
            {fmtRating(row.avg)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function FeedbackSummaryPanel({
  average,
  ratings,
  distribution,
  trend,
  byClient,
  bySeries,
  truncated,
  scanLimit,
}: SummaryPanelProps) {
  const hasTrend = trend.some((point) => point.avg !== null);

  return (
    <aside
      aria-label="Summary of the filtered feedback"
      className="flex flex-col"
      style={{
        gap: "var(--space-6)",
        padding: "var(--space-5)",
        background: "var(--surface-raised)",
        border: "1px solid var(--stroke-rim)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--e1)",
        alignSelf: "start",
        position: "sticky",
        top: "var(--space-6)",
      }}
    >
      <Block title="Satisfaction">
        <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
          <span
            className="t-title-1 tabular"
            style={{ color: "var(--content-primary)" }}
          >
            {fmtRating(average)}
          </span>
          <StarRating value={average} size="m" />
        </div>
        <p className="t-caption" style={{ margin: 0, color: "var(--content-tertiary)" }}>
          {ratings === 0
            ? "No ratings match these filters."
            : `Across ${fmtInt(ratings)} ${ratings === 1 ? "rating" : "ratings"}.`}
          {truncated
            ? ` The summary reads the first ${fmtInt(scanLimit)} of them.`
            : ""}
        </p>
      </Block>

      <Block title="Trend">
        {hasTrend ? (
          <div style={{ width: "100%", height: "140px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -28 }}>
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
                  minTickGap={28}
                />
                <YAxis
                  domain={[1, 5]}
                  ticks={[1, 3, 5]}
                  tick={{ fill: AXIS_INK, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
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
                  dataKey="avg"
                  name="Average rating"
                  stroke="var(--content-primary)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="t-caption" style={{ margin: 0, color: "var(--content-tertiary)" }}>
            No day in this set carries a rating, so there is no trend to draw.
          </p>
        )}
      </Block>

      <Block title="Distribution">
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: "0 var(--space-2)",
            fontFamily: "var(--font-text)",
          }}
        >
          <caption className="sr-only">
            Ratings by star value across the filtered set
          </caption>
          <tbody>
            {distribution.map((row) => (
              <tr key={row.star}>
                <th
                  scope="row"
                  className="t-caption tabular"
                  style={{
                    width: "24px",
                    textAlign: "left",
                    fontWeight: 400,
                    color: "var(--content-secondary)",
                  }}
                >
                  {row.star}
                </th>
                <td style={{ width: "100%", paddingInline: "var(--space-2)" }}>
                  <span
                    aria-hidden="true"
                    style={{
                      display: "block",
                      height: "6px",
                      borderRadius: "var(--radius-capsule)",
                      background: "var(--fill-quiet)",
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        width: `${Math.max(0, Math.min(100, row.pct))}%`,
                        height: "100%",
                        borderRadius: "var(--radius-capsule)",
                        background: "var(--content-tertiary)",
                      }}
                    />
                  </span>
                </td>
                <td
                  className="t-caption tabular"
                  style={{
                    textAlign: "right",
                    whiteSpace: "nowrap",
                    color: "var(--content-primary)",
                  }}
                >
                  {fmtInt(row.count)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Block>

      <Block title="By client">
        <BreakdownList
          rows={byClient}
          empty="No client has a rating in this set."
        />
      </Block>

      <Block title="By series">
        <BreakdownList
          rows={bySeries}
          empty="No series has a rating in this set. Reports sent outside a series are grouped as unscheduled."
        />
      </Block>
    </aside>
  );
}
