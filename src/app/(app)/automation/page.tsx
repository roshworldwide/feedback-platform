import type { ReactNode } from "react";
import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { recordAudit } from "@/lib/audit";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { loadClients, type Loaded } from "@/app/(app)/overview/data";
import { dayKey } from "@/app/(app)/overview/periods";
import { LoadError } from "@/components/overview/load-error";
import {
  SendCalendar,
  type CalendarEntry,
} from "@/components/automation/calendar";
import {
  ReadinessQueue,
  type ReadinessCard,
} from "@/components/automation/readiness";
import { RuleList, type RuleRow } from "@/components/automation/rules";
import {
  SeriesTable,
  type SeriesTableRow,
} from "@/components/automation/series-table";
import {
  monthKeyOf,
  parseMonthKey,
  readinessOf,
  shiftMonth,
  type ActionState,
} from "@/components/automation/vocabulary";

export const metadata: Metadata = {
  title: "Automation",
  description:
    "Recurring series, the month ahead, what is ready to send, and the rules that watch for silence.",
};

type SearchParams = Record<string, string | string[] | undefined>;
type Db = Awaited<ReturnType<typeof createClient>>;

function firstParam(params: SearchParams, key: string): string | null {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "The database did not respond.";
}

/* ── Loaders. Each returns a result; none of them throws or guesses. ─────── */

type SeriesRecord = {
  id: string;
  name: string;
  frequency: string;
  templateKey: string;
  nextRunAt: string | null;
  isActive: boolean;
  clientId: string | null;
  ownerId: string | null;
};

async function loadSeries(supabase: Db): Promise<Loaded<SeriesRecord[]>> {
  try {
    const { data, error } = await supabase
      .from("report_series")
      .select("id, name, frequency, template_key, next_run_at, is_active, client_id, owner_id")
      .order("is_active", { ascending: false })
      .order("next_run_at", { ascending: true, nullsFirst: false });
    if (error) return { ok: false, message: error.message };

    const raw = (data ?? []) as unknown as Record<string, unknown>[];
    return {
      ok: true,
      value: raw.map((row) => ({
        id: text(row.id),
        name: text(row.name),
        frequency: text(row.frequency),
        templateKey: text(row.template_key),
        nextRunAt: textOrNull(row.next_run_at),
        isActive: row.is_active === true,
        clientId: textOrNull(row.client_id),
        ownerId: textOrNull(row.owner_id),
      })),
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

type ScheduleRecord = {
  id: string;
  title: string;
  reportNumber: string | null;
  status: string;
  sentAt: string | null;
  scheduledFor: string | null;
  clientId: string | null;
  isTest: boolean;
};

async function loadMonth(
  supabase: Db,
  month: Date,
): Promise<Loaded<ScheduleRecord[]>> {
  const from = month.toISOString();
  const to = shiftMonth(month, 1).toISOString();
  try {
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, title, report_number, status, sent_at, scheduled_for, client_id, is_test")
      .or(
        `and(sent_at.gte.${from},sent_at.lt.${to}),and(scheduled_for.gte.${from},scheduled_for.lt.${to})`,
      )
      .order("sent_at", { ascending: true, nullsFirst: false });
    if (error) return { ok: false, message: error.message };

    const raw = (data ?? []) as unknown as Record<string, unknown>[];
    return {
      ok: true,
      value: raw.map((row) => ({
        id: text(row.id),
        title: text(row.title),
        reportNumber: textOrNull(row.report_number),
        status: text(row.status),
        sentAt: textOrNull(row.sent_at),
        scheduledFor: textOrNull(row.scheduled_for),
        clientId: textOrNull(row.client_id),
        isTest: row.is_test === true,
      })),
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

type QueueRecord = {
  id: string;
  title: string;
  reportNumber: string | null;
  status: string;
  scheduledFor: string | null;
  bodyMd: string;
  reportUrl: string | null;
  clientId: string | null;
};

async function loadQueue(supabase: Db): Promise<Loaded<QueueRecord[]>> {
  try {
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, title, report_number, status, scheduled_for, body_md, report_url, client_id")
      .in("status", ["draft", "scheduled"])
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .limit(60);
    if (error) return { ok: false, message: error.message };

    const raw = (data ?? []) as unknown as Record<string, unknown>[];
    return {
      ok: true,
      value: raw.map((row) => ({
        id: text(row.id),
        title: text(row.title),
        reportNumber: textOrNull(row.report_number),
        status: text(row.status),
        scheduledFor: textOrNull(row.scheduled_for),
        bodyMd: text(row.body_md),
        reportUrl: textOrNull(row.report_url),
        clientId: textOrNull(row.client_id),
      })),
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

async function loadRules(supabase: Db): Promise<Loaded<RuleRow[]>> {
  try {
    const { data, error } = await supabase
      .from("automation_rules")
      .select("id, name, trigger, threshold, action, is_active")
      .order("created_at", { ascending: true });
    if (error) return { ok: false, message: error.message };

    const raw = (data ?? []) as unknown as Record<string, unknown>[];
    return {
      ok: true,
      value: raw.map((row) => ({
        id: text(row.id),
        name: text(row.name),
        trigger: text(row.trigger),
        threshold: num(row.threshold),
        action: text(row.action),
        isActive: row.is_active === true,
      })),
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

async function loadOwners(supabase: Db): Promise<Loaded<Record<string, string>>> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email");
    if (error) return { ok: false, message: error.message };

    const raw = (data ?? []) as unknown as Record<string, unknown>[];
    const names: Record<string, string> = {};
    for (const row of raw) {
      names[text(row.id)] = textOrNull(row.full_name) ?? text(row.email);
    }
    return { ok: true, value: names };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" description={description}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

export default async function AutomationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const month = parseMonthKey(firstParam(params, "month"));

  /* ── The two writing controls on this screen ───────────────────────────── */

  async function setSeriesActive(
    id: string,
    active: boolean,
  ): Promise<ActionState> {
    "use server";
    const profile = await getSessionProfile();
    if (!profile) {
      return { ok: false, message: "Your session has ended. Sign in again — nothing changed." };
    }

    const db = await createClient();
    const { error } = await db
      .from("report_series")
      .update({ is_active: active })
      .eq("id", id);
    if (error) return { ok: false, message: `Couldn't save that — ${error.message}` };

    await recordAudit({
      actorId: String(profile.id),
      actorEmail: String(profile.email),
      action: active ? "series.resumed" : "series.paused",
      entityType: "report_series",
      entityId: id,
      summary: active ? "Resumed a report series" : "Paused a report series",
    });

    revalidatePath("/automation");
    return { ok: true, message: null };
  }

  async function setRuleActive(id: string, active: boolean): Promise<ActionState> {
    "use server";
    const profile = await getSessionProfile();
    if (!profile) {
      return { ok: false, message: "Your session has ended. Sign in again — nothing changed." };
    }

    const db = await createClient();
    const { error } = await db
      .from("automation_rules")
      .update({ is_active: active })
      .eq("id", id);
    if (error) {
      return {
        ok: false,
        message: `Couldn't change the rule — ${error.message}. Only an admin or a team lead may edit rules.`,
      };
    }

    await recordAudit({
      actorId: String(profile.id),
      actorEmail: String(profile.email),
      action: active ? "rule.resumed" : "rule.paused",
      entityType: "automation_rules",
      entityId: id,
      summary: active ? "Resumed an automation rule" : "Paused an automation rule",
    });

    revalidatePath("/automation");
    return { ok: true, message: null };
  }

  /* ── Data ──────────────────────────────────────────────────────────────── */

  const supabase = await createClient();
  const [series, schedule, queue, rules, clients, owners] = await Promise.all([
    loadSeries(supabase),
    loadMonth(supabase, month),
    loadQueue(supabase),
    loadRules(supabase),
    loadClients(supabase),
    loadOwners(supabase),
  ]);

  const clientNames: Record<string, string> = {};
  if (clients.ok) {
    for (const client of clients.value) clientNames[client.clientId] = client.name;
  }
  const ownerNames = owners.ok ? owners.value : {};

  const seriesRows: SeriesTableRow[] = series.ok
    ? series.value.map((row) => ({
        id: row.id,
        name: row.name,
        clientName: row.clientId ? (clientNames[row.clientId] ?? null) : null,
        frequency: row.frequency,
        nextRunAt: row.nextRunAt,
        templateKey: row.templateKey,
        ownerName: row.ownerId ? (ownerNames[row.ownerId] ?? null) : null,
        isActive: row.isActive,
      }))
    : [];

  const entries: CalendarEntry[] = schedule.ok
    ? schedule.value.flatMap((row) => {
        const label = row.reportNumber ?? row.title ?? "Untitled report";
        const clientName = row.clientId ? (clientNames[row.clientId] ?? null) : null;
        const made: CalendarEntry[] = [];

        // A fact and a plan are different entries, never merged into one.
        if (row.sentAt) {
          const sent = new Date(row.sentAt);
          if (!Number.isNaN(sent.getTime())) {
            made.push({
              id: row.id,
              day: dayKey(sent),
              label,
              clientName,
              kind: "sent",
              isTest: row.isTest,
            });
          }
        } else if (row.scheduledFor) {
          const planned = new Date(row.scheduledFor);
          if (!Number.isNaN(planned.getTime())) {
            made.push({
              id: row.id,
              day: dayKey(planned),
              label,
              clientName,
              kind: "scheduled",
              isTest: row.isTest,
            });
          }
        }
        return made;
      })
    : [];

  const queueCards: ReadinessCard[] = queue.ok
    ? queue.value.map((row) => {
        const lane = readinessOf({
          status: row.status,
          bodyMd: row.bodyMd,
          reportUrl: row.reportUrl,
        });
        const missing: string[] = [];
        if (row.bodyMd.trim() === "") missing.push("no body written");
        if ((row.reportUrl ?? "").trim() === "") missing.push("no report link");

        return {
          id: row.id,
          label: row.reportNumber
            ? `${row.reportNumber} · ${row.title}`
            : row.title || "Untitled report",
          clientName: row.clientId ? (clientNames[row.clientId] ?? null) : null,
          scheduledFor: row.scheduledFor,
          lane,
          reason:
            lane === "needs_content"
              ? `Missing ${missing.join(" and ")}.`
              : lane === "needs_approval"
                ? "Written, but still a draft — it needs approving and scheduling."
                : "Content and link are in place; it goes out at the scheduled time.",
        };
      })
    : [];

  function hrefForMonth(monthKey: string): string {
    return monthKey === monthKeyOf(new Date())
      ? "/automation"
      : `/automation?month=${monthKey}`;
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
      <Panel
        title="Recurring series"
        description="What goes out on a cadence, to whom, and when it next runs. Pausing a series stops the next run; it never edits a report that has already been sent."
      >
        {series.ok ? (
          <>
            <SeriesTable rows={seriesRows} setActive={setSeriesActive} />
            {clients.ok && owners.ok ? null : (
              <p
                className="t-caption"
                style={{ margin: "var(--space-3) 0 0", color: "var(--content-tertiary)" }}
              >
                {!clients.ok
                  ? `Client names could not be read (${clients.message}). `
                  : ""}
                {!owners.ok ? `Owner names could not be read (${owners.message}).` : ""}
                {" "}Those columns say so rather than guessing.
              </p>
            )}
          </>
        ) : (
          <LoadError what="the recurring series" message={series.message} />
        )}
      </Panel>

      <Panel
        title="Calendar"
        description="Everything sent or scheduled in the month. A sent report is a fact; a scheduled one is a plan, and the two are drawn differently."
      >
        {schedule.ok ? (
          <SendCalendar
            month={month}
            entries={entries}
            hrefForMonth={hrefForMonth}
            today={dayKey(new Date())}
          />
        ) : (
          <LoadError what="the calendar" message={schedule.message} />
        )}
      </Panel>

      <Panel
        title="Readiness"
        description="Everything not yet sent, sorted by what is stopping it. The rule for each lane is printed under its name."
      >
        {queue.ok ? (
          <ReadinessQueue cards={queueCards} />
        ) : (
          <LoadError what="the readiness queue" message={queue.message} />
        )}
      </Panel>

      <Panel
        title="Rules"
        description="Each rule as one sentence. Pausing one stops it watching; it does not delete what it has already flagged."
      >
        {rules.ok ? (
          <RuleList rows={rules.value} setActive={setRuleActive} />
        ) : (
          <LoadError what="the automation rules" message={rules.message} />
        )}
      </Panel>
    </div>
  );
}
