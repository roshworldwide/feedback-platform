import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { Card, CardBody, CardHeader, CardTitle, DarkModeToggle, FinishPicker } from "@/components/ui";
import { recordAudit } from "@/lib/audit";
import { internalDomains, serverEnv, env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { isInternalEmail } from "@/lib/utils";
import { type Loaded } from "@/app/(app)/overview/data";
import { LoadError } from "@/components/overview/load-error";
import { AuditPanel } from "@/components/settings/audit-panel";
import { DataPanel, type FileResult, type ImportResult } from "@/components/settings/data-panel";
import { SenderPanel } from "@/components/settings/sender-panel";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { settingsTabFrom } from "@/components/settings/settings-tabs-shared";
import { TeamPanel } from "@/components/settings/team-panel";
import {
  csvLine,
  type ActionState,
  type AuditEntryRow,
  type ImportRow,
  type SenderConfig,
  type TeamMember,
} from "@/components/settings/vocabulary";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "People, the sending identity, the finish, your data, and the record of who did what.",
};

type SearchParams = Record<string, string | string[] | undefined>;
type Db = Awaited<ReturnType<typeof createClient>>;

const AUDIT_PAGE_SIZE = 25;
const EXPORT_LIMIT = 5000;
const BACKUP_LIMIT = 5000;

function firstParam(params: SearchParams, key: string): string | null {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

/* ── Loaders ──────────────────────────────────────────────────────────────── */

async function loadTeam(supabase: Db): Promise<Loaded<TeamMember[]>> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, is_active, last_seen_at, created_at")
      .order("is_active", { ascending: false })
      .order("full_name", { ascending: true });
    if (error) return { ok: false, message: error.message };

    const raw = (data ?? []) as unknown as Record<string, unknown>[];
    return {
      ok: true,
      value: raw.map((row) => ({
        id: text(row.id),
        email: text(row.email),
        name: text(row.full_name),
        role: text(row.role),
        isActive: row.is_active === true,
        lastSeenAt: textOrNull(row.last_seen_at),
        createdAt: textOrNull(row.created_at),
      })),
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

type AuditPage = { rows: AuditEntryRow[]; total: number; actions: string[] };

async function loadAuditLog(
  supabase: Db,
  filters: { q: string; action: string | null; page: number },
): Promise<Loaded<AuditPage>> {
  try {
    let request = supabase
      .from("audit_log")
      .select("id, actor_email, action, entity_type, entity_id, summary, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(
        (filters.page - 1) * AUDIT_PAGE_SIZE,
        filters.page * AUDIT_PAGE_SIZE - 1,
      );

    if (filters.action) request = request.eq("action", filters.action);
    if (filters.q) {
      const term = filters.q.replace(/[%,()]/g, " ");
      request = request.or(
        `action.ilike.%${term}%,summary.ilike.%${term}%,actor_email.ilike.%${term}%`,
      );
    }

    const { data, error, count } = await request;
    if (error) return { ok: false, message: error.message };

    const raw = (data ?? []) as unknown as Record<string, unknown>[];
    const rows: AuditEntryRow[] = raw.map((row) => ({
      id: num(row.id),
      actor: textOrNull(row.actor_email) ?? "System",
      action: text(row.action),
      target: [text(row.entity_type), textOrNull(row.entity_id)]
        .filter(Boolean)
        .join(" · "),
      summary: text(row.summary),
      createdAt: textOrNull(row.created_at),
    }));

    // The action filter can only offer actions the log actually holds.
    const { data: actionData } = await supabase
      .from("audit_log")
      .select("action")
      .order("created_at", { ascending: false })
      .limit(500);
    const actions = [
      ...new Set(
        ((actionData ?? []) as unknown as Record<string, unknown>[]).map((row) =>
          text(row.action),
        ),
      ),
    ]
      .filter(Boolean)
      .sort();

    return { ok: true, value: { rows, total: count ?? rows.length, actions } };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

function readSenderConfig(): Loaded<SenderConfig> {
  try {
    const config = serverEnv();
    const from = config.EMAIL_FROM;
    const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
    const fromName = match ? match[1] : "Convin Data Labs";
    const mailbox = match ? match[2] : from;

    return {
      ok: true,
      value: {
        from,
        fromName,
        mailbox,
        replyTo: mailbox,
        signature:
          "Convin Data Labs\nReply to this email and it reaches the analyst who wrote the report.",
        internalDomains: internalDomains(),
        verified: Boolean(config.RESEND_API_KEY),
        appUrl: env.NEXT_PUBLIC_APP_URL,
      },
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tab = settingsTabFrom(firstParam(params, "tab"));
  const pageParam = Number(firstParam(params, "page") ?? 1);
  const auditFilters = {
    q: firstParam(params, "q") ?? "",
    action: firstParam(params, "action"),
    page: Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1,
  };

  /* ── Actions ───────────────────────────────────────────────────────────── */

  async function inviteMember(
    _state: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const fullName = String(formData.get("full_name") ?? "").trim();
    const role = String(formData.get("role") ?? "analyst");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, message: "That is not an email address, so no invitation was sent." };
    }
    if (!["admin", "team_lead", "analyst"].includes(role)) {
      return { ok: false, message: "That role does not exist, so no invitation was sent." };
    }

    const profile = await getSessionProfile();
    if (!profile) {
      return { ok: false, message: "Your session has ended. Sign in again — nothing was sent." };
    }
    if (String(profile.role) !== "admin") {
      return { ok: false, message: "Only an admin can invite someone. Nothing was sent." };
    }

    try {
      const admin = createAdminClient();
      const { error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
      });
      if (error) {
        return { ok: false, message: `Couldn't send the invitation — ${error.message}` };
      }

      const { error: roleError } = await admin
        .from("profiles")
        .update({ role, full_name: fullName })
        .eq("email", email);
      if (roleError) {
        return {
          ok: true,
          message: `Invitation sent to ${email}, but their role could not be set — ${roleError.message}. Set it once they accept.`,
        };
      }

      await recordAudit({
        actorId: String(profile.id),
        actorEmail: String(profile.email),
        action: "profile.invited",
        entityType: "profiles",
        entityId: email,
        summary: `Invited ${email} as ${role}`,
      });

      revalidatePath("/settings");
      return { ok: true, message: `Invitation sent to ${email}.` };
    } catch (error) {
      return { ok: false, message: `Couldn't send the invitation — ${messageOf(error)}` };
    }
  }

  async function setMemberActive(
    id: string,
    active: boolean,
  ): Promise<ActionState> {
    "use server";
    const profile = await getSessionProfile();
    if (!profile) {
      return { ok: false, message: "Your session has ended. Sign in again — nothing changed." };
    }
    if (String(profile.id) === id && !active) {
      return {
        ok: false,
        message: "You cannot deactivate your own account — ask another admin to do it.",
      };
    }

    const db = await createClient();
    const { error } = await db
      .from("profiles")
      .update({ is_active: active })
      .eq("id", id);
    if (error) {
      return {
        ok: false,
        message: `Couldn't change that account — ${error.message}. Only an admin may deactivate someone.`,
      };
    }

    await recordAudit({
      actorId: String(profile.id),
      actorEmail: String(profile.email),
      action: active ? "profile.reactivated" : "profile.deactivated",
      entityType: "profiles",
      entityId: id,
      summary: active ? "Reactivated an account" : "Deactivated an account",
    });

    revalidatePath("/settings");
    return {
      ok: true,
      message: active ? "That account can sign in again." : "That account no longer has access.",
    };
  }

  async function exportCampaigns(): Promise<FileResult> {
    "use server";
    const profile = await getSessionProfile();
    if (!profile) {
      return { ok: false, message: "Your session has ended. Sign in again — nothing was exported." };
    }

    const db = await createClient();
    const { data, error } = await db
      .from("campaign_stats")
      .select(
        "campaign_id, report_number, title, client_id, sent_at, recipients_external, delivered, bounced, unique_opens, unique_clicks, ratings, avg_rating, comments",
      )
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(EXPORT_LIMIT);
    if (error) return { ok: false, message: `Couldn't build the export — ${error.message}` };

    const { data: clientData } = await db.from("clients").select("id, name");
    const names: Record<string, string> = {};
    for (const row of (clientData ?? []) as unknown as Record<string, unknown>[]) {
      names[text(row.id)] = text(row.name);
    }

    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    const lines = [
      csvLine([
        "report_number",
        "title",
        "client",
        "sent_at",
        "recipients_external",
        "delivered",
        "bounced",
        "unique_opens",
        "unique_clicks",
        "ratings",
        "avg_rating",
        "comments",
      ]),
      ...rows.map((row) =>
        csvLine([
          textOrNull(row.report_number) ?? "",
          text(row.title),
          names[text(row.client_id)] ?? "",
          textOrNull(row.sent_at) ?? "",
          num(row.recipients_external),
          num(row.delivered),
          num(row.bounced),
          num(row.unique_opens),
          num(row.unique_clicks),
          num(row.ratings),
          numOrNull(row.avg_rating),
          num(row.comments),
        ]),
      ),
    ];

    await recordAudit({
      actorId: String(profile.id),
      actorEmail: String(profile.email),
      action: "data.exported",
      entityType: "campaign_stats",
      summary: `Exported ${rows.length} sent campaigns as CSV`,
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return {
      ok: true,
      filename: `convin-campaigns-${stamp}.csv`,
      mime: "text/csv;charset=utf-8",
      body: `${lines.join("\n")}\n`,
    };
  }

  async function backup(): Promise<FileResult> {
    "use server";
    const profile = await getSessionProfile();
    if (!profile) {
      return { ok: false, message: "Your session has ended. Sign in again — nothing was written." };
    }

    const db = await createClient();
    const [clients, contacts, series, campaigns] = await Promise.all([
      db.from("clients").select("id, name, slug, status, timezone, created_at"),
      db
        .from("contacts")
        .select("id, client_id, email, full_name, title, is_internal, is_active")
        .limit(BACKUP_LIMIT),
      db
        .from("report_series")
        .select("id, client_id, name, frequency, template_key, is_active, next_run_at"),
      db
        .from("campaigns")
        .select(
          "id, client_id, series_id, report_number, title, status, is_test, scheduled_for, sent_at",
        )
        .order("sent_at", { ascending: false })
        .limit(BACKUP_LIMIT),
    ]);

    const failure =
      clients.error ?? contacts.error ?? series.error ?? campaigns.error ?? null;
    if (failure) {
      return { ok: false, message: `Couldn't build the backup — ${failure.message}` };
    }

    const payload = {
      generated_at: new Date().toISOString(),
      generated_by: String(profile.email),
      note: `Clients, contacts, series and the most recent ${BACKUP_LIMIT} campaigns. Email events and ratings are not included.`,
      clients: clients.data ?? [],
      contacts: contacts.data ?? [],
      report_series: series.data ?? [],
      campaigns: campaigns.data ?? [],
    };

    await recordAudit({
      actorId: String(profile.id),
      actorEmail: String(profile.email),
      action: "data.backed_up",
      entityType: "backup",
      summary: "Downloaded a backup of clients, contacts, series and campaigns",
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return {
      ok: true,
      filename: `convin-backup-${stamp}.json`,
      mime: "application/json",
      body: JSON.stringify(payload, null, 2),
    };
  }

  async function importContacts(rows: ImportRow[]): Promise<ImportResult> {
    "use server";
    const profile = await getSessionProfile();
    if (!profile) {
      return { ok: false, message: "Your session has ended. Sign in again — nothing was written." };
    }
    if (rows.length === 0) {
      return { ok: false, message: "That file has no usable line in it, so nothing was written." };
    }

    const db = await createClient();
    const slugs = [...new Set(rows.map((row) => row.clientSlug))];
    const { data: clientData, error: clientError } = await db
      .from("clients")
      .select("id, slug")
      .in("slug", slugs);
    if (clientError) {
      return { ok: false, message: `Couldn't read the clients — ${clientError.message}` };
    }

    const bySlug: Record<string, string> = {};
    for (const row of (clientData ?? []) as unknown as Record<string, unknown>[]) {
      bySlug[text(row.slug).toLowerCase()] = text(row.id);
    }

    const domains = internalDomains();
    const failed: { line: number; email: string; reason: string }[] = [];
    const payload: Record<string, unknown>[] = [];

    for (const row of rows) {
      const clientId = bySlug[row.clientSlug];
      if (!clientId) {
        failed.push({
          line: row.line,
          email: row.email,
          reason: `No client with the slug "${row.clientSlug}".`,
        });
        continue;
      }
      payload.push({
        client_id: clientId,
        email: row.email,
        full_name: row.fullName,
        title: row.title,
        is_internal: isInternalEmail(row.email, domains),
      });
    }

    let inserted = 0;
    if (payload.length > 0) {
      const { data, error } = await db
        .from("contacts")
        .upsert(payload, { onConflict: "client_id,email", ignoreDuplicates: true })
        .select("id");
      if (error) {
        return { ok: false, message: `Couldn't write the contacts — ${error.message}` };
      }
      inserted = (data ?? []).length;
    }

    await recordAudit({
      actorId: String(profile.id),
      actorEmail: String(profile.email),
      action: "contacts.imported",
      entityType: "contacts",
      summary: `Imported ${inserted} contacts from a CSV`,
      diff: { attempted: rows.length, inserted, failed: failed.length },
    });

    revalidatePath("/settings");
    return {
      ok: true,
      outcome: {
        inserted,
        skipped: payload.length - inserted,
        failed,
      },
    };
  }

  /* ── Data ──────────────────────────────────────────────────────────────── */

  const supabase = await createClient();
  const viewer = await getSessionProfile();
  const [team, audit] = await Promise.all([
    loadTeam(supabase),
    loadAuditLog(supabase, auditFilters),
  ]);
  const sender = readSenderConfig();
  const canManage = String(viewer?.role ?? "") === "admin";

  return (
    <Card>
      <CardHeader>
        <CardTitle
          as="h2"
          description="People, the sending identity, the finish, your data, and the record of who did what."
        >
          Settings
        </CardTitle>
      </CardHeader>
      <CardBody>
        <SettingsTabs
          tab={tab}
          teamCount={team.ok ? team.value.length : null}
          auditCount={audit.ok ? audit.value.total : null}
          team={
            team.ok ? (
              <TeamPanel
                members={team.value}
                canManage={canManage}
                invite={inviteMember}
                setActive={setMemberActive}
              />
            ) : (
              <LoadError what="the team" message={team.message} />
            )
          }
          sender={
            <SenderPanel
              config={sender.ok ? sender.value : null}
              reason={sender.ok ? null : sender.message}
            />
          }
          appearance={
            <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
              <div
                className="flex flex-wrap items-center justify-between"
                style={{ gap: "var(--space-4)" }}
              >
                <p
                  className="t-subhead prose-measure"
                  style={{ margin: 0, color: "var(--content-secondary)" }}
                >
                  A finish changes the token layer and nothing else — not one
                  dimension, radius or duration moves. Each swatch below is
                  drawn in the finish it advertises, so the preview is the real
                  thing rather than a painting of it.
                </p>
                <DarkModeToggle />
              </div>
              <FinishPicker label="Finish" />
              <p
                className="t-caption"
                style={{ margin: 0, color: "var(--content-tertiary)" }}
              >
                Your choice is remembered in this browser only. It does not
                change what anybody else sees, and it never changes what a
                client receives by email.
              </p>
            </div>
          }
          data={
            <DataPanel
              exportCampaigns={exportCampaigns}
              backup={backup}
              importContacts={importContacts}
            />
          }
          audit={
            audit.ok ? (
              <AuditPanel
                rows={audit.value.rows}
                total={audit.value.total}
                pageSize={AUDIT_PAGE_SIZE}
                filters={auditFilters}
                actions={audit.value.actions}
              />
            ) : (
              <LoadError
                what="the audit log"
                message={audit.message}
                next="Only admins and team leads may read the log. If that is your role, reload the page and tell an admin what this panel says."
              />
            )
          }
        />
      </CardBody>
    </Card>
  );
}
