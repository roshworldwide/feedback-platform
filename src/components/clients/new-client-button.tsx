"use client";

/**
 * "New client" — the one Aurum element on this screen.
 *
 * Matches v1's form (company, contact person, however many addresses matter)
 * and goes one better on both counts: the list of emails has no fixed size —
 * v1's three fixed slots (Primary/Email 2/Email 3) were never enough for an
 * account with a distribution list — and each one carries its own
 * internal/client flag, pre-filled from the domain via `isInternalEmail()`
 * exactly the way `ContactFormSheet` does it, and always overridable. The
 * client and every contact are written in one transaction by
 * `create_client_with_contacts`, so a save can never leave a company on the
 * roster with no address to reach it at.
 *
 * Errors are shown on blur, not on every keystroke — a person typing an email
 * should not see "invalid" flash red after the third character. Everything
 * typed survives a failed save.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Trash2 } from "lucide-react";
import { Button, Field, Sheet, Switch, TextArea, TextInput, useToast } from "@/components/ui";
import { isInternalEmail } from "@/lib/utils";
import { createClientAction, type NewClientInput } from "./actions";

export type NewClientButtonProps = {
  /** So the internal/client toggle can pre-fill the same way a contact's does. */
  domains: string[];
};

type EmailRow = {
  key: string;
  email: string;
  isInternal: boolean;
  /** Once a person sets this by hand, the domain guess stops correcting them. */
  /** Gates the "required" message under this row's own field. */
  emailTouched: boolean;
  /** Gates the domain auto-fill — once a person sets the switch by hand, an
   *  edit to the email above it never overwrites their choice again. This is
   *  deliberately a separate flag from `emailTouched`: blurring the email
   *  field must not itself count as "the internal flag was chosen by hand". */
  internalTouched: boolean;
};

type Fields = Omit<NewClientInput, "emails">;

const EMPTY_FIELDS: Fields = { name: "", contactName: "", tags: "", notes: "" };

function emptyRow(key: string): EmailRow {
  return { key, email: "", isInternal: false, emailTouched: false, internalTouched: false };
}

function emailProblem(value: string, required: boolean): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return required ? "At least one email is needed to reach this client." : null;
  return trimmed.indexOf("@") > 0 ? null : "That doesn't look like an email address.";
}

export function NewClientButton({ domains }: NewClientButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [fields, setFields] = React.useState<Fields>(EMPTY_FIELDS);
  const nextKey = React.useRef(1);
  const [rows, setRows] = React.useState<EmailRow[]>(() => [emptyRow("e0")]);
  const [busy, setBusy] = React.useState(false);
  const [nameTouched, setNameTouched] = React.useState(false);

  function field(key: keyof Fields) {
    return {
      value: fields[key],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.currentTarget.value;
        setFields((current) => ({ ...current, [key]: value }));
      },
    };
  }

  function patchRow(key: string, change: Partial<EmailRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));
  }

  function onRowEmailBlur(key: string) {
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, emailTouched: true };
        if (next.internalTouched) return next;
        const email = next.email.trim();
        if (!email.includes("@")) return next;
        return { ...next, isInternal: isInternalEmail(email, domains) };
      }),
    );
  }

  function addRow() {
    const key = `e${nextKey.current++}`;
    setRows((current) => [...current, emptyRow(key)]);
  }

  function removeRow(key: string) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  }

  function reset() {
    setFields(EMPTY_FIELDS);
    nextKey.current = 1;
    setRows([emptyRow("e0")]);
    setNameTouched(false);
  }

  const nameError = nameTouched && fields.name.trim() === "" ? "A client needs a name." : null;
  const rowErrors = new Map(
    rows.map((row, index) => [
      row.key,
      row.emailTouched || row.email.trim() !== ""
        ? emailProblem(row.email, index === 0 && rows.length === 1)
        : null,
    ]),
  );
  const anyUsableEmail = rows.some((row) => row.email.trim().indexOf("@") > 0);
  const noRowInvalid = rows.every((row) => row.email.trim() === "" || row.email.trim().indexOf("@") > 0);
  const canSave = fields.name.trim() !== "" && anyUsableEmail && noRowInvalid;

  function create() {
    setNameTouched(true);
    setRows((current) => current.map((row) => ({ ...row, emailTouched: true })));
    if (!canSave) return;
    setBusy(true);
    void createClientAction({
      ...fields,
      emails: rows.map((row) => ({ email: row.email, isInternal: row.isInternal })),
    }).then((result) => {
      setBusy(false);
      if (!result.ok) {
        toast({ message: result.message, tone: "abort" });
        return;
      }
      setOpen(false);
      reset();
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
            <TextInput
              placeholder="Acme Inc."
              autoComplete="organization"
              onBlur={() => setNameTouched(true)}
              {...field("name")}
            />
          </Field>

          <Field label="Contact person" hint="The name on the account, if there is one point of contact.">
            <TextInput placeholder="Priya Sharma" autoComplete="name" {...field("contactName")} />
          </Field>

          <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
            <span className="t-subhead" style={{ fontWeight: 600, color: "var(--content-primary)" }}>
              Email addresses <span style={{ color: "var(--signal-abort)" }}>*</span>
            </span>

            {rows.map((row, index) => (
              <div
                key={row.key}
                className="flex flex-col"
                style={{
                  gap: "var(--space-2)",
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--fill-quiet)",
                }}
              >
                <div className="flex items-start" style={{ gap: "var(--space-2)" }}>
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <TextInput
                      type="email"
                      value={row.email}
                      placeholder={index === 0 ? "priya@acme.com" : "ops@acme.com"}
                      autoComplete="email"
                      onChange={(event) => patchRow(row.key, { email: event.currentTarget.value })}
                      onBlur={() => onRowEmailBlur(row.key)}
                    />
                  </div>
                  <Button
                    size="s"
                    variant="plain"
                    leadingIcon={Trash2}
                    aria-label={`Remove email ${index + 1}`}
                    disabled={rows.length === 1}
                    style={{ color: rows.length === 1 ? undefined : "var(--signal-abort)" }}
                    onClick={() => removeRow(row.key)}
                  />
                </div>

                {rowErrors.get(row.key) ? (
                  <p className="t-footnote" style={{ margin: 0, color: "var(--signal-abort)" }}>
                    {rowErrors.get(row.key)}
                  </p>
                ) : null}

                <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
                  <Switch
                    id={`new-client-internal-${row.key}`}
                    checked={row.isInternal}
                    label="Internal colleague"
                    onCheckedChange={(checked) =>
                      patchRow(row.key, { isInternal: checked, internalTouched: true })
                    }
                  />
                  <label
                    htmlFor={`new-client-internal-${row.key}`}
                    className="t-footnote"
                    style={{ color: "var(--content-secondary)", cursor: "pointer" }}
                  >
                    Internal colleague — copied on sends, excluded from every reported figure
                  </label>
                </div>
              </div>
            ))}

            <Button size="s" variant="tinted" leadingIcon={Plus} onClick={addRow} style={{ alignSelf: "flex-start" }}>
              Add another email
            </Button>
          </div>

          <Field label="Tags" hint="Separate with commas.">
            <TextInput placeholder="enterprise, apac" {...field("tags")} />
          </Field>

          <Field label="Notes" hint="Context for whoever writes the next report — renewal dates, quirks, history.">
            <TextArea
              placeholder="Client context, renewal dates…"
              rows={4}
              value={fields.notes}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setFields((current) => ({ ...current, notes: value }));
              }}
            />
          </Field>
        </div>
      </Sheet>
    </>
  );
}
