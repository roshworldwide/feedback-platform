"use server";

/**
 * Editing a client.
 *
 * The write runs under the caller's session, so RLS decides what is allowed —
 * not the shape of the form. Every change is audited with the actor's real
 * identity: v1 had one shared "Admin" login and no record of who did anything.
 *
 * The action never throws and never discards what was typed. On failure it
 * returns the reason and the caller's fields stay exactly as they were.
 */

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import type { ClientFormState } from "./action-types";
import { CLIENT_STATUSES, type ClientStatus } from "./vocabulary";

function textOf(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function tagsOf(form: FormData): string[] {
  return [
    ...new Set(
      textOf(form, "tags")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

/* ── Create ────────────────────────────────────────────────────────────────
 * Company name and at least one email are the two things asked for —
 * everything else (status, owner, timezone, notes) already has a sane
 * default and can be set on the client's own page a moment later. The slug
 * and every contact row are written by `create_client_with_contacts` in one
 * transaction: a client created with no way to reach it is exactly the
 * defect this closes, so either the whole thing lands or none of it does.
 *
 * `isInternal` per address arrives already decided — the form pre-fills it
 * from the domain via `isInternalEmail()`, the same way `ContactFormSheet`
 * does, and lets it be overridden. This action persists what it is told
 * rather than re-deriving it from a domain list a second time.
 */

export type NewClientEmail = { email: string; isInternal: boolean };

export type NewClientInput = {
  name: string;
  contactName: string;
  emails: NewClientEmail[];
  /** Comma-separated, same convention as the Details form's tags field. */
  tags: string;
  notes: string;
};

export type CreateClientResult =
  | { ok: true; data: { id: string; slug: string; name: string } }
  | { ok: false; message: string };

type CreateClientRow = {
  out_id: string;
  out_slug: string;
  out_name: string;
  out_primary_contact_id: string | null;
};

export async function createClientAction(input: NewClientInput): Promise<CreateClientResult> {
  const trimmedName = input.name.trim();
  if (trimmedName === "") {
    return { ok: false, message: "A client needs a name. Add one and try again." };
  }

  const cleaned = input.emails
    .map((row) => ({ email: row.email.trim(), isInternal: row.isInternal }))
    .filter((row) => row.email !== "");
  if (cleaned.length === 0 || cleaned.every((row) => row.email.indexOf("@") <= 0)) {
    return {
      ok: false,
      message: "At least one email is needed — a client with no address on file can't be mailed.",
    };
  }

  const tags = [
    ...new Set(input.tags.split(",").map((tag) => tag.trim()).filter(Boolean)),
  ];

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, message: NO_SESSION };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_client_with_contacts", {
      p_name: trimmedName,
      p_contact_name: input.contactName.trim(),
      p_emails: cleaned.map((row) => row.email),
      p_is_internal: cleaned.map((row) => row.isInternal),
      p_tags: tags,
      p_notes: input.notes.trim(),
    });

    if (error) {
      const duplicate = error.code === "23505";
      return {
        ok: false,
        message: duplicate
          ? `A client named ${trimmedName} already exists.`
          : `${trimmedName} was not created — ${error.message}.`,
      };
    }

    const rows = (Array.isArray(data) ? data : [data]) as (CreateClientRow | null)[];
    const row = rows[0];
    if (!row) {
      return { ok: false, message: `${trimmedName} was not created — the database gave no row back.` };
    }

    await recordAudit({
      actorId: String(profile.id),
      actorEmail: String(profile.email),
      action: "client.created",
      entityType: "clients",
      entityId: row.out_id,
      summary: `Created ${trimmedName} with ${cleaned.length} ${cleaned.length === 1 ? "contact" : "contacts"}`,
      diff: {
        emails: cleaned.length,
        internal: cleaned.filter((row) => row.isInternal).length,
        contact_name: input.contactName.trim() || null,
        tags,
      },
    });

    revalidatePath("/clients");
    return { ok: true, data: { id: row.out_id, slug: row.out_slug, name: row.out_name } };
  } catch (cause) {
    return { ok: false, message: `${trimmedName} was not created — ${reasonOf(cause)}.` };
  }
}

export async function updateClientAction(
  _previous: ClientFormState,
  form: FormData,
): Promise<ClientFormState> {
  const id = textOf(form, "id");
  const slug = textOf(form, "slug");
  const name = textOf(form, "name");

  if (!id || !slug) {
    return {
      status: "error",
      message:
        "This form lost the client it belongs to. Reload the page and try the edit again — nothing was saved.",
    };
  }
  if (name === "") {
    return {
      status: "error",
      message: "A client needs a name. Add one and save again.",
    };
  }

  const statusValue = textOf(form, "status");
  const status: ClientStatus =
    CLIENT_STATUSES.find((item) => item === statusValue) ?? "active";
  const ownerId = textOf(form, "ownerId");
  const timezone = textOf(form, "timezone");
  const notes = typeof form.get("notes") === "string" ? String(form.get("notes")) : "";
  const tags = tagsOf(form);

  try {
    const profile = await getSessionProfile();
    if (!profile) {
      return {
        status: "error",
        message:
          "Your session is no longer active, so the change was not saved. Sign in again — what you typed is still here.",
      };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("clients")
      .update({
        name,
        status,
        tags,
        notes,
        timezone: timezone || "Asia/Kolkata",
        owner_id: ownerId || null,
      })
      .eq("id", id);

    if (error) {
      return {
        status: "error",
        message: `The change was not saved — ${error.message}. Everything you typed is still on screen.`,
      };
    }

    await recordAudit({
      actorId: String(profile.id),
      actorEmail: String(profile.email),
      action: "client.updated",
      entityType: "clients",
      entityId: id,
      summary: `Updated ${name}`,
      diff: { name, status, tags, timezone, owner_id: ownerId || null },
    });

    revalidatePath(`/clients/${slug}`);
    revalidatePath("/clients");

    return { status: "saved", message: `Saved. ${name} is up to date.` };
  } catch (cause) {
    return {
      status: "error",
      message:
        cause instanceof Error
          ? `The change was not saved — ${cause.message}. Everything you typed is still on screen.`
          : "The change was not saved and the database gave no reason. Everything you typed is still on screen.",
    };
  }
}

/* ── Remove / archive ─────────────────────────────────────────────────────── */

const NO_SESSION =
  "Your session is no longer active, so nothing was changed. Sign in again.";

function reasonOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : "the database gave no reason";
}

export type RemoveClientResult =
  | { ok: true }
  | { ok: false; message: string; campaignCount?: number };

/**
 * `campaigns.client_id` is a NOT NULL foreign key with `on delete restrict` —
 * Postgres itself refuses this delete while any campaign references the
 * client, draft or scheduled included, not only sent ones. This checks first
 * so the author gets a sentence with the true count instead of a raw
 * constraint violation, and RLS (`clients_delete`, manager only) is the
 * backstop if the role check below is ever bypassed.
 */
export async function removeClientAction(
  id: string,
  name: string,
): Promise<RemoveClientResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, message: NO_SESSION };
    if (!["admin", "team_lead"].includes(String(profile.role))) {
      return { ok: false, message: "Only a manager can remove a client." };
    }

    const supabase = await createClient();

    const { count, error: countError } = await supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("client_id", id);
    if (countError) {
      return {
        ok: false,
        message: `Couldn't check this client's campaigns — ${countError.message}. Nothing was changed.`,
      };
    }
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        message: `${name} has ${count} campaign${count === 1 ? "" : "s"} on record, so deleting is blocked — the history would be orphaned. Archive it instead.`,
        campaignCount: count ?? 0,
      };
    }

    const { error: deleteError } = await supabase.from("clients").delete().eq("id", id);
    if (deleteError) {
      return {
        ok: false,
        message: `${name} was not deleted — ${deleteError.message}. Nothing was changed.`,
      };
    }

    await recordAudit({
      actorId: String(profile.id),
      actorEmail: String(profile.email),
      action: "client.deleted",
      entityType: "clients",
      entityId: id,
      summary: `Deleted ${name}`,
    });

    revalidatePath("/clients");
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      message: `${name} was not deleted — ${reasonOf(cause)}. Nothing was changed.`,
    };
  }
}

export type SetPrimaryContactResult = { ok: true } | { ok: false; message: string };

export async function setPrimaryContactAction(
  clientId: string,
  slug: string,
  contactId: string | null,
  contactLabel: string | null,
): Promise<SetPrimaryContactResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, message: NO_SESSION };

    const supabase = await createClient();
    const { error } = await supabase
      .from("clients")
      .update({ primary_contact_id: contactId })
      .eq("id", clientId);
    if (error) {
      return {
        ok: false,
        message: `The primary contact was not changed — ${error.message}.`,
      };
    }

    await recordAudit({
      actorId: String(profile.id),
      actorEmail: String(profile.email),
      action: "client.primary_contact_set",
      entityType: "clients",
      entityId: clientId,
      summary: contactId
        ? `Set ${contactLabel ?? "a contact"} as the primary contact`
        : "Cleared the primary contact",
      diff: { primary_contact_id: contactId },
    });

    revalidatePath(`/clients/${slug}`);
    revalidatePath("/clients");
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      message: `The primary contact was not changed — ${reasonOf(cause)}.`,
    };
  }
}

/* ── Contacts ──────────────────────────────────────────────────────────────
 * Adding or removing a contact was the one thing v2 could not yet do — a
 * client with no reachable address cannot be mailed. `is_active = false` is a
 * soft delete, never a hard one: `campaign_recipients.contact_id` references
 * this row, and a person who has already received reports must stay
 * attributable in that history.
 */

export type ContactInput = {
  fullName: string;
  email: string;
  title: string;
  isInternal: boolean;
};

export type ContactMutationResult =
  | { ok: true; data: { id: string; email: string; fullName: string } }
  | { ok: false; message: string };

function validatedContact(input: ContactInput): { email: string; fullName: string; title: string } | string {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (email === "" || !email.includes("@") || email.indexOf("@") === 0) {
    return "That doesn't look like an email address. Add one and try again.";
  }
  return { email, fullName, title: input.title.trim() };
}

export async function createContactAction(
  clientId: string,
  slug: string,
  input: ContactInput,
): Promise<ContactMutationResult> {
  const validated = validatedContact(input);
  if (typeof validated === "string") return { ok: false, message: validated };

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, message: NO_SESSION };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        client_id: clientId,
        email: validated.email,
        full_name: validated.fullName,
        title: validated.title,
        is_internal: input.isInternal,
      })
      .select("id, email, full_name")
      .single();

    if (error) {
      const duplicate = error.code === "23505";
      return {
        ok: false,
        message: duplicate
          ? `${validated.email} is already on this client's list.`
          : `${validated.email} was not added — ${error.message}.`,
      };
    }

    const row = data as { id: string; email: string; full_name: string };
    await recordAudit({
      actorId: String(profile.id),
      actorEmail: String(profile.email),
      action: "contact.created",
      entityType: "contacts",
      entityId: row.id,
      summary: `Added ${validated.fullName || validated.email} to ${slug}`,
      diff: { email: validated.email, is_internal: input.isInternal },
    });

    revalidatePath(`/clients/${slug}`);
    return { ok: true, data: { id: row.id, email: row.email, fullName: row.full_name } };
  } catch (cause) {
    return { ok: false, message: `${validated.email} was not added — ${reasonOf(cause)}.` };
  }
}

export async function updateContactAction(
  id: string,
  slug: string,
  input: ContactInput,
): Promise<ContactMutationResult> {
  const validated = validatedContact(input);
  if (typeof validated === "string") return { ok: false, message: validated };

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, message: NO_SESSION };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("contacts")
      .update({
        email: validated.email,
        full_name: validated.fullName,
        title: validated.title,
        is_internal: input.isInternal,
      })
      .eq("id", id)
      .select("id, email, full_name")
      .single();

    if (error) {
      const duplicate = error.code === "23505";
      return {
        ok: false,
        message: duplicate
          ? `${validated.email} already belongs to someone else on this client.`
          : `The contact was not saved — ${error.message}.`,
      };
    }

    const row = data as { id: string; email: string; full_name: string };
    await recordAudit({
      actorId: String(profile.id),
      actorEmail: String(profile.email),
      action: "contact.updated",
      entityType: "contacts",
      entityId: id,
      summary: `Updated ${validated.fullName || validated.email}`,
      diff: { email: validated.email, is_internal: input.isInternal },
    });

    revalidatePath(`/clients/${slug}`);
    return { ok: true, data: { id: row.id, email: row.email, fullName: row.full_name } };
  } catch (cause) {
    return { ok: false, message: `The contact was not saved — ${reasonOf(cause)}.` };
  }
}

export type SetActiveResult = { ok: true } | { ok: false; message: string };

/** `active = false` deactivates (soft delete); `active = true` reverses it. */
export async function setContactActiveAction(
  id: string,
  slug: string,
  name: string,
  active: boolean,
): Promise<SetActiveResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, message: NO_SESSION };

    const supabase = await createClient();
    const { error } = await supabase
      .from("contacts")
      .update({ is_active: active })
      .eq("id", id);
    if (error) {
      return {
        ok: false,
        message: `${name} was not ${active ? "restored" : "removed"} — ${error.message}.`,
      };
    }

    await recordAudit({
      actorId: String(profile.id),
      actorEmail: String(profile.email),
      action: active ? "contact.reactivated" : "contact.deactivated",
      entityType: "contacts",
      entityId: id,
      summary: `${active ? "Restored" : "Removed"} ${name}`,
    });

    revalidatePath(`/clients/${slug}`);
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      message: `${name} was not ${active ? "restored" : "removed"} — ${reasonOf(cause)}.`,
    };
  }
}

export async function clearContactBounceAction(
  id: string,
  slug: string,
  name: string,
): Promise<SetActiveResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, message: NO_SESSION };

    const supabase = await createClient();
    const { error } = await supabase
      .from("contacts")
      .update({ bounced_at: null })
      .eq("id", id);
    if (error) {
      return { ok: false, message: `The bounce on ${name} was not cleared — ${error.message}.` };
    }

    await recordAudit({
      actorId: String(profile.id),
      actorEmail: String(profile.email),
      action: "contact.bounce_cleared",
      entityType: "contacts",
      entityId: id,
      summary: `Cleared the bounce on ${name}`,
    });

    revalidatePath(`/clients/${slug}`);
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      message: `The bounce on ${name} was not cleared — ${reasonOf(cause)}.`,
    };
  }
}

/* ── Bulk paste ────────────────────────────────────────────────────────────
 * How a v1 client list of a dozen addresses moves across in one action
 * instead of one form submission per person. Parsing itself lives in
 * `vocabulary.ts` (see `parseContactPaste`) — a "use server" file can only
 * export async functions, and the parse needs to run live, client-side, for
 * the preview, not as a round trip.
 */

export type BulkAddResult =
  | { ok: true; added: number; skipped: number }
  | { ok: false; message: string };

export async function bulkAddContactsAction(
  clientId: string,
  slug: string,
  lines: { email: string; fullName: string; isInternal: boolean }[],
): Promise<BulkAddResult> {
  const usable = lines.filter((line) => line.email.trim() !== "");
  if (usable.length === 0) {
    return { ok: false, message: "Nothing usable was pasted, so nothing was added." };
  }

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, message: NO_SESSION };

    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase
      .from("contacts")
      .select("email")
      .eq("client_id", clientId);
    if (existingError) {
      return { ok: false, message: `Couldn't check the existing list — ${existingError.message}.` };
    }
    const already = new Set(
      ((existing ?? []) as { email: string }[]).map((row) => row.email.toLowerCase()),
    );

    const fresh = usable.filter((line) => !already.has(line.email.toLowerCase()));
    const skipped = usable.length - fresh.length;
    if (fresh.length === 0) {
      return { ok: true, added: 0, skipped };
    }

    const { data, error } = await supabase
      .from("contacts")
      .insert(
        fresh.map((line) => ({
          client_id: clientId,
          email: line.email.trim().toLowerCase(),
          full_name: line.fullName.trim(),
          is_internal: line.isInternal,
        })),
      )
      .select("id");

    if (error) {
      return { ok: false, message: `The list was not added — ${error.message}.` };
    }

    const added = (data ?? []).length;
    await recordAudit({
      actorId: String(profile.id),
      actorEmail: String(profile.email),
      action: "contact.bulk_added",
      entityType: "contacts",
      entityId: clientId,
      summary: `Added ${added} ${added === 1 ? "contact" : "contacts"} to ${slug} in one paste`,
      diff: { added, skipped },
    });

    revalidatePath(`/clients/${slug}`);
    return { ok: true, added, skipped };
  } catch (cause) {
    return { ok: false, message: `The list was not added — ${reasonOf(cause)}.` };
  }
}

export async function archiveClientAction(
  id: string,
  slug: string,
  name: string,
): Promise<RemoveClientResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, message: NO_SESSION };

    const supabase = await createClient();
    const { error } = await supabase
      .from("clients")
      .update({ status: "churned" })
      .eq("id", id);
    if (error) {
      return {
        ok: false,
        message: `${name} was not archived — ${error.message}. Nothing was changed.`,
      };
    }

    await recordAudit({
      actorId: String(profile.id),
      actorEmail: String(profile.email),
      action: "client.archived",
      entityType: "clients",
      entityId: id,
      summary: `Archived ${name}`,
    });

    revalidatePath(`/clients/${slug}`);
    revalidatePath("/clients");
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      message: `${name} was not archived — ${reasonOf(cause)}. Nothing was changed.`,
    };
  }
}
