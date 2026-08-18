import { describe, expect, it } from "vitest";
import {
  EMPTY_PERIOD_STATS,
  averageRating,
  bounceRate,
  clickToOpenRate,
  deliveryRate,
  deltaPoints,
  funnelOf,
  ratingDistribution,
  responseRate,
  trendOf,
  uniqueOpenRate,
  type PeriodStats,
} from "./metrics";

const stats = (over: Partial<PeriodStats> = {}): PeriodStats => ({
  ...EMPTY_PERIOD_STATS,
  ...over,
});

describe("the v1 double-count cannot recur", () => {
  /**
   * v1 shipped:
   *   _total_opens = len(opens) + len(clicks)   # "clicks imply open"
   * on top of a click handler that had already written a synthetic open row.
   * Every click therefore counted as two opens.
   *
   * With 160 delivered, 23 real openers and 11 of them clicking, v1 displayed
   * 34 opens / 21.2%. The truth is 23 / 14.4%.
   */
  const real = stats({
    delivered: 160,
    recipients_attempted: 161,
    unique_opens: 23,
    unique_clicks: 11,
  });

  it("counts a clicker exactly once as an opener", () => {
    expect(uniqueOpenRate(real)).toBe(14.4);
    expect(uniqueOpenRate(real)).not.toBe(21.2);
  });

  it("never exceeds 100% however often a recipient clicks", () => {
    // 40 delivered, all 40 opened, and they clicked 500 times between them.
    // unique_clicks is a recipient count, so it can never outrun the audience.
    const clicky = stats({ delivered: 40, unique_opens: 40, unique_clicks: 40 });
    expect(uniqueOpenRate(clicky)).toBe(100);
    expect(clickToOpenRate(clicky)).toBe(100);
  });

  it("reports click-to-open against real openers, not inflated ones", () => {
    // v1's inflated denominator made engagement look worse: 11/34 = 32.4%.
    expect(clickToOpenRate(real)).toBe(47.8);
  });

  it("keeps opens at or below delivered", () => {
    expect(real.unique_opens).toBeLessThanOrEqual(real.delivered);
  });
});

describe("attempted and delivered stay distinct", () => {
  // v1 labelled a delivered count as "Total Sent" and captioned a 99.4%
  // delivery rate with "160 emails" when 161 were attempted.
  const s = stats({ recipients_attempted: 161, delivered: 160, bounced: 1 });

  it("divides delivery by attempted, not by delivered", () => {
    expect(deliveryRate(s)).toBe(99.4);
    expect(bounceRate(s)).toBe(0.6);
  });

  it("has delivery and bounce sum to 100", () => {
    expect((deliveryRate(s) ?? 0) + (bounceRate(s) ?? 0)).toBeCloseTo(100, 1);
  });
});

describe("absence is not zero", () => {
  it("returns null rather than 0% when nothing was delivered", () => {
    const s = stats({ delivered: 0, unique_opens: 0 });
    expect(uniqueOpenRate(s)).toBeNull();
    expect(responseRate(s)).toBeNull();
  });

  it("returns null for an unknown delta rather than implying no change", () => {
    expect(deltaPoints(12.5, null)).toBeNull();
    expect(trendOf(null)).toBe("unknown");
  });
});

describe("direction respects the metric", () => {
  it("treats a falling bounce rate as an improvement", () => {
    expect(trendOf(-2.1, true)).toBe("up");
    expect(trendOf(2.1, true)).toBe("down");
  });

  it("treats a rising open rate as an improvement", () => {
    expect(trendOf(2.1)).toBe("up");
    expect(trendOf(-2.1)).toBe("down");
  });
});

describe("rating distribution", () => {
  it("always returns all five rows even when a star is unused", () => {
    const d = ratingDistribution([5, 5, 4]);
    expect(d).toHaveLength(5);
    expect(d.map((r) => r.star)).toEqual([5, 4, 3, 2, 1]);
    expect(d.find((r) => r.star === 1)?.count).toBe(0);
  });

  it("computes the average the dashboard displays", () => {
    // The v1 all-time set: ten 5s, five 4s, one 3, one 2, three 1s.
    const set = [
      ...Array<number>(10).fill(5),
      ...Array<number>(5).fill(4),
      3, 2, 1, 1, 1,
    ];
    expect(averageRating(set)).toBe(3.9);
  });

  it("returns null for no ratings rather than zero", () => {
    expect(averageRating([])).toBeNull();
  });
});

describe("funnel", () => {
  const f = funnelOf({
    campaign_id: "c1",
    recipients_total: 9,
    recipients_internal: 4,
    recipients_external: 5,
    delivered: 5,
    bounced: 0,
    unique_opens: 4,
    unique_clicks: 2,
    ratings: 2,
    avg_rating: 4.5,
    comments: 1,
  });

  it("never lets a later stage exceed an earlier one", () => {
    for (let i = 1; i < f.length; i++) {
      expect(f[i].value).toBeLessThanOrEqual(f[i - 1].value);
    }
  });

  it("reports drop-off between consecutive stages", () => {
    expect(f[0].dropOff).toBeNull();
    expect(f[2].dropOff).toBe(1); // 5 delivered → 4 opened
  });

  it("excludes internal recipients from the funnel entrance", () => {
    // 9 recipients, 4 of them internal — the funnel starts at 5, not 9.
    expect(f[0].value).toBe(5);
  });
});
