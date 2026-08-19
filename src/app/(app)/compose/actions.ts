"use server";

/**
 * Everything Compose writes.
 *
 * Three rules govern this file and none of them is negotiable.
 *
 * 1. A campaign is created with `client_id` set to a real `clients` row. The
 *    column is NOT NULL and a foreign key, and the check below refuses before
 *    the database has to — v1 wrote the client as free text and lost a third of
 *    its attribution to typos and case.
 * 2. `is_internal` is snapshotted per recipient from the contact row at send
 *    time, read from the database rather than trusted from the browser. A
 *    contact reclassified next month must not rewrite what this send counted.
 * 3. The preview and the send call the same `renderReportEmail`. There is one
 *    renderer. A second one is how a preview comes to lie.
 *
 * Recipient rows and delivery results are written with the service role, which
 * is the only writer `campaign_recipients` has — RLS grants staff read and
 * nothing else, because a delivery outcome is a fact the system records, not a
 * row a browser session may author.
 */

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { renderReportEmail } from "@/lib/email/render";
import { emailProvider, sendEmail } from "@/lib/email/send";
import { env, internalDomains } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { isInternalEmail } from "@/lib/utils";
import { scoreboardFor, scoreboardMarkdown } from "@/lib/queries/drafts";
import {
  blockingFailures,
  isEmailShaped,
  parseComposeDoc,
  preflight,
  zonedToUtcISO,
  type ActionResult,
  type ComposeDoc,
  type RecipientChoice,
  type RenderedPreview,
  type SavedDraft,
  type SentCampaign,
} from "@/components/compose/vocabulary";

/* ── Shared plumbing ──────────────────────────────────────────────────────── */

type Row = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function failed(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function reasonOf(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim() !== "") return message;
  }
  return "the database gave no reason";
}

type Actor = { id: string; email: string; fullName: string; role: string };

async function actor(): Promise<Actor | null> {
  const profile = await getSessionProfile();
  if (!profile) return null;
  return {
    id: String(profile.id),
    email: String(profile.email),
    fullName: String(profile.full_name ?? ""),
    role: String(profile.role),
  };
}

const NO_SESSION =
  "Your session is no longer active, so nothing was saved. Sign in again — everything you typed is still on screen.";

const ROLE_TITLE: Record<string, string> = {
  admin: "Head of Client Reporting",
  team_lead: "Client Reporting Lead",
  analyst: "Reporting Analyst",
};

/** A hex-shaped token that resolves to no recipient. Preview links are inert. */
const PREVIEW_TOKEN = "0".repeat(48);

/* ── Draft library ────────────────────────────────────────────────────────── */

/**
 * The write only — no `revalidatePath`. Next.js refuses a cache revalidation
 * triggered synchronously during a Server Component's own render, which is
 * exactly how `/compose` creates a fresh draft when a person has none: it
 * calls this from inside its render, not from a client interaction. That
 * redirect already lands on a brand-new URL, which renders fresh regardless
 * — nothing here needs the router cache invalidated to be seen.
 */
async function insertDraft(
  name: string,
  clientId: string | null,
): Promise<{ id: string; name: string; updatedAt: string; ownerId: string; ownerEmail: string }> {
  const person = await actor();
  if (!person) throw new Error(NO_SESSION);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drafts")
    .insert({
      name,
      client_id: clientId,
      owner_id: person.id,
      payload: { clientId },
    })
    .select("id, name, updated_at")
    .single();

  if (error) throw new Error(error.message);

  const row = data as unknown as Row;
  return {
    id: str(row.id),
    name: str(row.name),
    updatedAt: str(row.updated_at),
    ownerId: person.id,
    ownerEmail: person.email,
  };
}

/** Used only from a Server Component render — see `insertDraft`. */
export async function createDraftForRedirect(
  name: string,
  clientId: string | null,
): Promise<ActionResult<SavedDraft>> {
  const trimmed = name.trim() || "Untitled draft";
  try {
    const created = await insertDraft(trimmed, clientId);
    await recordAudit({
      actorId: created.ownerId,
      actorEmail: created.ownerEmail,
      action: "draft.created",
      entityType: "drafts",
      entityId: created.id,
      summary: `Started ${trimmed}`,
    });
    return { ok: true, data: { id: created.id, name: created.name, updatedAt: created.updatedAt } };
  } catch (cause) {
    return failed(`The draft was not created — ${reasonOf(cause)}. Nothing was changed.`);
  }
}

/** Client-triggered — the "New draft" sheet in the library. */
export async function createDraftAction(
  name: string,
  clientId: string | null,
): Promise<ActionResult<SavedDraft>> {
  const trimmed = name.trim();
  if (trimmed === "") {
    return failed("A draft needs a name so you can find it again. Add one and try again.");
  }

  try {
    const created = await insertDraft(trimmed, clientId);
    await recordAudit({
      actorId: created.ownerId,
      actorEmail: created.ownerEmail,
      action: "draft.created",
      entityType: "drafts",
      entityId: created.id,
      summary: `Started ${trimmed}`,
    });

    revalidatePath("/compose/drafts");
    return {
      ok: true,
      data: { id: created.id, name: created.name, updatedAt: created.updatedAt },
    };
  } catch (cause) {
    return failed(`The draft was not created — ${reasonOf(cause)}. Nothing was changed.`);
  }
}

/**
 * Persists the whole document. Called on every step change, so a refresh, a
 * shared link or a closed tab all resume exactly where the author left off.
 */
export async function saveDraftAction(
  id: string,
  name: string,
  doc: ComposeDoc,
): Promise<ActionResult<SavedDraft>> {
  if (!id) {
    return failed(
      "This form lost the draft it belongs to. Reload the page — nothing was saved.",
    );
  }

  const parsed = parseComposeDoc(doc);
  const trimmed = name.trim() || "Untitled draft";

  try {
    const person = await actor();
    if (!person) return failed(NO_SESSION);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("drafts")
      .update({
        name: trimmed,
        client_id: parsed.clientId,
        series_id: parsed.seriesId,
        payload: parsed,
      })
      .eq("id", id)
      .select("id, name, updated_at")
      .maybeSingle();

    if (error) {
      return failed(
        `The draft was not saved — ${error.message}. Everything you typed is still on screen.`,
      );
    }
    if (!data) {
      return failed(
        "This draft belongs to someone else, so the change was not saved. Duplicate it to make your own copy — nothing you typed was lost.",
      );
    }

    const row = data as unknown as Row;
    revalidatePath("/compose");
    revalidatePath(`/compose/${id}`);
    return {
      ok: true,
      data: { id: str(row.id), name: str(row.name), updatedAt: str(row.updated_at) },
    };
  } catch (cause) {
    return failed(
      `The draft was not saved — ${reasonOf(cause)}. Everything you typed is still on screen.`,
    );
  }
}

export async function duplicateDraftAction(
  id: string,
): Promise<ActionResult<SavedDraft>> {
  try {
    const person = await actor();
    if (!person) return failed(NO_SESSION);

    const supabase = await createClient();
    const { data: source, error: readError } = await supabase
      .from("drafts")
      .select("name, client_id, series_id, payload")
      .eq("id", id)
      .maybeSingle();

    if (readError) {
      return failed(`The draft was not duplicated — ${readError.message}.`);
    }
    if (!source) {
      return failed("That draft no longer exists, so there was nothing to duplicate.");
    }

    const row = source as unknown as Row;
    const { data, error } = await supabase
      .from("drafts")
      .insert({
        name: `${str(row.name) || "Untitled draft"} (copy)`,
        client_id: nullableStr(row.client_id),
        series_id: nullableStr(row.series_id),
        payload: row.payload ?? {},
        owner_id: person.id,
      })
      .select("id, name, updated_at")
      .single();

    if (error) {
      return failed(`The draft was not duplicated — ${error.message}.`);
    }

    const created = data as unknown as Row;
    await recordAudit({
      actorId: person.id,
      actorEmail: person.email,
      action: "draft.duplicated",
      entityType: "drafts",
      entityId: str(created.id),
      summary: `Duplicated ${str(row.name)}`,
      diff: { from: id },
    });

    revalidatePath("/compose");
    return {
      ok: true,
      data: {
        id: str(created.id),
        name: str(created.name),
        updatedAt: str(created.updated_at),
      },
    };
  } catch (cause) {
    return failed(`The draft was not duplicated — ${reasonOf(cause)}.`);
  }
}

/**
 * A starter is a seeded reference — visible to everyone, writable by no one
 * (RLS refuses the update/delete outright, whoever the row's `owner_id`
 * happens to be). Opening one never edits the starter itself: it creates a
 * personal copy owned by whoever opened it and hands back that copy's id,
 * so the caller lands in an editor they can actually type in.
 *
 * The write only — no `revalidatePath`. See `insertDraft` above: the render
 * that lands directly on a starter's URL calls this from inside itself.
 */
async function copyStarter(
  id: string,
): Promise<{ id: string; name: string; updatedAt: string; ownerId: string; ownerEmail: string }> {
  const person = await actor();
  if (!person) throw new Error(NO_SESSION);

  const supabase = await createClient();
  const { data: source, error: readError } = await supabase
    .from("drafts")
    .select("name, client_id, series_id, payload, is_starter")
    .eq("id", id)
    .eq("is_starter", true)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (!source) throw new Error("That template no longer exists, so nothing was opened.");

  const row = source as unknown as Row;
  const { data, error } = await supabase
    .from("drafts")
    .insert({
      name: str(row.name) || "Untitled draft",
      client_id: nullableStr(row.client_id),
      series_id: nullableStr(row.series_id),
      payload: row.payload ?? {},
      owner_id: person.id,
    })
    .select("id, name, updated_at")
    .single();

  if (error) throw new Error(error.message);

  const created = data as unknown as Row;
  return {
    id: str(created.id),
    name: str(created.name),
    updatedAt: str(created.updated_at),
    ownerId: person.id,
    ownerEmail: person.email,
  };
}

async function auditStarterCopy(created: {
  id: string;
  ownerId: string;
  ownerEmail: string;
}, sourceId: string, sourceName: string) {
  await recordAudit({
    actorId: created.ownerId,
    actorEmail: created.ownerEmail,
    action: "draft.started_from_template",
    entityType: "drafts",
    entityId: created.id,
    summary: `Started ${sourceName} from the template gallery`,
    diff: { from: sourceId },
  });
}

/** Used only from a Server Component render — see `copyStarter`. */
export async function openStarterForRedirect(id: string): Promise<ActionResult<SavedDraft>> {
  try {
    const created = await copyStarter(id);
    await auditStarterCopy(created, id, created.name);
    return { ok: true, data: { id: created.id, name: created.name, updatedAt: created.updatedAt } };
  } catch (cause) {
    return failed(`That template could not be opened — ${reasonOf(cause)}.`);
  }
}

/** Client-triggered — "Use this template" in the library. */
export async function openStarterAction(id: string): Promise<ActionResult<SavedDraft>> {
  try {
    const created = await copyStarter(id);
    await auditStarterCopy(created, id, created.name);

    revalidatePath("/compose/drafts");
    return { ok: true, data: { id: created.id, name: created.name, updatedAt: created.updatedAt } };
  } catch (cause) {
    return failed(`That template could not be opened — ${reasonOf(cause)}.`);
  }
}

export async function deleteDraftAction(id: string): Promise<ActionResult<string>> {
  try {
    const person = await actor();
    if (!person) return failed(NO_SESSION);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("drafts")
      .delete()
      .eq("id", id)
      .select("id, name");

    if (error) {
      return failed(`The draft was not deleted — ${error.message}. Nothing was changed.`);
    }
    const rows = (data ?? []) as unknown as Row[];
    if (rows.length === 0) {
      return failed(
        "This draft belongs to someone else, so it was not deleted. Ask its owner, or a team lead, to remove it.",
      );
    }

    await recordAudit({
      actorId: person.id,
      actorEmail: person.email,
      action: "draft.deleted",
      entityType: "drafts",
      entityId: id,
      summary: `Deleted ${str(rows[0].name)}`,
    });

    revalidatePath("/compose");
    return { ok: true, data: id };
  } catch (cause) {
    return failed(`The draft was not deleted — ${reasonOf(cause)}. Nothing was changed.`);
  }
}

/* ── Content-step helpers ─────────────────────────────────────────────────── */

export async function suggestReportNumberAction(
  clientId: string,
  seriesId: string | null,
): Promise<ActionResult<string | null>> {
  if (!clientId) {
    return failed("Pick a client first — DL numbers run per client, not globally.");
  }
  const { suggestReportNumber } = await import("@/lib/queries/drafts");
  const result = await suggestReportNumber(clientId, seriesId);
  return result.ok
    ? { ok: true, data: result.data }
    : failed(`Couldn't read the numbers already used — ${result.reason}. Type one instead.`);
}

export async function createSeriesAction(
  clientId: string,
  name: string,
  frequency: string,
): Promise<ActionResult<{ id: string; name: string; frequency: string }>> {
  const trimmed = name.trim();
  if (!clientId) return failed("Pick a client before creating a series for it.");
  if (trimmed === "") return failed("A series needs a name. Add one and try again.");

  const allowed = ["weekly", "fortnightly", "monthly", "quarterly", "adhoc"];
  const cadence = allowed.includes(frequency) ? frequency : "monthly";

  try {
    const person = await actor();
    if (!person) return failed(NO_SESSION);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("report_series")
      .insert({
        client_id: clientId,
        name: trimmed,
        frequency: cadence,
        owner_id: person.id,
      })
      .select("id, name, frequency")
      .single();

    if (error) {
      const duplicate = error.code === "23505";
      return failed(
        duplicate
          ? `This client already has a series called ${trimmed}. Choose it from the list instead.`
          : `The series was not created — ${error.message}.`,
      );
    }

    const row = data as unknown as Row;
    revalidatePath("/automation");
    return {
      ok: true,
      data: { id: str(row.id), name: str(row.name), frequency: str(row.frequency) },
    };
  } catch (cause) {
    return failed(`The series was not created — ${reasonOf(cause)}.`);
  }
}

/* ── Media ────────────────────────────────────────────────────────────────── */

const MEDIA_BUCKET = "report-media";

/**
 * Uploads an image or an attachment and returns the address the email will
 * carry. An email client fetches an image from a public URL, so a file that
 * only exists on the author's laptop cannot be sent — which is why the form
 * offers a link as an equal path rather than as a fallback.
 *
 * If the bucket is not configured the failure says exactly that and points at
 * the link field. It never leaves a half-attached file behind.
 */
export async function uploadMediaAction(
  form: FormData,
): Promise<ActionResult<{ url: string; name: string; sizeBytes: number }>> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return failed("No file was received, so nothing was uploaded. Choose one and try again.");
  }
  if (file.size > 20 * 1024 * 1024) {
    return failed(
      `${file.name} is over 20 MB, which most inboxes reject. Link it from the report instead.`,
    );
  }

  try {
    const person = await actor();
    if (!person) return failed(NO_SESSION);

    const supabase = await createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120);
    const path = `${person.id}/${Date.now().toString(36)}-${safeName}`;

    const { error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });

    if (error) {
      return failed(
        `${file.name} was not uploaded — ${error.message}. Paste a public link to the file instead; nothing else changed.`,
      );
    }

    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    const url = str((data as unknown as Row)?.publicUrl);
    if (url === "") {
      return failed(
        `${file.name} uploaded but has no public address, so an inbox could not fetch it. Paste a public link instead.`,
      );
    }

    return { ok: true, data: { url, name: file.name, sizeBytes: file.size } };
  } catch (cause) {
    return failed(
      `${file.name} was not uploaded — ${reasonOf(cause)}. Paste a public link instead.`,
    );
  }
}

/* ── Recipients ───────────────────────────────────────────────────────────── */

export async function loadRecipientsAction(
  clientId: string,
): Promise<ActionResult<RecipientChoice[]>> {
  if (!clientId) return failed("Pick a client to see its contacts.");

  const { listClientContacts } = await import("@/lib/queries/clients");
  const result = await listClientContacts(clientId);
  if (!result.ok) {
    return failed(
      `Couldn't load this client's contacts — ${result.reason}. Nothing was changed.`,
    );
  }

  return {
    ok: true,
    data: result.data.rows.map((contact) => ({
      key: contact.id,
      contactId: contact.id,
      email: contact.email,
      fullName: contact.fullName,
      title: contact.title,
      isInternal: contact.isInternal,
      bouncedAt: contact.bouncedAt,
      isActive: contact.isActive,
    })),
  };
}

/* ── One renderer, two callers ────────────────────────────────────────────── */

type RenderContext = {
  clientName: string;
  contactFirstName: string;
  token: string;
  isTest: boolean;
  signature: { name: string; title: string; org: string; replyTo: string | null };
  scoreboardMd: string;
};

function firstNameOf(fullName: string, email: string): string {
  const trimmed = fullName.trim();
  if (trimmed !== "") return trimmed.split(/\s+/)[0];
  const local = email.split("@")[0] ?? "";
  return local.split(/[._-]/)[0] ?? "";
}

/**
 * The single entry point to `renderReportEmail`. Preview, test send and real
 * send all pass through here, so what an author scrutinises on the Review step
 * is the byte-for-byte document a recipient receives — the only differences are
 * the recipient's own name and their tracking token.
 */
function renderFor(doc: ComposeDoc, context: RenderContext) {
  const body = [doc.bodyMd.trim(), context.scoreboardMd].filter(Boolean).join("\n\n");

  return renderReportEmail({
    templateKey: doc.templateKey,
    appUrl: env.NEXT_PUBLIC_APP_URL,
    token: context.token,
    clientName: context.clientName,
    contactFirstName: context.contactFirstName,
    reportNumber: doc.reportNumber.trim() || null,
    reportTitle: doc.title,
    periodLabel: doc.periodLabel,
    subject: doc.subject,
    bodyMd: body,
    reportUrl: doc.reportUrl.trim() || null,
    images: doc.images
      .filter((image) => image.url.trim() !== "")
      .map((image) => ({ url: image.url.trim(), caption: image.caption })),
    attachment: doc.attachment
      ? { name: doc.attachment.name, url: doc.attachment.url || null }
      : null,
    feedback: {
      enabled: doc.feedbackEnabled,
      question: doc.feedbackQuestion,
      askComment: doc.feedbackAskComment,
    },
    signature: context.signature,
    isTest: context.isTest,
  });
}

function signatureFor(person: Actor) {
  return {
    name: person.fullName || person.email,
    title: ROLE_TITLE[person.role] ?? "Client Reporting",
    org: "Convin Data Labs",
    replyTo: person.email,
  };
}

async function clientNameFor(clientId: string | null): Promise<string | null> {
  if (!clientId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .maybeSingle();
  if (error || !data) return null;
  return str((data as unknown as Row).name) || null;
}

async function scoreboardFrom(doc: ComposeDoc): Promise<string> {
  if (!doc.scoreboardEnabled || !doc.clientId) return "";
  const result = await scoreboardFor(doc.clientId);
  // A scoreboard that cannot be read is omitted rather than invented. The
  // Review step states that it was omitted; it never prints a row of dashes.
  return result.ok ? scoreboardMarkdown(result.data) : "";
}

export async function previewEmailAction(
  doc: ComposeDoc,
): Promise<ActionResult<RenderedPreview>> {
  const parsed = parseComposeDoc(doc);

  try {
    const person = await actor();
    if (!person) return failed(NO_SESSION);

    const clientName = await clientNameFor(parsed.clientId);
    if (!clientName) {
      return failed(
        "The preview needs a client, because the email says who it was prepared for. Pick one on the Content step.",
      );
    }

    const scoreboardMd = await scoreboardFrom(parsed);
    const rendered = renderFor(parsed, {
      clientName,
      contactFirstName: firstNameOf(person.fullName, person.email),
      token: PREVIEW_TOKEN,
      isTest: false,
      signature: signatureFor(person),
      scoreboardMd,
    });

    return {
      ok: true,
      data: {
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        scoreboardIncluded: scoreboardMd !== "",
      },
    };
  } catch (cause) {
    return failed(
      `The preview could not be built — ${reasonOf(cause)}. Nothing was changed.`,
    );
  }
}

/**
 * `testEmail` lets the sender pick any address for the test copy — not just
 * their own. It's still unconditionally safe: whatever address is given,
 * this writes no campaign and no recipient row, so it can never reach a
 * reported figure. A blank or missing value falls back to the signed-in
 * person's own address, same as before.
 */
export async function sendTestAction(doc: ComposeDoc, testEmail?: string): Promise<ActionResult<string>> {
  const parsed = parseComposeDoc(doc);

  try {
    const person = await actor();
    if (!person) return failed(NO_SESSION);
    if (parsed.subject.trim() === "") {
      return failed("A test send still needs a subject. Add one on the Content step.");
    }

    const to = testEmail?.trim() || person.email;
    if (!isEmailShaped(to)) {
      return failed("That doesn't look like an email address. Fix it and try again.");
    }

    const clientName = await clientNameFor(parsed.clientId);
    if (!clientName) {
      return failed("Pick a client first — the test copy says who it was prepared for.");
    }

    const rendered = renderFor(parsed, {
      clientName,
      contactFirstName: firstNameOf(person.fullName, person.email),
      token: PREVIEW_TOKEN,
      isTest: true,
      signature: signatureFor(person),
      scoreboardMd: await scoreboardFrom(parsed),
    });

    const result = await sendEmail({
      to,
      subject: `[Test] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
      replyTo: person.email,
      headers: { ...rendered.headers, "X-CDL-Test": "1" },
    });

    if (!result.ok) {
      return failed(
        `The test was not sent — ${result.error}. Nothing about the draft changed.`,
      );
    }

    // A test send writes no campaign and no recipient, so it can never reach a
    // reported figure. v1 recorded test sends as campaigns and then never
    // filtered them, and one two-person test defined a whole dashboard.
    return { ok: true, data: to };
  } catch (cause) {
    return failed(`The test was not sent — ${reasonOf(cause)}. Nothing was changed.`);
  }
}

/* ── Send ─────────────────────────────────────────────────────────────────── */

type ResolvedRecipient = {
  contactId: string | null;
  email: string;
  fullName: string;
  /** Read from the contact row here, never from the browser. */
  isInternal: boolean;
};

async function resolveRecipients(
  doc: ComposeDoc,
  clientId: string,
): Promise<{ people: ResolvedRecipient[]; choices: RecipientChoice[] } | string> {
  const supabase = await createClient();

  let contacts: Row[] = [];
  if (doc.contactIds.length > 0) {
    // `is_active = false` is a hard stop, not a filter the UI merely hides —
    // a spam complaint or an unsubscribe must actually block a send, even
    // against a stale `contactIds` selection made before the person left
    // the list.
    const { data, error } = await supabase
      .from("contacts")
      .select("id, client_id, email, full_name, title, is_internal, is_active, bounced_at")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .in("id", doc.contactIds);
    if (error) return `the contacts could not be read — ${error.message}`;
    contacts = (data ?? []) as unknown as Row[];
  }

  const domains = internalDomains();
  const byEmail = new Map<string, ResolvedRecipient>();
  const choices: RecipientChoice[] = [];

  for (const row of contacts) {
    const email = str(row.email).trim().toLowerCase();
    if (email === "") continue;
    byEmail.set(email, {
      contactId: str(row.id),
      email,
      fullName: str(row.full_name),
      isInternal: row.is_internal === true,
    });
    choices.push({
      key: str(row.id),
      contactId: str(row.id),
      email,
      fullName: str(row.full_name),
      title: str(row.title),
      isInternal: row.is_internal === true,
      bouncedAt: nullableStr(row.bounced_at),
      isActive: row.is_active !== false,
    });
  }

  for (const person of doc.adHoc) {
    const email = person.email.trim().toLowerCase();
    if (email === "") continue;
    // An address on an internal domain is internal whatever the box said, so
    // our own team's clicks can never be counted as client engagement.
    const internal = person.isInternal || isInternalEmail(email, domains);
    if (!byEmail.has(email)) {
      byEmail.set(email, {
        contactId: null,
        email,
        fullName: person.fullName,
        isInternal: internal,
      });
      choices.push({
        key: `adhoc:${email}`,
        contactId: null,
        email,
        fullName: person.fullName,
        title: "",
        isInternal: internal,
        bouncedAt: null,
        isActive: true,
      });
    }
  }

  return { people: [...byEmail.values()], choices };
}

function scheduledInstant(doc: ComposeDoc): string | null {
  if (doc.scheduledDate === "" || doc.scheduledTime === "") return null;
  return zonedToUtcISO(doc.scheduledDate, doc.scheduledTime, doc.timezone);
}

export async function sendCampaignAction(
  doc: ComposeDoc,
  draftId: string,
): Promise<ActionResult<SentCampaign>> {
  const parsed = parseComposeDoc(doc);

  // Rule 1, stated in the UI and enforced again here. `campaigns.client_id` is
  // NOT NULL, so a campaign without a client cannot exist — this refuses first
  // so the author gets a sentence instead of a constraint violation.
  if (!parsed.clientId) {
    return failed(
      "This report has no client, so no campaign was created. Pick one on the Content step — a campaign cannot exist without a client record.",
    );
  }

  try {
    const person = await actor();
    if (!person) return failed(NO_SESSION);

    const clientName = await clientNameFor(parsed.clientId);
    if (!clientName) {
      return failed(
        "That client record could not be read, so nothing was sent. Reload the page and pick the client again.",
      );
    }

    const resolved = await resolveRecipients(parsed, parsed.clientId);
    if (typeof resolved === "string") {
      return failed(`Nothing was sent — ${resolved}. The draft is untouched.`);
    }
    if (resolved.people.length === 0) {
      return failed(
        "Nobody is selected, so nothing was sent. Choose recipients on the Recipients step.",
      );
    }

    // The same checklist the Review step renders, re-run against the recipients
    // the database actually returned. A send cannot pass a rule the screen
    // showed as failing.
    const failures = blockingFailures(preflight(parsed, resolved.choices));
    if (failures.length > 0) {
      return failed(
        `Nothing was sent — ${failures[0].detail} ${
          failures.length > 1 ? `${failures.length - 1} more check also failed.` : ""
        }`.trim(),
      );
    }

    const usable = resolved.people.filter((entry) => isEmailShaped(entry.email));
    if (usable.length === 0) {
      return failed("None of the selected addresses is usable, so nothing was sent.");
    }

    const scheduleWanted = parsed.sendMode !== "now";
    const scheduledFor = scheduleWanted ? scheduledInstant(parsed) : null;
    if (scheduleWanted && !scheduledFor) {
      return failed(
        "That date and time could not be read, so nothing was scheduled. Set both, then choose a timezone.",
      );
    }
    if (parsed.sendMode === "series" && !parsed.seriesId) {
      return failed(
        "Adding to a recurring series needs a series. Pick or create one on the Content step.",
      );
    }

    const supabase = await createClient();
    const { data: created, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        client_id: parsed.clientId,
        series_id: parsed.seriesId,
        report_number: parsed.reportNumber.trim() || null,
        title: parsed.title.trim(),
        period_label: parsed.periodLabel.trim(),
        subject: parsed.subject.trim(),
        body_md: parsed.bodyMd,
        template_key: parsed.templateKey,
        report_url: parsed.reportUrl.trim() || null,
        attachment_name: parsed.attachment?.name ?? null,
        attachment_url: parsed.attachment?.url || null,
        feedback_enabled: parsed.feedbackEnabled,
        feedback_question:
          parsed.feedbackQuestion.trim() || "Was this report helpful?",
        feedback_ask_comment: parsed.feedbackAskComment,
        status: scheduleWanted ? "scheduled" : "sending",
        is_test: false,
        scheduled_for: scheduledFor,
        created_by: person.id,
      })
      .select("id")
      .single();

    if (campaignError) {
      const duplicate = campaignError.code === "23505";
      return failed(
        duplicate
          ? `${parsed.reportNumber.trim()} already exists for ${clientName}, so nothing was sent. Change the DL number on the Content step.`
          : `Nothing was sent — ${campaignError.message}. The draft is untouched.`,
      );
    }

    const campaignId = str((created as unknown as Row).id);

    // Recipients are written with the service role: `campaign_recipients` has
    // no INSERT policy for a browser session, by design.
    const admin = createAdminClient();
    const { data: insertedRows, error: recipientError } = await admin
      .from("campaign_recipients")
      .insert(
        usable.map((entry) => ({
          campaign_id: campaignId,
          contact_id: entry.contactId,
          email: entry.email,
          full_name: entry.fullName,
          is_internal: entry.isInternal,
        })),
      )
      .select("id, email, full_name, is_internal, token");

    if (recipientError) {
      await supabase
        .from("campaigns")
        .update({ status: "failed" })
        .eq("id", campaignId);
      return failed(
        `The campaign was created but its recipients were not — ${recipientError.message}. It is marked failed and nothing was emailed.`,
      );
    }

    const recipients = (insertedRows ?? []) as unknown as Row[];
    const scoreboardMd = await scoreboardFrom(parsed);
    const signature = signatureFor(person);

    if (scheduleWanted) {
      if (parsed.sendMode === "series" && parsed.seriesId) {
        await supabase
          .from("report_series")
          .update({ next_run_at: scheduledFor })
          .eq("id", parsed.seriesId);
      }

      await recordAudit({
        actorId: person.id,
        actorEmail: person.email,
        action: "campaign.scheduled",
        entityType: "campaigns",
        entityId: campaignId,
        summary: `Scheduled ${parsed.title.trim()} for ${clientName}`,
        diff: {
          recipients: recipients.length,
          scheduled_for: scheduledFor,
          timezone: parsed.timezone,
          series_id: parsed.seriesId,
        },
      });

      revalidatePath("/campaigns");
      revalidatePath("/compose");
      return {
        ok: true,
        data: {
          campaignId,
          status: "scheduled",
          attempted: recipients.length,
          accepted: 0,
          failed: 0,
          clientName,
          scheduledFor,
        },
      };
    }

    // Send now. A failure is a recorded outcome per address, never a throw in
    // the middle of the loop — one bad address must not strand the other forty.
    let accepted = 0;
    let rejected = 0;

    for (const row of recipients) {
      const email = str(row.email);
      const rendered = renderFor(parsed, {
        clientName,
        contactFirstName: firstNameOf(str(row.full_name), email),
        token: str(row.token),
        isTest: false,
        signature,
        scoreboardMd,
      });

      const result = await sendEmail({
        to: email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: person.email,
        headers: { ...rendered.headers, "X-CDL-Campaign": campaignId },
      });

      if (result.ok) {
        accepted += 1;
        await admin
          .from("campaign_recipients")
          .update({ delivered_at: new Date().toISOString(), provider_message_id: result.id })
          .eq("id", str(row.id));
        await admin.from("email_events").insert({
          recipient_id: str(row.id),
          campaign_id: campaignId,
          type: "delivered",
        });
      } else {
        rejected += 1;
        await admin
          .from("campaign_recipients")
          .update({
            bounced_at: new Date().toISOString(),
            bounce_reason: result.error.slice(0, 400),
          })
          .eq("id", str(row.id));
      }
    }

    const { error: finishError } = await supabase
      .from("campaigns")
      .update({
        status: accepted > 0 ? "sent" : "failed",
        sent_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    if (finishError) {
      return failed(
        `The report was sent to ${accepted} of ${recipients.length}, but the campaign could not be marked sent — ${finishError.message}. Open the campaign to check it.`,
      );
    }

    await recordAudit({
      actorId: person.id,
      actorEmail: person.email,
      action: "campaign.sent",
      entityType: "campaigns",
      entityId: campaignId,
      summary: `Sent ${parsed.title.trim()} to ${accepted} of ${recipients.length} for ${clientName}`,
      diff: {
        provider: emailProvider(),
        attempted: recipients.length,
        accepted,
        failed: rejected,
        draft_id: draftId,
      },
    });

    revalidatePath("/campaigns");
    revalidatePath("/overview");
    revalidatePath("/compose");

    return {
      ok: true,
      data: {
        campaignId,
        status: "sent",
        attempted: recipients.length,
        accepted,
        failed: rejected,
        clientName,
        scheduledFor: null,
      },
    };
  } catch (cause) {
    return failed(
      `Nothing was sent — ${reasonOf(cause)}. The draft is untouched; try again once the cause is cleared.`,
    );
  }
}
