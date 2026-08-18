/**
 * Automation vocabulary — frequencies, months, readiness and the sentences a
 * rule is read aloud as.
 *
 * A leaf module with no server imports, so the table, the calendar and the
 * query in `page.tsx` share one definition of every word on the screen.
 */

export const FREQUENCY_LABEL: Record<string, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  adhoc: "As needed",
};

export function frequencyLabel(value: string): string {
  return FREQUENCY_LABEL[value] ?? value;
}

/* ── Months ───────────────────────────────────────────────────────────────── */

export type MonthKey = string; // `YYYY-MM`

export function monthKeyOf(date: Date): MonthKey {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
}

export function parseMonthKey(value: string | null, now: Date = new Date()): Date {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    if (month >= 1 && month <= 12) return new Date(year, month - 1, 1);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function shiftMonth(first: Date, delta: number): Date {
  return new Date(first.getFullYear(), first.getMonth() + delta, 1);
}

export function monthLabel(first: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(first);
}

/** Monday-first weekday order, matching the calendar header. */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * The six-week grid a month is drawn in, always whole weeks, so the shape of
 * the calendar never changes between months.
 */
export function monthGrid(first: Date): Date[] {
  const start = new Date(first);
  // getDay() is Sunday-first; shift so Monday is column one.
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);

  const days: Date[] = [];
  for (let index = 0; index < 42; index++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }
  return days;
}

/* ── Readiness ────────────────────────────────────────────────────────────── */

export const READINESS_LANES = [
  {
    value: "ready",
    label: "Ready",
    rule: "Scheduled, with a body and a report link.",
  },
  {
    value: "needs_content",
    label: "Needs content",
    rule: "No body written, or no report link attached.",
  },
  {
    value: "needs_approval",
    label: "Needs approval",
    rule: "Written but still a draft — nobody has scheduled it.",
  },
] as const;

export type ReadinessLane = (typeof READINESS_LANES)[number]["value"];

/** The rule, stated once and applied once. */
export function readinessOf(campaign: {
  status: string;
  bodyMd: string;
  reportUrl: string | null;
}): ReadinessLane {
  const hasContent =
    campaign.bodyMd.trim().length > 0 && (campaign.reportUrl ?? "").trim().length > 0;
  if (!hasContent) return "needs_content";
  return campaign.status === "scheduled" ? "ready" : "needs_approval";
}

/* ── Rules, in words ──────────────────────────────────────────────────────── */

export type RuleSentence = {
  /** The condition, with the threshold set apart for emphasis. */
  leadIn: string;
  threshold: string;
  middle: string;
  action: string;
  tail: string;
};

const ACTION_PHRASE: Record<string, string> = {
  notify_owner: "the campaign owner",
  create_task: "a task for the owner",
  flag_at_risk: "the client as at risk",
};

const ACTION_VERB: Record<string, string> = {
  notify_owner: "notify",
  create_task: "create",
  flag_at_risk: "flag",
};

/**
 * A rule read as a sentence rather than as three columns of jargon. An
 * unrecognised trigger or action is stated verbatim — the screen says what the
 * row actually holds instead of quietly rendering a rule that does not exist.
 */
export function ruleSentence(rule: {
  trigger: string;
  threshold: number;
  action: string;
}): RuleSentence {
  const verb = ACTION_VERB[rule.action] ?? "run";
  const target = ACTION_PHRASE[rule.action] ?? rule.action;

  switch (rule.trigger) {
    case "no_open_after_days":
      return {
        leadIn: "If a campaign has no external open after",
        threshold: `${rule.threshold} ${rule.threshold === 1 ? "day" : "days"}`,
        middle: `, ${verb}`,
        action: target,
        tail: ".",
      };
    case "low_rating":
      return {
        leadIn: "If a report is rated",
        threshold: `${rule.threshold} or below`,
        middle: `, ${verb}`,
        action: target,
        tail: ".",
      };
    case "client_idle":
      return {
        leadIn: "If a client has had no report for",
        threshold: `${rule.threshold} ${rule.threshold === 1 ? "day" : "days"}`,
        middle: `, ${verb}`,
        action: target,
        tail: ".",
      };
    default:
      return {
        leadIn: `On ${rule.trigger} at`,
        threshold: String(rule.threshold),
        middle: `, ${verb}`,
        action: target,
        tail: ".",
      };
  }
}

export type ActionState = { ok: boolean; message: string | null };

export const IDLE_ACTION: ActionState = { ok: true, message: null };
