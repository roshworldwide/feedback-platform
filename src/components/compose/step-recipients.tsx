"use client";

/**
 * Step 3 · Recipients.
 *
 * FIX: v1 stored recipients as one pipe-separated text blob, so nobody could be
 * deduplicated, attributed or marked internal — and every @convin.ai colleague
 * on the CC line was counted as client engagement. Here people are rows, and
 * the two groups are separated on screen with their own counts before anything
 * is selected.
 *
 * `is_internal` shown here is the contact's current classification. It is read
 * again from the database at send time and snapshotted onto the recipient row,
 * so reclassifying someone next month cannot rewrite what this send counted.
 */

import * as React from "react";
import { AlertTriangle, RotateCw, Trash2, UserPlus } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  Pill,
  Spinner,
  Switch,
  TextInput,
} from "@/components/ui";
import { CouldntLoadInline } from "@/components/campaigns/couldnt-load";
import { fmtDate } from "@/lib/utils";
import {
  isEmailShaped,
  recipientSentence,
  summariseRecipients,
  type AdHocRecipient,
  type ComposeDoc,
  type RecipientChoice,
} from "./vocabulary";

export type StepRecipientsProps = {
  doc: ComposeDoc;
  patch: (change: Partial<ComposeDoc>) => void;
  clientName: string | null;
  contacts: RecipientChoice[] | null;
  contactsReason: string | null;
  loading: boolean;
  onReload: () => void;
  /** Everyone currently selected, contacts and ad-hoc together. */
  chosen: RecipientChoice[];
};

function Group({
  title,
  description,
  rows,
  selected,
  onToggle,
  onToggleAll,
}: {
  title: string;
  description: string;
  rows: RecipientChoice[];
  selected: Set<string>;
  onToggle: (id: string, next: boolean) => void;
  onToggleAll: (next: boolean) => void;
}) {
  const selectable = rows.filter((row) => row.isActive);
  const selectedCount = rows.filter((row) => selected.has(row.key)).length;
  const allOn = selectable.length > 0 && selectable.every((row) => selected.has(row.key));
  const someOn = selectedCount > 0 && !allOn;

  return (
    <section
      aria-label={title}
      className="flex flex-col"
      style={{
        gap: "var(--space-3)",
        padding: "var(--space-4)",
        borderRadius: "var(--radius-sm)",
        background: "var(--fill-quiet)",
      }}
    >
      <div className="flex flex-wrap items-center" style={{ gap: "var(--space-3)" }}>
        <Checkbox
          checked={allOn}
          indeterminate={someOn}
          disabled={selectable.length === 0}
          onCheckedChange={onToggleAll}
          label={
            <span>
              <span style={{ fontWeight: 600 }}>{title}</span>{" "}
              <span className="tabular" style={{ color: "var(--content-tertiary)" }}>
                {selectedCount} of {rows.length}
              </span>
            </span>
          }
        />
      </div>

      <p className="t-caption prose-measure" style={{ margin: 0, color: "var(--content-tertiary)" }}>
        {description}
      </p>

      {rows.length === 0 ? (
        <p className="t-footnote" style={{ margin: 0, color: "var(--content-secondary)" }}>
          Nobody in this group. Add contacts on the client&rsquo;s screen.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex flex-wrap items-center"
              style={{
                gap: "var(--space-3)",
                paddingBlock: "var(--space-1)",
                borderTop: "1px solid var(--stroke-hairline)",
              }}
            >
              <Checkbox
                checked={selected.has(row.key)}
                disabled={!row.isActive}
                onCheckedChange={(next) => onToggle(row.key, next)}
                label={
                  <span style={{ display: "block", minWidth: 0 }}>
                    <span style={{ display: "block" }}>
                      {row.fullName || row.email}
                    </span>
                    <span
                      className="t-caption"
                      style={{ display: "block", color: "var(--content-tertiary)" }}
                    >
                      {row.email}
                      {row.title ? ` · ${row.title}` : ""}
                    </span>
                  </span>
                }
              />

              <span
                className="flex flex-wrap items-center"
                style={{ gap: "var(--space-2)", marginLeft: "auto" }}
              >
                {row.isActive ? null : <Pill tone="neutral">Inactive</Pill>}
                {row.bouncedAt ? (
                  <Pill tone="caution" dot>
                    Bounced {fmtDate(row.bouncedAt)}
                  </Pill>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function StepRecipients({
  doc,
  patch,
  clientName,
  contacts,
  contactsReason,
  loading,
  onReload,
  chosen,
}: StepRecipientsProps) {
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [internal, setInternal] = React.useState(false);

  const selected = React.useMemo(() => {
    const keys = new Set<string>(doc.contactIds);
    for (const person of doc.adHoc) keys.add(`adhoc:${person.email}`);
    return keys;
  }, [doc.contactIds, doc.adHoc]);

  const clientRows = (contacts ?? []).filter((row) => !row.isInternal);
  const internalRows = (contacts ?? []).filter((row) => row.isInternal);

  const summary = summariseRecipients(chosen);
  const bounced = chosen.filter((person) => person.bouncedAt);

  function toggle(id: string, next: boolean) {
    patch({
      contactIds: next
        ? [...new Set([...doc.contactIds, id])]
        : doc.contactIds.filter((item) => item !== id),
    });
  }

  function toggleGroup(rows: RecipientChoice[], next: boolean) {
    const ids = rows.filter((row) => row.isActive).map((row) => row.key);
    patch({
      contactIds: next
        ? [...new Set([...doc.contactIds, ...ids])]
        : doc.contactIds.filter((item) => !ids.includes(item)),
    });
  }

  function addAdHoc() {
    const address = email.trim().toLowerCase();
    if (!isEmailShaped(address)) return;
    if (doc.adHoc.some((person) => person.email === address)) return;
    if ((contacts ?? []).some((row) => row.email === address)) return;
    const person: AdHocRecipient = { email: address, fullName: name.trim(), isInternal: internal };
    patch({ adHoc: [...doc.adHoc, person] });
    setEmail("");
    setName("");
    setInternal(false);
  }

  const duplicate =
    email.trim() !== "" &&
    (doc.adHoc.some((person) => person.email === email.trim().toLowerCase()) ||
      (contacts ?? []).some((row) => row.email === email.trim().toLowerCase()));

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      {/* The live count, stated in full and never rounded. */}
      <Card elevation="e1" accent={summary.client > 0 ? undefined : "caution"}>
        <CardBody style={{ padding: "var(--space-5)" }}>
          <p
            className="t-title-3 tabular"
            role="status"
            aria-live="polite"
            style={{ margin: 0, color: "var(--content-primary)" }}
          >
            {recipientSentence(summary)}
          </p>
          <p
            className="t-footnote prose-measure"
            style={{ margin: "var(--space-2) 0 0", color: "var(--content-secondary)" }}
          >
            {summary.client === 0
              ? "No client recipient is selected, so this report would reach nobody outside Convin."
              : "Internal recipients receive the report but are excluded from every engagement figure — the exclusion is stated on the campaign, never applied silently."}
          </p>
        </CardBody>
      </Card>

      <Card elevation="e1">
        <CardHeader
          action={
            <Button size="s" variant="plain" leadingIcon={RotateCw} onClick={onReload}>
              Reload
            </Button>
          }
        >
          <CardTitle
            as="h2"
            description={
              clientName
                ? `Contacts on ${clientName}, grouped as the database classifies them.`
                : "Pick a client on the Content step to see its contacts."
            }
          >
            Contacts
          </CardTitle>
        </CardHeader>

        <CardBody className="flex flex-col" style={{ gap: "var(--space-4)" }}>
          {!doc.clientId ? (
            <p className="t-subhead" style={{ margin: 0, color: "var(--content-secondary)" }}>
              No client is set, so there is nobody to list. Go back to Content and
              choose one.
            </p>
          ) : loading ? (
            <p
              className="t-subhead flex items-center"
              style={{ margin: 0, gap: "var(--space-3)", color: "var(--content-secondary)" }}
            >
              <span style={{ color: "var(--content-tertiary)" }}>
                <Spinner size={16} />
              </span>
              Reading this client&rsquo;s contacts…
            </p>
          ) : contactsReason ? (
            <CouldntLoadInline what="this client's contacts" reason={contactsReason} />
          ) : (
            <>
              <Group
                title="Client contacts"
                description="People at the client. Their opens, clicks and ratings are the figures every report is measured by."
                rows={clientRows}
                selected={selected}
                onToggle={toggle}
                onToggleAll={(next) => toggleGroup(clientRows, next)}
              />
              <Group
                title="Internal (CC)"
                description="Colleagues copied for visibility. Counted as recipients, excluded from engagement."
                rows={internalRows}
                selected={selected}
                onToggle={toggle}
                onToggleAll={(next) => toggleGroup(internalRows, next)}
              />
            </>
          )}
        </CardBody>
      </Card>

      {bounced.length > 0 ? (
        <Card elevation="e1" accent="caution" role="status">
          <CardBody
            className="flex items-start"
            style={{ gap: "var(--space-4)", padding: "var(--space-5)" }}
          >
            <AlertTriangle
              size={18}
              strokeWidth={1.75}
              aria-hidden="true"
              style={{ flex: "none", color: "var(--signal-caution)" }}
            />
            <div style={{ minWidth: 0 }}>
              <p className="t-headline" style={{ margin: 0, color: "var(--content-primary)" }}>
                {bounced.length} selected {bounced.length === 1 ? "address has" : "addresses have"}{" "}
                bounced before
              </p>
              <p
                className="t-footnote prose-measure"
                style={{ margin: "var(--space-2) 0 0", color: "var(--content-secondary)" }}
              >
                {bounced.map((person) => person.email).join(", ")}. Sending to an
                address that has already bounced usually bounces again and costs
                sender reputation. Correct it on the client&rsquo;s screen, or
                deselect it here — nothing is removed for you.
              </p>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card elevation="e1">
        <CardHeader>
          <CardTitle
            as="h2"
            description="For someone who is not on the client record. They receive this report and nothing else — no contact row is created."
          >
            Add someone by hand
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col" style={{ gap: "var(--space-4)" }}>
          <div
            className="grid"
            style={{
              gap: "var(--space-4)",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            }}
          >
            <Field
              label="Email"
              error={
                email.trim() !== "" && !isEmailShaped(email)
                  ? "That is not a usable address."
                  : duplicate
                    ? "That address is already on this send."
                    : null
              }
            >
              <TextInput
                value={email}
                inputMode="email"
                placeholder="priya@cleartrip.com"
                onChange={(event) => setEmail(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addAdHoc();
                }}
              />
            </Field>
            <Field label="Name" hint="Used in the greeting. Optional.">
              <TextInput
                value={name}
                placeholder="Priya Nair"
                onChange={(event) => setName(event.currentTarget.value)}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center" style={{ gap: "var(--space-4)" }}>
            <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
              <Switch
                checked={internal}
                label="This person is internal"
                onCheckedChange={setInternal}
              />
              <span className="t-footnote" style={{ color: "var(--content-secondary)" }}>
                Internal — excluded from engagement figures
              </span>
            </div>
            <Button
              size="s"
              variant="tinted"
              leadingIcon={UserPlus}
              disabled={!isEmailShaped(email) || duplicate}
              style={{ marginLeft: "auto" }}
              onClick={addAdHoc}
            >
              Add recipient
            </Button>
          </div>

          {doc.adHoc.length > 0 ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {doc.adHoc.map((person) => (
                <li
                  key={person.email}
                  className="flex flex-wrap items-center"
                  style={{
                    gap: "var(--space-3)",
                    minHeight: "44px",
                    borderTop: "1px solid var(--stroke-hairline)",
                  }}
                >
                  <span className="t-subhead" style={{ minWidth: 0 }}>
                    {person.fullName || person.email}
                    <span
                      className="t-caption"
                      style={{ display: "block", color: "var(--content-tertiary)" }}
                    >
                      {person.email}
                    </span>
                  </span>
                  <span
                    className="flex items-center"
                    style={{ gap: "var(--space-2)", marginLeft: "auto" }}
                  >
                    {/* Tone is meaning, never decoration, and gold is never a
                        status — the two groups are told apart by the word. */}
                    <Pill tone="neutral">
                      {person.isInternal ? "Internal" : "Client"}
                    </Pill>
                    <Button
                      size="s"
                      variant="plain"
                      leadingIcon={Trash2}
                      aria-label={`Remove ${person.email}`}
                      style={{ color: "var(--signal-abort)" }}
                      onClick={() =>
                        patch({
                          adHoc: doc.adHoc.filter((item) => item.email !== person.email),
                        })
                      }
                    />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="t-caption" style={{ margin: 0, color: "var(--content-tertiary)" }}>
              Nobody added by hand.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
