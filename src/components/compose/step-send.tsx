"use client";

/**
 * Step 5 · Send.
 *
 * The confirmation restates the client by name, the recipient count split into
 * client and internal, and the exact instant — in the timezone chosen and in
 * UTC — because the three things people get wrong about a send are who it went
 * to, how many, and when.
 *
 * Nothing is sent until every blocking check passes. The action re-runs the
 * same checklist server-side against the recipients the database returns, so
 * this button being enabled is a courtesy, not the control.
 */

import * as React from "react";
import Link from "next/link";
import type { EmailProvider } from "@/lib/email/send";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Repeat,
  Send,
} from "lucide-react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Pill,
  Segmented,
  Select,
  useToast,
} from "@/components/ui";
import { sendCampaignAction } from "@/app/(app)/compose/actions";
import {
  TIMEZONES,
  blockingFailures,
  preflight,
  recipientSentence,
  summariseRecipients,
  zonedToUtcISO,
  type ComposeDoc,
  type ComposeStep,
  type RecipientChoice,
  type SendMode,
  type SentCampaign,
  type SeriesOption,
  type Timezone,
} from "./vocabulary";

export type StepSendProps = {
  doc: ComposeDoc;
  patch: (change: Partial<ComposeDoc>) => void;
  draftId: string;
  clientName: string | null;
  chosen: RecipientChoice[];
  series: SeriesOption[] | null;
  /** "resend" or "gmail" when a provider is configured, "dev" when it only logs. */
  provider: EmailProvider;
  onGo: (step: ComposeStep) => void;
  /** Saves the draft before the send, so a failure loses nothing. */
  onBeforeSend: () => Promise<void>;
};

function instantIn(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function StepSend({
  doc,
  patch,
  draftId,
  clientName,
  chosen,
  series,
  provider,
  onGo,
  onBeforeSend,
}: StepSendProps) {
  const { toast } = useToast();
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState<SentCampaign | null>(null);

  const checks = preflight(doc, chosen);
  const failures = blockingFailures(checks);
  const summary = summariseRecipients(chosen);

  const seriesForClient = (series ?? []).filter((item) => item.clientId === doc.clientId);
  const chosenSeries = seriesForClient.find((item) => item.id === doc.seriesId) ?? null;

  const scheduled =
    doc.sendMode === "now"
      ? null
      : zonedToUtcISO(doc.scheduledDate, doc.scheduledTime, doc.timezone);

  const scheduleIncomplete = doc.sendMode !== "now" && scheduled === null;
  const seriesMissing = doc.sendMode === "series" && !doc.seriesId;

  const blocked =
    failures.length > 0 || scheduleIncomplete || seriesMissing || sent !== null;

  function send() {
    setBusy(true);
    void onBeforeSend()
      .then(() => sendCampaignAction(doc, draftId))
      .then((result) => {
        setBusy(false);
        setConfirming(false);
        if (!result.ok) {
          toast({ message: result.message, tone: "abort" });
          return;
        }
        setSent(result.data);
      });
  }

  if (sent) {
    return (
      <Card elevation="e1" accent="nominal">
        <CardBody
          className="flex flex-col"
          style={{ gap: "var(--space-4)", padding: "var(--space-6)" }}
        >
          <div className="flex items-start" style={{ gap: "var(--space-4)" }}>
            <CheckCircle2
              size={22}
              strokeWidth={1.75}
              aria-hidden="true"
              style={{ flex: "none", color: "var(--signal-nominal)" }}
            />
            <div style={{ minWidth: 0 }}>
              <h2
                className="t-title-3"
                style={{ margin: 0, color: "var(--content-primary)" }}
              >
                {sent.status === "sent"
                  ? `Sent to ${sent.accepted} of ${sent.attempted}`
                  : `Scheduled for ${sent.clientName}`}
              </h2>
              <p
                className="t-subhead prose-measure tabular"
                style={{ margin: "var(--space-2) 0 0", color: "var(--content-secondary)" }}
              >
                {sent.status === "sent" ? (
                  <>
                    {sent.clientName} · {sent.accepted} accepted by the provider
                    {sent.failed > 0
                      ? `, ${sent.failed} rejected and recorded as bounced`
                      : ""}
                    . Accepted is not the same as read — opens and clicks arrive
                    as recipients act.
                  </>
                ) : (
                  <>
                    {sent.attempted} recipients ·{" "}
                    {sent.scheduledFor
                      ? `${instantIn(sent.scheduledFor, doc.timezone)} ${doc.timezone}`
                      : "time unavailable"}
                  </>
                )}
              </p>
              {provider === "dev" && sent.status === "sent" ? (
                <p
                  className="t-footnote prose-measure"
                  style={{ margin: "var(--space-2) 0 0", color: "var(--signal-caution)" }}
                >
                  No mail provider is configured, so the messages were logged on
                  the server rather than delivered. The campaign and its
                  recipients are real; the delivery was not.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center" style={{ gap: "var(--space-3)" }}>
            <Button
              as={Link}
              href={`/campaigns/${sent.campaignId}`}
              variant="metal"
              trailingIcon={ArrowRight}
            >
              Open the campaign
            </Button>
            <Button as={Link} href="/compose" variant="glass">
              Back to drafts
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      <Card elevation="e1">
        <CardHeader>
          <CardTitle as="h2" description="Three ways out of this screen. Pick one.">
            When it goes
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col" style={{ gap: "var(--space-5)" }}>
          <Segmented
            fullWidth
            label="When to send"
            value={doc.sendMode}
            onValueChange={(sendMode: SendMode) => patch({ sendMode })}
            options={[
              { value: "now", label: "Send now" },
              { value: "schedule", label: "Schedule for" },
              { value: "series", label: "Add to series" },
            ]}
          />

          {doc.sendMode === "now" ? (
            <p
              className="t-subhead prose-measure"
              style={{ margin: 0, color: "var(--content-secondary)" }}
            >
              The report goes out as soon as you confirm. Each recipient gets
              their own copy with their own tracking token — one message per
              person, never a shared BCC.
            </p>
          ) : (
            <div
              className="grid"
              style={{
                gap: "var(--space-4)",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <Field
                label="Date"
                required
                error={doc.scheduledDate === "" ? "Pick the day it should go." : null}
              >
                <input
                  type="date"
                  value={doc.scheduledDate}
                  aria-label="Send date"
                  onChange={(event) => patch({ scheduledDate: event.currentTarget.value })}
                  className="t-subhead"
                  style={{
                    width: "100%",
                    minHeight: "var(--cap-m-h)",
                    padding: "var(--space-3) var(--space-4)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--surface-raised)",
                    border: "1px solid var(--stroke-rim)",
                    color: "var(--content-primary)",
                    boxShadow: "var(--e1)",
                  }}
                />
              </Field>

              <Field label="Time" required>
                <input
                  type="time"
                  value={doc.scheduledTime}
                  aria-label="Send time"
                  onChange={(event) => patch({ scheduledTime: event.currentTarget.value })}
                  className="t-subhead tabular"
                  style={{
                    width: "100%",
                    minHeight: "var(--cap-m-h)",
                    padding: "var(--space-3) var(--space-4)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--surface-raised)",
                    border: "1px solid var(--stroke-rim)",
                    color: "var(--content-primary)",
                    boxShadow: "var(--e1)",
                  }}
                />
              </Field>

              <Field label="Timezone" hint="The client's working hours, not yours.">
                <Select
                  options={TIMEZONES.map((zone) => ({ value: zone, label: zone }))}
                  value={doc.timezone}
                  aria-label="Timezone"
                  onChange={(event) =>
                    patch({ timezone: event.currentTarget.value as Timezone })
                  }
                />
              </Field>
            </div>
          )}

          {doc.sendMode === "series" ? (
            <Field
              label="Recurring series"
              required
              error={seriesMissing ? "Pick the series this report belongs to." : null}
              hint="The campaign is attached to the series and the series' next run is set to this instant."
            >
              <Select
                options={[
                  { value: "", label: "Choose a series" },
                  ...seriesForClient.map((item) => ({
                    value: item.id,
                    label: `${item.name} · ${item.frequency}`,
                  })),
                ]}
                value={doc.seriesId ?? ""}
                aria-label="Recurring series"
                onChange={(event) => patch({ seriesId: event.currentTarget.value || null })}
              />
            </Field>
          ) : null}

          {scheduled ? (
            <p
              className="t-footnote tabular"
              style={{ margin: 0, color: "var(--content-tertiary)" }}
            >
              {instantIn(scheduled, doc.timezone)} in {doc.timezone} — stored as{" "}
              {scheduled}. Times are held in UTC so a daylight-saving change
              cannot move a send by an hour.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card elevation="e1" accent={failures.length > 0 ? "abort" : undefined}>
        <CardHeader>
          <CardTitle as="h2" description="What confirming will do.">
            Summary
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col" style={{ gap: "var(--space-3)" }}>
          <dl
            className="grid"
            style={{
              margin: 0,
              gap: "var(--space-4)",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <div>
              <dt className="t-caption" style={{ color: "var(--content-tertiary)" }}>
                Client
              </dt>
              <dd className="t-subhead" style={{ margin: 0, fontWeight: 600 }}>
                {clientName ?? "Not set"}
              </dd>
            </div>
            <div>
              <dt className="t-caption" style={{ color: "var(--content-tertiary)" }}>
                Recipients
              </dt>
              <dd className="t-subhead tabular" style={{ margin: 0, fontWeight: 600 }}>
                {recipientSentence(summary)}
              </dd>
            </div>
            <div>
              <dt className="t-caption" style={{ color: "var(--content-tertiary)" }}>
                When
              </dt>
              <dd className="t-subhead tabular" style={{ margin: 0, fontWeight: 600 }}>
                {doc.sendMode === "now"
                  ? "As soon as you confirm"
                  : scheduled
                    ? `${instantIn(scheduled, doc.timezone)} ${doc.timezone}`
                    : "Not set"}
              </dd>
            </div>
            <div>
              <dt className="t-caption" style={{ color: "var(--content-tertiary)" }}>
                Series
              </dt>
              <dd className="t-subhead" style={{ margin: 0, fontWeight: 600 }}>
                {chosenSeries ? chosenSeries.name : "One-off report"}
              </dd>
            </div>
          </dl>

          {provider === "dev" ? (
            <p
              role="status"
              className="t-footnote prose-measure"
              style={{ margin: 0, color: "var(--signal-caution)" }}
            >
              No mail provider is configured on this environment. A send will
              create the campaign and its recipients and log each message to the
              server instead of delivering it. Set <code>RESEND_API_KEY</code>, or{" "}
              <code>GMAIL_USER</code>/<code>GMAIL_APP_PASSWORD</code>, to deliver
              for real.
            </p>
          ) : null}

          {failures.length > 0 ? (
            <div
              role="alert"
              className="flex flex-col"
              style={{ gap: "var(--space-2)" }}
            >
              <p
                className="t-subhead"
                style={{ margin: 0, color: "var(--signal-abort)", fontWeight: 600 }}
              >
                {failures.length} {failures.length === 1 ? "check" : "checks"} must
                pass first
              </p>
              <ul style={{ margin: 0, paddingLeft: "var(--space-5)" }}>
                {failures.map((check) => (
                  <li
                    key={check.id}
                    className="t-footnote prose-measure"
                    style={{ color: "var(--content-secondary)" }}
                  >
                    {check.detail}
                  </li>
                ))}
              </ul>
              <div>
                <Button
                  size="s"
                  variant="tinted"
                  trailingIcon={ArrowRight}
                  onClick={() => onGo("review")}
                >
                  Back to pre-flight
                </Button>
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center" style={{ gap: "var(--space-3)" }}>
        {/* The one Aurum element on this screen. */}
        <Button
          variant="metal"
          size="l"
          leadingIcon={
            doc.sendMode === "now" ? Send : doc.sendMode === "series" ? Repeat : CalendarClock
          }
          disabled={blocked}
          onClick={() => setConfirming(true)}
        >
          {doc.sendMode === "now"
            ? "Send report"
            : doc.sendMode === "series"
              ? "Add to series"
              : "Schedule report"}
        </Button>
        {blocked && failures.length === 0 ? (
          <Pill tone="caution">Set the date, the time and the series first</Pill>
        ) : null}
      </div>

      <Alert
        open={confirming}
        onClose={() => setConfirming(false)}
        title={
          doc.sendMode === "now"
            ? `Send to ${summary.total} ${summary.total === 1 ? "person" : "people"}?`
            : `Schedule for ${clientName ?? "this client"}?`
        }
        body={
          <span className="tabular">
            {clientName ?? "No client"} · {recipientSentence(summary)}.{" "}
            {doc.sendMode === "now"
              ? "Each person receives their own copy immediately."
              : scheduled
                ? `It goes at ${instantIn(scheduled, doc.timezone)} ${doc.timezone}.`
                : "The time is not set."}
            {summary.bounced > 0
              ? ` ${summary.bounced} of these addresses has bounced before.`
              : ""}
          </span>
        }
        safeAction={{ label: "Not yet", onClick: () => setConfirming(false) }}
        dangerAction={{
          label: doc.sendMode === "now" ? "Send report" : "Schedule report",
          destructive: false,
          loading: busy,
          onClick: send,
        }}
      />
    </div>
  );
}
