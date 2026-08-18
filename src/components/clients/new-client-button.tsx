"use client";

/**
 * "New client" — the one Aurum element on this screen.
 *
 * Matches v1's form (company, contact person, up to three emails, tags) and
 * goes one better: the client and every contact are written in one
 * transaction by `create_client_with_contacts`, so a save can never leave a
 * company on the roster with no address to reach it at.
 *
 * Errors are shown on blur, not on every keystroke — a person typing an email
 * should not see "invalid" flash red after the third character. Everything
 * typed survives a failed save.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { Button, Field, Sheet, TextArea, TextInput, useToast } from "@/components/ui";
import { createClientAction, type NewClientInput } from "./actions";

const EMPTY: NewClientInput = {
  name: "",
  contactName: "",
  primaryEmail: "",
  email2: "",
  email3: "",
  tags: "",
  notes: "",
};

function emailProblem(value: string, required: boolean): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return required ? "A primary email is needed to reach this client." : null;
  return trimmed.indexOf("@") > 0 ? null : "That doesn't look like an email address.";
}

export function NewClientButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<NewClientInput>(EMPTY);
  const [busy, setBusy] = React.useState(false);
  const [touched, setTouched] = React.useState<Partial<Record<keyof NewClientInput, boolean>>>({});

  function field(key: keyof NewClientInput) {
    return {
      value: form[key],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        // Captured eagerly: `event.currentTarget` is nulled out by the time a
        // functional setState updater actually runs, since React does not
        // keep the native event alive across that gap.
        const value = event.currentTarget.value;
        setForm((current) => ({ ...current, [key]: value }));
      },
      onBlur: () => setTouched((current) => ({ ...current, [key]: true })),
    };
  }

  const nameError = touched.name && form.name.trim() === "" ? "A client needs a name." : null;
  const primaryEmailError = touched.primaryEmail ? emailProblem(form.primaryEmail, true) : null;
  const email2Error = touched.email2 ? emailProblem(form.email2, false) : null;
  const email3Error = touched.email3 ? emailProblem(form.email3, false) : null;

  const canSave =
    form.name.trim() !== "" &&
    emailProblem(form.primaryEmail, true) === null &&
    emailProblem(form.email2, false) === null &&
    emailProblem(form.email3, false) === null;

  function create() {
    setTouched({ name: true, primaryEmail: true, email2: true, email3: true });
    if (!canSave) return;
    setBusy(true);
    void createClientAction(form).then((result) => {
      setBusy(false);
      if (!result.ok) {
        toast({ message: result.message, tone: "abort" });
        return;
      }
      setOpen(false);
      setForm(EMPTY);
      setTouched({});
      toast({ message: `${result.data.name} was added.`, tone: "nominal" });
      router.push(`/clients/${result.data.slug}`);
    });
  }

  return (
    <>
      <Button variant="metal" size="m" leadingIcon={Building2} onClick={() => setOpen(true)}>
        New client
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="New client"
        description="Company, a way to reach them, and however many addresses matter. Status and owner can be set on its page next."
        side="right"
        footer={
          <>
            <Button variant="glass" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="solid" loading={busy} onClick={create}>
              Create client
            </Button>
          </>
        }
      >
        <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
          <Field
            label="Company name"
            required
            error={nameError}
            hint={nameError ? undefined : "Also sets the client's page address — /clients/acme, for example."}
          >
            <TextInput placeholder="Acme Inc." autoComplete="organization" {...field("name")} />
          </Field>

          <Field label="Contact person" hint="The name on the account, if there is one point of contact.">
            <TextInput placeholder="Priya Sharma" autoComplete="name" {...field("contactName")} />
          </Field>

          <Field label="Primary email" required error={primaryEmailError}>
            <TextInput
              type="email"
              placeholder="priya@acme.com"
              autoComplete="email"
              {...field("primaryEmail")}
            />
          </Field>

          <Field label="Email 2" error={email2Error} hint={email2Error ? undefined : "Optional."}>
            <TextInput type="email" placeholder="ops@acme.com" {...field("email2")} />
          </Field>

          <Field label="Email 3" error={email3Error} hint={email3Error ? undefined : "Optional."}>
            <TextInput type="email" placeholder="billing@acme.com" {...field("email3")} />
          </Field>

          <Field label="Tags" hint="Separate with commas.">
            <TextInput placeholder="enterprise, apac" {...field("tags")} />
          </Field>

          <Field label="Notes" hint="Context for whoever writes the next report — renewal dates, quirks, history.">
            <TextArea
              placeholder="Client context, renewal dates…"
              rows={4}
              value={form.notes}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({ ...current, notes: value }));
              }}
            />
          </Field>
        </div>
      </Sheet>
    </>
  );
}
