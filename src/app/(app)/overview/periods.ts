/**
 * The four windows, and the window immediately before each of them.
 *
 * A delta is only honest against an equal span of time, so the comparison is
 * always the same number of days ending where this one starts — never
 * "last month" against "this month so far".
 */

export const PERIODS = [
  { value: "today", label: "Today", days: 1 },
  { value: "7d", label: "7d", days: 7 },
  { value: "30d", label: "30d", days: 30 },
  { value: "90d", label: "90d", days: 90 },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["value"];

export const DEFAULT_PERIOD: PeriodKey = "30d";

export function isPeriodKey(value: unknown): value is PeriodKey {
  return (
    typeof value === "string" &&
    PERIODS.some((period) => period.value === value)
  );
}

export function periodKeyFrom(value: unknown): PeriodKey {
  return isPeriodKey(value) ? value : DEFAULT_PERIOD;
}

const DAY_MS = 86_400_000;

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export type PeriodWindow = {
  key: PeriodKey;
  label: string;
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
  /** Whole days the chart draws, inclusive of both ends. */
  days: Date[];
  /** Read aloud beside a delta: "vs the previous 30 days". */
  comparisonLabel: string;
  /** Read aloud beside a total: "in the last 30 days". */
  spanLabel: string;
};

export function windowFor(key: PeriodKey, now: Date = new Date()): PeriodWindow {
  const period = PERIODS.find((candidate) => candidate.value === key) ?? PERIODS[2];

  const to = now;
  const from =
    key === "today"
      ? startOfDay(now)
      : new Date(now.getTime() - period.days * DAY_MS);

  const span = key === "today" ? DAY_MS : period.days * DAY_MS;
  const previousTo = from;
  const previousFrom = new Date(from.getTime() - span);

  const days: Date[] = [];
  for (
    let cursor = startOfDay(from);
    cursor.getTime() <= startOfDay(to).getTime();
    cursor = new Date(cursor.getTime() + DAY_MS)
  ) {
    days.push(cursor);
  }

  return {
    key,
    label: period.label,
    from,
    to,
    previousFrom,
    previousTo,
    days,
    comparisonLabel:
      key === "today" ? "vs yesterday" : `vs the previous ${period.days} days`,
    spanLabel: key === "today" ? "today" : `in the last ${period.days} days`,
  };
}

/** `YYYY-MM-DD` in local time — the key both the data and the axis use. */
export function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dayLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}
