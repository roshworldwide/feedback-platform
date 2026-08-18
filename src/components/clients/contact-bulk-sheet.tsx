"use client";

/**
 * Paste a whole list at once.
 *
 * How a v1 client's dozen addresses move across in one action instead of one
 * form per person. Every line is parsed and shown before anything is written
 * — an invalid address or a duplicate is flagged, not silently dropped or
 * silently written twice.
 */

import * as React from "react";
import { Field, Pill, Sheet, TextArea, useToast } from "@/components/ui";
import { Button } from "@/components/ui";
import { parseContactPaste, type ParsedContactLine } from "./vocabulary";
import { bulkAddContactsAction } from "./actions";

export type ContactBulkSheetProps = {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientSlug: string;
  domains: string[];
  /** Lower-cased addresses already on this client, so a paste can flag them. */
  existingEmails: string[];
  onAdded: () => void;
};

const PROBLEM_LABEL: Record<NonNullable<ParsedContactLine["problem"]>, string> = {
  invalid: "Not a usable address",
  "duplicate-in-paste": "Repeated in this paste",
  "already-on-client": "Already on this client",
};

export function ContactBulkSheet({
  open,
  onClose,
  clientId,
  clientSlug,
  domains,
  existingEmails,
  onAdded,
}: ContactBulkSheetProps) {
  const { toast } = useToast();
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // Cleared on the false→true transition only, adjusted during render rather
  // than in an effect — see contact-form-sheet.tsx for the same pattern.
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setText("");
  }

  const existing = React.useMemo(() => new Set(existingEmails), [existingEmails]);
  const parsed = React.useMemo(
    () => parseContactPaste(text, domains, existing),
    [text, domains, existing],
  );
  const usable = parsed.filter((line) => line.problem === null);

  function submit() {
    if (usable.length === 0) return;
    setBusy(true);
    void bulkAddContactsAction(clientId, clientSlug, usable).then((result) => {
      setBusy(false);
      if (!result.ok) {
        toast({ message: result.message, tone: "abort" });
        return;
      }
      toast({
        message:
          result.skipped > 0
            ? `Added ${result.added} of ${result.added + result.skipped} — ${result.skipped} were already on this client.`
            : `Added ${result.added} ${result.added === 1 ? "contact" : "contacts"}.`,
        tone: "nominal",
      });
      onAdded();
      onClose();
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Paste a list"
      description="Comma- or newline-separated. “Name <email>” works, or an address on its own."
      side="right"
      footer={
        <>
          <Button variant="glass" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="solid" loading={busy} disabled={usable.length === 0} onClick={submit}>
            Add {usable.length || ""} {usable.length === 1 ? "contact" : "contacts"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
        <Field label="Addresses">
          <TextArea
            value={text}
            rows={8}
            placeholder={"Priya Sharma <priya@client.com>\nrahul@client.com\nAnita Rao <anita@client.com>"}
            onChange={(event) => setText(event.currentTarget.value)}
          />
        </Field>

        {parsed.length > 0 ? (
          <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
            <p className="t-footnote" style={{ margin: 0, color: "var(--content-secondary)" }}>
              {usable.length} of {parsed.length} will be added
              {parsed.length > usable.length ? ` — ${parsed.length - usable.length} flagged below` : ""}.
            </p>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                maxHeight: "280px",
                overflowY: "auto",
                border: "1px solid var(--stroke-hairline)",
                borderRadius: "var(--radius-md)",
              }}
            >
              {parsed.map((line, index) => (
                <li
                  key={`${line.raw}-${index}`}
                  className="flex items-center justify-between"
                  style={{
                    gap: "var(--space-3)",
                    padding: "var(--space-2) var(--space-3)",
                    borderTop: index === 0 ? "none" : "1px solid var(--stroke-hairline)",
                  }}
                >
                  <span className="flex flex-col" style={{ minWidth: 0 }}>
                    <span
                      className="t-footnote"
                      style={{
                        color: line.problem ? "var(--content-tertiary)" : "var(--content-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {line.fullName ? `${line.fullName} · ` : ""}
                      {line.email || line.raw}
                    </span>
                  </span>
                  {line.problem ? (
                    <Pill tone="caution">{PROBLEM_LABEL[line.problem]}</Pill>
                  ) : (
                    <Pill tone={line.isInternal ? "accent" : "neutral"}>
                      {line.isInternal ? "Internal" : "Client"}
                    </Pill>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
