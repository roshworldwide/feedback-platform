"use client";

/**
 * Customer satisfaction — the score, the shape of it, and its direction.
 *
 * All five rows of the distribution are drawn every time, including the ones
 * with no ratings at all. A distribution that hides its empty rows tells you
 * the wrong story about a mean: "4.6" reads very differently once you can see
 * the three ones underneath it.
 *
 * The trend is a mean weighted by the number of ratings each day carried, so a
 * day with a single five-star rating cannot outweigh a day with forty.
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
import { StarRating } from "@/components/ui";
import { fmtInt, fmtRating } from "@/lib/utils";

export type DistributionRow = { star: number; count: number; pct: number };

export type CsatPoint = {
  key: string;
  label: string;
  /** null on a day with no ratings — the line breaks rather than inventing one. */
  avg: number | null;
  ratings: number;
};

export type SatisfactionPanelProps = {
  average: number | null;
  ratings: number;
  distribution: DistributionRow[];
  trend: CsatPoint[];
  /** True when more ratings exist than the scan could read. */
  truncated: boolean;
  scanLimit: number;
};

const AXIS_INK = "var(--content-tertiary)";

export function SatisfactionPanel({
  average,
  ratings,
  distribution,
  trend,
  truncated,
  scanLimit,
}: SatisfactionPanelProps) {
  const hasTrend = trend.some((point) => point.avg !== null);

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
      <div
        className="flex flex-wrap items-end"
        style={{ gap: "var(--space-5)" }}
      >
        <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
          <span
            className="t-display-2 tabular"
            style={{ color: "var(--content-primary)", lineHeight: 1 }}
          >
            {fmtRating(average)}
          </span>
          <StarRating value={average} size="l" />
        </div>

        <p
          className="t-footnote"
          style={{ margin: 0, color: "var(--content-secondary)" }}
        >
          {ratings === 0
            ? "No ratings yet in this period."
            : `From ${fmtInt(ratings)} ${
                ratings === 1 ? "rating" : "ratings"
              } in this period.`}
          {truncated ? (
            <>
              {" "}
              The distribution below reads the first {fmtInt(scanLimit)} of them.
            </>
          ) : null}
        </p>
      </div>

      {/* All five rows, always. */}
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: `0 var(--space-2)`,
          fontFamily: "var(--font-text)",
        }}
      >
        <caption className="sr-only">
          How the ratings in this period are distributed across the five star
          values
        </caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Stars</th>
            <th scope="col">Share</th>
            <th scope="col">Ratings</th>
          </tr>
        </thead>
        <tbody>
          {distribution.map((row) => (
            <tr key={row.star}>
              <th
                scope="row"
                className="t-footnote tabular"
                style={{
                  width: "72px",
                  textAlign: "left",
                  fontWeight: 400,
                  color: "var(--content-secondary)",
                  whiteSpace: "nowrap",
                }}
              >
                {row.star} {row.star === 1 ? "star" : "stars"}
              </th>
              <td style={{ width: "100%", paddingInline: "var(--space-3)" }}>
                <span
                  aria-hidden="true"
                  style={{
                    display: "block",
                    height: "8px",
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
                      transition: "width var(--dur-glide) var(--ease-glide)",
                    }}
                  />
                </span>
              </td>
              <td
                className="t-footnote tabular"
                style={{
                  textAlign: "right",
                  whiteSpace: "nowrap",
                  color: "var(--content-primary)",
                }}
              >
                {fmtInt(row.count)}
                <span style={{ color: "var(--content-tertiary)" }}>
                  {" "}
                  · {row.pct.toFixed(1)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <h3
          className="t-overline"
          style={{ margin: 0, color: "var(--content-secondary)" }}
        >
          Trend
        </h3>

        {hasTrend ? (
          <div style={{ width: "100%", height: "160px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trend}
                margin={{ top: 4, right: 8, bottom: 0, left: -24 }}
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
                  domain={[1, 5]}
                  ticks={[1, 2, 3, 4, 5]}
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
          <p
            className="t-subhead"
            style={{ margin: 0, color: "var(--content-secondary)" }}
          >
            No day in this period carries a rating, so there is no trend to draw
            yet.
          </p>
        )}

        <p
          className="t-caption"
          style={{ margin: 0, color: "var(--content-tertiary)" }}
        >
          Each point is the mean rating for reports sent that day, weighted by
          how many ratings each report received. Days without a rating are left
          blank rather than drawn as zero.
        </p>
      </div>
    </div>
  );
}
