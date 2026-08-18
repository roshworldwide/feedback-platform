"use client";

/**
 * Add / edit a contact, in one Sheet.
 *
 * The internal/client toggle pre-fills from the email's domain the moment the
 * address looks complete — `isInternalEmail()` against the same domain list
 * a send itself checks — but a person can always override it. Once they do,
 * the auto-fill stops correcting them back.
 */

import * as React from "react";
import { Field, Sheet, Switch, TextInput, useToast } from "@/components/ui";
import { Button } from "@/components/ui";
import { isInternalEmail } from "@/lib/utils";
import { createContactAction, updateContactAction, type ContactInput } from "./actions";

export type ContactFormSheetProps = {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientSlug: string;
  domains: string[];
  /** Present for an edit; absent for a fresh add. */
  editing?: {
    id: string;
    fullName: string;
    email: string;
    title: string;
    isInternal: boolean;
  } | null;
  onSaved: (contact: { id: string; email: string; fullName: string }) => void;
};

const EMPTY: ContactInput = { fullName: "", email: "", title: "", isInternal: false };

export function ContactFormSheet({
  open,
  onClose,
  clientId,
  clientSlug,
  domains,
  editing = null,
  onSaved,
}: ContactFormSheetProps) {
  const { toast } = useToast();
  const [form, setForm] = React.useState<ContactInput>(EMPTY);
  const [internalTouched, setInternalTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // Reset to the row being edited (or a blank form) each time the sheet opens
  // for a new target — adjusted during render, so there is no flash of the
  // previous contact's data before an effect catches up.
  const key = open ? (editing?.id ?? "__new__") : null;
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);
  if (key !== null && key !== openedFor) {
    setOpenedFor(key);
    setForm(
      editing
        ? {
            fullName: editing.fullName,
            email: editing.email,
            title: editing.title,
            isInternal: editing.isInternal,
          }
        : EMPTY,
    );
    setInternalTouched(false);
  }

  function onEmailBlur() {
    if (internalTouched) return;
    const email = form.email.trim();
    if (!email.includes("@")) return;
    setForm((current) => ({ ...current, isInternal: isInternalEmail(email, domains) }));
  }

  function save() {
    setBusy(true);
    const action = editing
      ? updateContactAction(editing.id, clientSlug, form)
      : createContactAction(clientId, clientSlug, form);
    void action.then((result) => {
      setBusy(false);
      if (!result.ok) {
        toast({ message: result.message, tone: "abort" });
        return;
      }
      toast({
        message: `${result.data.fullName || result.data.email} was ${editing ? "saved" : "added"}.`,
        tone: "nominal",
      });
      onSaved(result.data);
      onClose();
    });
  }

  const canSave = form.email.trim().includes("@");

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit contact" : "Add contact"}
      description={
        editing
          ? "Changes apply the next time a report goes to this account."
          : "One person, added to this client's list."
      }
      footer={
        <>
          <Button variant="glass" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="solid" loading={busy} disabled={!canSave} onClick={save}>
            {editing ? "Save contact" : "Add contact"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
        <Field label="Full name">
          <TextInput
            value={form.fullName}
            placeholder="Priya Sharma"
            autoComplete="name"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setForm((current) => ({ ...current, fullName: value }));
            }}
          />
        </Field>

        <Field label="Email" required hint="This is where every report and rating link is sent.">
          <TextInput
            type="email"
            value={form.email}
            placeholder="priya@client.com"
            autoComplete="email"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setForm((current) => ({ ...current, email: value }));
            }}
            onBlur={onEmailBlur}
          />
        </Field>

        <Field label="Job title" hint="Shown only inside Convin — never in the email.">
          <TextInput
            value={form.title}
            placeholder="VP, Customer Experience"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setForm((current) => ({ ...current, title: value }));
            }}
          />
        </Field>

        <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
          <Switch
            id="contact-internal"
            checked={form.isInternal}
            label="Internal colleague"
            onCheckedChange={(checked) => {
              setInternalTouched(true);
              setForm((current) => ({ ...current, isInternal: checked }));
            }}
          />
          <label htmlFor="contact-internal" className="t-subhead" style={{ color: "var(--content-primary)", cursor: "pointer" }}>
            Internal colleague — copied on sends, excluded from every reported figure
          </label>
        </div>
      </div>
    </Sheet>
  );
}
