/**
 * One campaign.
 *
 * The header answers "which report is this, for whom, from whom, when" before
 * a single figure appears — a number without its subject is what made v1's
 * ratings unusable. The tabs below carry performance, the people it went to,
 * the email itself and everything that has happened to it since.
 *
 * A failed stats read does not fail the page: the header still renders and the
 * Performance tab states that nothing could be measured, rather than showing a
 * zero that cannot be told apart from a real one.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  CalendarClock,
  Clock,
  Mail,
  User,
  type LucideIcon,
} from "lucide-react";
import { Card, Pill } from "@/components/ui";
import { CouldntLoad } from "@/components/campaigns/couldnt-load";
import {
  CampaignTabs,
  type EmailPreview,
} from "@/components/campaigns/campaign-tabs";
import { StatusPill, TestSendPill } from "@/components/campaigns/status-pill";
import {
  getCampaign,
  listCampaignActivity,
  listCampaignRecipients,
} from "@/lib/queries/campaigns";
import { renderReportEmail } from "@/lib/email/render";
import { templateMeta, toTemplateKey } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { fmtDateTime } from "@/lib/utils";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaign(id);

  if (!campaign.ok) {
    return <CouldntLoad what="this campaign" reason={campaign.reason} />;
  }
  if (!campaign.data) notFound();

  const detail = campaign.data;
  const [recipients, activity] = await Promise.all([
    listCampaignRecipients(detail.id),
    listCampaignActivity(detail),
  ]);

  const templateKey = toTemplateKey(detail.templateKey);
  const template = templateMeta(templateKey);

  // One renderer for the preview and the send, so the two can never diverge.
  // The token is a placeholder and the frame is sandboxed, so no tracking URL
  // in this preview can be followed.
  let preview: EmailPreview | null = null;
  let previewReason: string | null = null;
  try {
    const rendered = renderReportEmail({
      templateKey,
      appUrl: env.NEXT_PUBLIC_APP_URL,
      token: "preview",
      clientName: detail.client.name,
      contactFirstName: "there",
      reportNumber: detail.reportNumber,
      reportTitle: detail.title,
      periodLabel: detail.periodLabel,
      subject: detail.subject,
      bodyMd: detail.bodyMd,
      reportUrl: detail.reportUrl,
      attachment: detail.attachmentName
        ? { name: detail.attachmentName, url: detail.attachmentUrl }
        : null,
      feedback: {
        enabled: detail.feedbackEnabled,
        question: detail.feedbackQuestion,
        askComment: true,
      },
      signature: {
        name: detail.sender?.fullName || "Convin Data Labs",
        title: "Data Labs",
        org: "Convin",
        replyTo: detail.sender?.email ?? null,
      },
      isTest: detail.isTest,
    });
    preview = { subject: rendered.subject, html: rendered.html };
  } catch (error) {
    previewReason =
      error instanceof Error
        ? error.message
        : "The stored body could not be rendered.";
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
      <Card style={{ padding: "var(--space-6)" }}>
        <header className="flex flex-col" style={{ gap: "var(--space-4)" }}>
          <div
            className="flex flex-wrap items-center"
            style={{ gap: "var(--space-3)" }}
          >
            <span
              className="t-footnote tabular"
              style={{
                fontFamily: "var(--font-mono)",
                paddingInline: "var(--space-3)",
                paddingBlock: "var(--space-1)",
                borderRadius: "var(--radius-sm)",
                background: "var(--fill-quiet)",
                border: "1px solid var(--stroke-hairline)",
                color: "var(--content-secondary)",
              }}
            >
              {detail.reportNumber ?? "No DL number"}
            </span>
            <StatusPill status={detail.status} />
            {detail.isTest ? <TestSendPill /> : null}
            <Pill tone="neutral">{template.name}</Pill>
          </div>

          <h1
            className="t-title-2"
            style={{ margin: 0, color: "var(--content-primary)" }}
          >
            {detail.title}
          </h1>

          <dl
            className="grid"
            style={{
              margin: 0,
              gap: "var(--space-4)",
              gridTemplateColumns: "repeat(auto-fit, minmax(196px, 1fr))",
            }}
          >
            <Fact icon={Building2} label="Client">
              {detail.client.slug ? (
                <Link
                  href={`/clients/${detail.client.slug}`}
                  className="t-subhead"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    minHeight: "44px",
                    gap: "var(--space-2)",
                    paddingInline: "var(--space-3)",
                    borderRadius: "var(--radius-capsule)",
                    background: "var(--fill-quiet)",
                    border: "1px solid var(--stroke-hairline)",
                    color: "var(--signal-link)",
                    textDecoration: "none",
                  }}
                >
                  {detail.client.name || "Unnamed client"}
                </Link>
              ) : (
                <span style={{ color: "var(--content-tertiary)" }}>
                  Not linked to a client
                </span>
              )}
            </Fact>

            <Fact icon={CalendarClock} label="Series">
              <span className="t-subhead" style={{ color: "var(--content-primary)" }}>
                {detail.series
                  ? `${detail.series.name} · ${detail.series.frequency}`
                  : "Not in a series"}
              </span>
            </Fact>

            <Fact icon={Clock} label={detail.sentAt ? "Sent" : "Not sent yet"}>
              <span
                className="t-subhead tabular"
                style={{ color: "var(--content-primary)" }}
              >
                {detail.sentAt
                  ? fmtDateTime(detail.sentAt)
                  : detail.scheduledFor
                    ? `Scheduled for ${fmtDateTime(detail.scheduledFor)}`
                    : "No send time recorded"}
              </span>
            </Fact>

            <Fact icon={User} label="Sender">
              <span className="t-subhead" style={{ color: "var(--content-primary)" }}>
                {detail.sender?.fullName || detail.sender?.email || "Not recorded"}
              </span>
            </Fact>

            <Fact icon={Mail} label="Period">
              <span className="t-subhead" style={{ color: "var(--content-primary)" }}>
                {detail.periodLabel || "Not set"}
              </span>
            </Fact>
          </dl>
        </header>
      </Card>

      <CampaignTabs
        campaign={detail}
        recipients={recipients}
        activity={activity}
        preview={preview}
        previewReason={previewReason}
      />
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-1)" }}>
      <dt
        className="t-overline flex items-center"
        style={{ gap: "var(--space-1)", color: "var(--content-secondary)" }}
      >
        <Icon size={12} strokeWidth={1.75} aria-hidden="true" />
        {label}
      </dt>
      <dd style={{ margin: 0 }}>{children}</dd>
    </div>
  );
}
