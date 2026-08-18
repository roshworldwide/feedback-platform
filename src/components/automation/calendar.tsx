/**
 * A month of sends.
 *
 * Six whole weeks, always, so the grid does not change shape between months.
 * A campaign appears on the day it was sent, or on the day it is scheduled to
 * go — the two are drawn differently and labelled, because a plan and a fact
 * are not the same thing and v1 showed them identically.
 */

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Pill } from "@/components/ui";
import { WEEKDAYS, monthGrid, monthKeyOf, monthLabel, shiftMonth } from "./vocabulary";

export type CalendarEntry = {
  id: string;
  /** `YYYY-MM-DD`, local. */
  day: string;
  label: string;
  clientName: string | null;
  kind: "sent" | "scheduled";
  isTest: boolean;
};

export type SendCalendarProps = {
  /** The first of the month being drawn. */
  month: Date;
  entries: CalendarEntry[];
  /** Preserves the rest of the screen's state when the month changes. */
  hrefForMonth: (monthKey: string) => string;
  /** Today, so the current day can be marked. */
  today: string;
};

export function SendCalendar({
  month,
  entries,
  hrefForMonth,
  today,
}: SendCalendarProps) {
  const days = monthGrid(month);
  const byDay = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const list = byDay.get(entry.day) ?? [];
    list.push(entry);
    byDay.set(entry.day, list);
  }

  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <div
        className="flex flex-wrap items-center justify-between"
        style={{ gap: "var(--space-3)" }}
      >
        <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
          <Link
            href={hrefForMonth(monthKeyOf(previous))}
            aria-label={`Show ${monthLabel(previous)}`}
            className="inline-grid place-items-center"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "var(--radius-capsule)",
              background: "var(--fill-quiet)",
              border: "1px solid var(--stroke-hairline)",
              color: "var(--content-primary)",
            }}
          >
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <h3
            className="t-headline"
            style={{ margin: 0, color: "var(--content-primary)", minWidth: "180px" }}
          >
            {monthLabel(month)}
          </h3>
          <Link
            href={hrefForMonth(monthKeyOf(next))}
            aria-label={`Show ${monthLabel(next)}`}
            className="inline-grid place-items-center"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "var(--radius-capsule)",
              background: "var(--fill-quiet)",
              border: "1px solid var(--stroke-hairline)",
              color: "var(--content-primary)",
            }}
          >
            <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>

        <div className="flex items-center" style={{ gap: "var(--space-4)" }}>
          <Pill tone="nominal" dot>
            Sent
          </Pill>
          <Pill tone="neutral" dot>
            Scheduled
          </Pill>
        </div>
      </div>

      <table
        style={{
          width: "100%",
          tableLayout: "fixed",
          borderCollapse: "separate",
          borderSpacing: "var(--space-1)",
          fontFamily: "var(--font-text)",
        }}
      >
        <caption className="sr-only">
          Campaigns sent and scheduled in {monthLabel(month)}
        </caption>
        <thead>
          <tr>
            {WEEKDAYS.map((weekday) => (
              <th
                key={weekday}
                scope="col"
                className="t-overline"
                style={{
                  padding: "var(--space-2)",
                  textAlign: "left",
                  color: "var(--content-tertiary)",
                  fontWeight: 400,
                }}
              >
                {weekday}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, week) => (
            <tr key={week}>
              {days.slice(week * 7, week * 7 + 7).map((day) => {
                const key = `${day.getFullYear()}-${`${day.getMonth() + 1}`.padStart(
                  2,
                  "0",
                )}-${`${day.getDate()}`.padStart(2, "0")}`;
                const inMonth = day.getMonth() === month.getMonth();
                const items = byDay.get(key) ?? [];
                const isToday = key === today;

                return (
                  <td
                    key={key}
                    style={{
                      verticalAlign: "top",
                      height: "96px",
                      padding: "var(--space-2)",
                      borderRadius: "var(--radius-sm)",
                      background: inMonth ? "var(--fill-quiet)" : "transparent",
                      border: `1px solid ${
                        isToday ? "var(--stroke-focus)" : "var(--stroke-hairline)"
                      }`,
                      opacity: inMonth ? 1 : 0.45,
                    }}
                  >
                    <span
                      className="t-caption tabular"
                      style={{
                        display: "block",
                        color: isToday
                          ? "var(--content-primary)"
                          : "var(--content-tertiary)",
                        fontWeight: isToday ? 600 : 400,
                      }}
                    >
                      {day.getDate()}
                      {isToday ? <span className="sr-only"> (today)</span> : null}
                    </span>

                    <ul
                      className="flex flex-col"
                      style={{
                        gap: "2px",
                        margin: "var(--space-1) 0 0",
                        padding: 0,
                        listStyle: "none",
                      }}
                    >
                      {items.slice(0, 3).map((entry) => (
                        <li key={entry.id}>
                          <Link
                            href={`/campaigns/${entry.id}`}
                            className="t-micro"
                            style={{
                              display: "block",
                              padding: "2px var(--space-2)",
                              borderRadius: "var(--radius-capsule)",
                              background:
                                entry.kind === "sent"
                                  ? "color-mix(in oklab, var(--signal-nominal) 16%, transparent)"
                                  : "var(--fill-pressed)",
                              color:
                                entry.kind === "sent"
                                  ? "var(--signal-nominal)"
                                  : "var(--content-secondary)",
                              textDecoration: "none",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={`${entry.label}${
                              entry.clientName ? ` · ${entry.clientName}` : ""
                            } · ${entry.kind === "sent" ? "Sent" : "Scheduled"}`}
                          >
                            {entry.isTest ? "Test · " : ""}
                            {entry.label}
                          </Link>
                        </li>
                      ))}
                      {items.length > 3 ? (
                        <li
                          className="t-micro"
                          style={{ color: "var(--content-tertiary)" }}
                        >
                          +{items.length - 3} more
                        </li>
                      ) : null}
                    </ul>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
