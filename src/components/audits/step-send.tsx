"use client";

/**
 * Step 5 · Send.
 *
 * The client is already fixed from Upload — this step only picks recipients
 * from that client's contacts, split internal/external exactly like Compose,
 * then sends through the same campaign pipeline every other report uses.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Send, X } from "lucide-react";
import { Button, Card, CardBody, CardHeader, CardTitle, Checkbox, Field, Spinner, TextInput, useToast } from "@/components/ui";
import { recipientSentence, sendPreflight, summariseRecipients, type RecipientChoice } from "./vocabulary";
import { loadAuditRecipientsAction, sendAuditReportAction, sendTestAuditReportAction } from "@/app/(app)/audits/actions";
import type { AuditRunStatus } from "@/lib/audits/types";

export type StepSendProps = {
  runId: string;
  clientId: string;
  clientName: string;
  status: AuditRunStatus;
  campaignId: string | null;
};

export function StepSend({ runId, clientId, clientName, status, campaignId }: StepSendProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [contacts, setContacts] = React.useState<RecipientChoice[]>([]);
  const [contactsReason, setContactsReason] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [sending, setSending] = React.useState(false);
  const [sendingTest, setSendingTest] = React.useState(false);
  const [testEmail, setTestEmail] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    void loadAuditRecipientsAction(clientId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setContactsReason(result.message);
        return;
      }
      setContacts(result.data);
      // Nobody is pre-selected. A report already went to two real contacts
      // once because "select every active client contact by default" made
      // a live-verification test send indistinguishable from a deliberate
      // one — recipients for something this consequential are chosen by
      // hand, every time, not defaulted into.
    });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const chosen = contacts.filter((c) => selected.has(c.key));
  const summary = summariseRecipients(chosen);
  const checks = sendPreflight({ status, clientId, chosen });
  const failures = checks.filter((c) => c.tone === "fail");

  function toggle(key: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function send() {
    setSending(true);
    const result = await sendAuditReportAction(runId, chosen);
    setSending(false);
    if (!result.ok) {
      toast({ message: result.message, tone: "abort" });
      return;
    }
    toast({
      message: `Sent to ${result.data.accepted} of ${result.data.attempted}. The audit report is now a campaign with tracking and feedback.`,
      tone: "nominal",
    });
    router.push(`/campaigns/${result.data.campaignId}`);
  }

  async function sendTest() {
    setSendingTest(true);
    const result = await sendTestAuditReportAction(runId, testEmail);
    setSendingTest(false);
    toast({
      message: result.ok
        ? `Test copy sent to ${result.data}. It's marked as a test in the email and writes no campaign, so it can never reach a real recipient.`
        : result.message,
      tone: result.ok ? "nominal" : "abort",
    });
  }

  if (status === "sent" && campaignId) {
    return (
      <Card elevation="e1" accent="nominal">
        <CardBody className="flex items-center" style={{ gap: "var(--space-3)" }}>
          <Check size={18} style={{ color: "var(--signal-nominal)" }} />
          <span className="t-subhead" style={{ color: "var(--content-primary)" }}>
            This report was already sent.
          </span>
          <Button size="s" variant="plain" onClick={() => router.push(`/campaigns/${campaignId}`)}>
            View the campaign
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      <Card elevation="e1">
        <CardHeader>
          <CardTitle
            as="h2"
            description="Marked as a test in the email itself. It writes no campaign and no recipient, so it can never reach a client contact — the safe way to see exactly what this report looks like before it goes out for real, sent to yourself or anyone you want to check it with."
          >
            Send a test
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col" style={{ gap: "var(--space-3)" }}>
          <Field label="Send test to" hint="Leave blank to send it to your own address.">
            <TextInput
              type="email"
              placeholder="you@company.com"
              value={testEmail}
              onChange={(event) => setTestEmail(event.currentTarget.value)}
            />
          </Field>
          <Button variant="tinted" leadingIcon={Send} loading={sendingTest} onClick={sendTest} style={{ alignSelf: "flex-start" }}>
            Send test
          </Button>
        </CardBody>
      </Card>

      <Card elevation="e1">
        <CardHeader>
          <CardTitle as="h2" description={failures.length > 0 ? `${failures.length} thing${failures.length === 1 ? "" : "s"} to fix before sending.` : "Ready to send."}>
            Pre-flight
          </CardTitle>
        </CardHeader>
        <CardBody>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {checks.map((check) => (
              <li key={check.id} className="flex items-center" style={{ gap: "var(--space-3)", paddingBlock: "var(--space-2)", borderTop: "1px solid var(--stroke-hairline)" }}>
                {check.tone === "pass" ? (
                  <Check size={14} style={{ color: "var(--signal-nominal)" }} />
                ) : check.tone === "warn" ? (
                  <AlertTriangle size={14} style={{ color: "var(--signal-caution)" }} />
                ) : (
                  <X size={14} style={{ color: "var(--signal-abort)" }} />
                )}
                <span className="t-subhead" style={{ color: "var(--content-primary)" }}>
                  {check.label}
                </span>
                <span className="t-footnote" style={{ color: "var(--content-tertiary)" }}>
                  {check.detail}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card elevation="e1">
        <CardHeader
          action={
            contacts.length > 0 ? (
              <Button
                size="s"
                variant="plain"
                onClick={() =>
                  setSelected(new Set(contacts.filter((c) => c.isActive && !c.isInternal).map((c) => c.key)))
                }
              >
                Select all client contacts
              </Button>
            ) : null
          }
        >
          <CardTitle as="h2" description={`${clientName}'s contacts. ${recipientSentence(summary)}. Nothing is picked until you choose it.`}>
            Recipients
          </CardTitle>
        </CardHeader>
        <CardBody>
          {loading ? (
            <p className="t-subhead flex items-center" style={{ gap: "var(--space-3)", color: "var(--content-secondary)" }}>
              <Spinner size={16} /> Loading contacts…
            </p>
          ) : contactsReason ? (
            <p role="alert" className="t-subhead" style={{ color: "var(--signal-abort)" }}>
              {contactsReason}
            </p>
          ) : contacts.length === 0 ? (
            <p className="t-subhead" style={{ color: "var(--content-tertiary)" }}>
              This client has no contacts yet. Add one from the Clients page first.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {contacts.map((c) => (
                <li key={c.key} className="flex items-center" style={{ gap: "var(--space-3)", paddingBlock: "var(--space-2)", borderTop: "1px solid var(--stroke-hairline)" }}>
                  <Checkbox
                    checked={selected.has(c.key)}
                    disabled={!c.isActive}
                    label={`${c.fullName || c.email} — ${c.email}${c.isInternal ? " (internal)" : ""}`}
                    onCheckedChange={(checked) => toggle(c.key, checked)}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Button variant="solid" leadingIcon={Send} loading={sending} disabled={failures.length > 0} onClick={send}>
        Send the audit report
      </Button>
    </div>
  );
}
