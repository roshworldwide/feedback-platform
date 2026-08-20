"use client";

/**
 * The four faces of one send: how it performed, who received it, what it
 * actually said, and everything that has happened to it since.
 *
 * No panel here computes a rate. Every percentage comes from
 * `src/lib/metrics.ts`, every count comes from `campaign_stats` or
 * `recipient_engagement`, and where a figure excludes internal colleagues the
 * panel says so in words rather than applying the rule mutely.
 */

import * as React from "react";
import {
  BellOff,
  CalendarClock,
  Eye,
  FileText,
  Inbox,
  MailCheck,
  MailX,
  MousePointerClick,
  Paperclip,
  Send,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  KpiCard,
  Pill,
  Segmented,
  StarRating,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  type Column,
} from "@/components/ui";
import {
  FORMULAE,
  bounceRate,
  clickRate,
  clickToOpenRate,
  commentRate,
  deliveryRate,
  responseRate,
  uniqueOpenRate,
} from "@/lib/metrics";
import { fmtDateTime, fmtInt, fmtPct, fmtRating } from "@/lib/utils";
import type {
  ActivityEntry,
  ActivityKind,
  CampaignActivity,
  CampaignDetail,
  QueryResult,
  RecipientList,
  RecipientRow,
} from "@/lib/queries/campaigns";
import { AudiencePill } from "./status-pill";
import { CouldntLoadInline } from "./couldnt-load";
import { Funnel } from "./funnel";
import { COUNT_FORMULAE, exclusionNote, periodOf } from "./stats-adapter";

export type EmailPreview = {
  subject: string;
  html: string;
};

export type CampaignTabsProps = {
  campaign: CampaignDetail;
  recipients: QueryResult<RecipientList>;
  activity: QueryResult<CampaignActivity>;
  /** Rendered by the one email renderer, so preview and send cannot diverge. */
  preview: EmailPreview | null;
  previewReason: string | null;
};

export function CampaignTabs({
  campaign,
  recipients,
  activity,
  preview,
  previewReason,
}: CampaignTabsProps) {
  const recipientCount = recipients.ok ? recipients.data.total : null;
  const activityCount = activity.ok ? activity.data.total : null;

  return (
    <Tabs defaultValue="performance">
      <TabList label="Campaign detail sections">
        <Tab value="performance">Performance</Tab>
        <Tab value="recipients" count={recipientCount}>
          Recipients
        </Tab>
        <Tab value="content">Content</Tab>
        <Tab value="activity" count={activityCount}>
          Activity
        </Tab>
      </TabList>

      <TabPanel value="performance">
        <PerformancePanel campaign={campaign} />
      </TabPanel>

      <TabPanel value="recipients">
        <RecipientsPanel campaign={campaign} recipients={recipients} />
      </TabPanel>

      <TabPanel value="content">
        <ContentPanel
          campaign={campaign}
          preview={preview}
          previewReason={previewReason}
        />
      </TabPanel>

      <TabPanel value="activity">
        <ActivityPanel activity={activity} />
      </TabPanel>
    </Tabs>
  );
}

/* ── Performance ──────────────────────────────────────────────────────────── */

function PerformancePanel({ campaign }: { campaign: CampaignDetail }) {
  const stats = campaign.stats;

  if (!stats) {
    return (
      <Card style={{ padding: "var(--space-6)" }}>
        <CouldntLoadInline
          what="the engagement figures for this report"
          reason="campaign_stats returned no row, so nothing is measured yet. No zero is shown in its place."
        />
      </Card>
    );
  }

  const period = periodOf(stats);
  const note = exclusionNote(stats.recipients_internal);
  const internalOnly = stats.recipients_external === 0 && stats.recipients_internal > 0;

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      {internalOnly ? (
        <Card
          accent="caution"
          style={{
            display: "flex",
            gap: "var(--space-4)",
            padding: "var(--space-6)",
            alignItems: "flex-start",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "grid",
              placeItems: "center",
              width: "var(--space-8)",
              height: "var(--space-8)",
              flex: "none",
              borderRadius: "var(--radius-capsule)",
              background: "var(--fill-quiet)",
              color: "var(--signal-caution)",
            }}
          >
            <Users size={18} strokeWidth={1.75} />
          </span>
          <div style={{ minWidth: 0 }}>
            <p className="t-headline" style={{ margin: 0, color: "var(--content-primary)" }}>
              No client recipients on this send
            </p>
            <p
              className="t-subhead prose-measure"
              style={{ margin: "var(--space-2) 0 0", color: "var(--content-secondary)" }}
            >
              This report went only to {fmtInt(stats.recipients_internal)} internal
              colleague{stats.recipients_internal === 1 ? "" : "s"}, so the figures
              below are structurally zero — internal opens, clicks and ratings never
              count toward client-facing performance.
            </p>
            <p
              className="t-footnote prose-measure"
              style={{ margin: "var(--space-2) 0 0", color: "var(--content-tertiary)" }}
            >
              What actually happened is still fully recorded. Open the Recipients or
              Activity tab to see who opened, clicked or rated it.
            </p>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle
            as="h2"
            description="Every stage, with the number lost between it and the one above."
          >
            Sent to rated
          </CardTitle>
        </CardHeader>
        <CardBody>
          <Funnel stats={stats} />
        </CardBody>
      </Card>

      <div
        className="grid"
        style={{
          gap: "var(--space-4)",
          gridTemplateColumns: "repeat(auto-fit, minmax(212px, 1fr))",
        }}
      >
        <KpiCard
          label="Delivery rate"
          value={fmtPct(deliveryRate(period))}
          formula={FORMULAE.deliveryRate}
          footnote={`${fmtInt(stats.delivered)} delivered of ${fmtInt(
            stats.recipients_external,
          )} attempted.`}
        />
        <KpiCard
          label="Bounce rate"
          value={fmtPct(bounceRate(period))}
          formula={FORMULAE.bounceRate}
          footnote={`${fmtInt(stats.bounced)} bounced.`}
        />
        <KpiCard
          label="Unique open rate"
          value={fmtPct(uniqueOpenRate(period))}
          formula={FORMULAE.uniqueOpenRate}
          footnote={`${fmtInt(stats.unique_opens)} people opened or clicked. ${note}`}
        />
        <KpiCard
          label="Click rate"
          value={fmtPct(clickRate(period))}
          formula={FORMULAE.clickRate}
          footnote={`${fmtInt(stats.unique_clicks)} people opened the report.`}
        />
        <KpiCard
          label="Click to open"
          value={fmtPct(clickToOpenRate(period))}
          formula={FORMULAE.clickToOpen}
          footnote="Of the people who opened, how many went through to the report."
        />
        <KpiCard
          label="Response rate"
          value={fmtPct(responseRate(period))}
          formula={FORMULAE.responseRate}
          footnote={`${fmtInt(stats.ratings)} ratings received.`}
        />
        <KpiCard
          label="Comment rate"
          value={fmtPct(commentRate(period))}
          formula={FORMULAE.commentRate}
          footnote={`${fmtInt(stats.comments)} of the ratings carried a written comment.`}
        />
        <KpiCard
          label="Average rating"
          value={fmtRating(stats.avg_rating)}
          unit="of 5"
          formula={COUNT_FORMULAE.avgRating}
          footnote={
            stats.ratings === 0
              ? "No ratings yet, so no average is shown."
              : `Across ${fmtInt(stats.ratings)} ratings for ${campaign.title}.`
          }
        />
      </div>

      <p
        className="t-footnote prose-measure"
        style={{ margin: 0, color: "var(--content-tertiary)" }}
      >
        {note} Delivered is what the provider accepted and is never labelled
        &ldquo;sent&rdquo;.
        {campaign.isTest
          ? " This is a test send, so it is excluded from every reported total elsewhere."
          : ""}
      </p>
    </div>
  );
}

/* ── Recipients ───────────────────────────────────────────────────────────── */

type AudienceFilter = "everyone" | "not-opened";

function RecipientsPanel({
  campaign,
  recipients,
}: {
  campaign: CampaignDetail;
  recipients: QueryResult<RecipientList>;
}) {
  const [scope, setScope] = React.useState<AudienceFilter>("everyone");

  if (!recipients.ok) {
    return (
      <Card style={{ padding: "var(--space-6)" }}>
        <CouldntLoadInline
          what="the recipients of this report"
          reason={recipients.reason}
        />
      </Card>
    );
  }

  const all = recipients.data.rows;
  const rows = scope === "not-opened" ? all.filter((row) => !row.opened) : all;
  const internal = all.filter((row) => row.isInternal).length;

  const columns: Column<RecipientRow>[] = [
    {
      id: "name",
      header: "Name",
      required: true,
      sortValue: (row) => row.fullName.toLowerCase(),
      render: (row) => (
        <span style={{ color: "var(--content-primary)" }}>
          {row.fullName || "Name not recorded"}
        </span>
      ),
    },
    {
      id: "email",
      header: "Email",
      required: true,
      sortValue: (row) => row.email.toLowerCase(),
      render: (row) => (
        <span
          className="t-footnote"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--content-secondary)",
          }}
        >
          {row.email}
        </span>
      ),
    },
    {
      id: "audience",
      header: "Audience",
      sortValue: (row) => (row.isInternal ? 1 : 0),
      render: (row) => <AudiencePill isInternal={row.isInternal} />,
    },
    {
      id: "delivered",
      header: "Delivered",
      sortValue: (row) => (row.delivered ? 1 : 0),
      render: (row) =>
        row.bounced ? (
          <span className="flex flex-col" style={{ gap: "var(--space-1)" }}>
            <Pill tone="abort">Bounced</Pill>
            <span className="t-micro" style={{ color: "var(--content-tertiary)" }}>
              {row.bounceReason ?? "No reason given"}
            </span>
          </span>
        ) : row.delivered ? (
          <span className="tabular" style={{ color: "var(--content-secondary)" }}>
            {row.deliveredAt ? fmtDateTime(row.deliveredAt) : "Accepted"}
          </span>
        ) : (
          <span style={{ color: "var(--content-tertiary)" }}>Not delivered</span>
        ),
    },
    {
      id: "opened",
      header: "Opened",
      sortValue: (row) => row.firstOpenedAt ?? (row.opened ? "" : null),
      render: (row) =>
        row.opened ? (
          <span className="flex flex-col" style={{ gap: "var(--space-1)" }}>
            <Pill tone="nominal" dot>
              Opened
            </Pill>
            <span
              className="t-micro tabular"
              style={{ color: "var(--content-tertiary)" }}
            >
              {row.firstOpenedAt
                ? fmtDateTime(row.firstOpenedAt)
                : "Time not recorded"}
            </span>
          </span>
        ) : (
          <span style={{ color: "var(--content-tertiary)" }}>Not opened</span>
        ),
    },
    {
      id: "clicked",
      header: "Clicked",
      sortValue: (row) => (row.clicked ? 1 : 0),
      render: (row) =>
        row.clicked ? (
          <Pill tone="nominal">Opened the report</Pill>
        ) : (
          <span style={{ color: "var(--content-tertiary)" }}>No</span>
        ),
    },
    {
      id: "rating",
      // The campaign this rating belongs to is the page you are on, and it is
      // named again in the column header so the figure can never travel alone.
      header: `Rating for ${campaign.reportNumber ?? campaign.title}`,
      sortValue: (row) => row.rating,
      render: (row) =>
        row.rating === null ? (
          <span style={{ color: "var(--content-tertiary)" }}>Not rated</span>
        ) : (
          <StarRating value={row.rating} size="s" showValue />
        ),
    },
    {
      id: "comment",
      header: "Comment",
      sortValue: (row) => row.comment,
      render: (row) =>
        row.comment ? (
          <span
            className="t-footnote"
            title={row.comment}
            style={{
              display: "block",
              maxWidth: "32ch",
              color: "var(--content-secondary)",
            }}
          >
            {row.comment.length > 88
              ? `${row.comment.slice(0, 88).trimEnd()}…`
              : row.comment}
          </span>
        ) : (
          <span style={{ color: "var(--content-tertiary)" }}>—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <div
        className="flex flex-wrap items-center justify-between"
        style={{ gap: "var(--space-4)" }}
      >
        <Segmented
          label="Which recipients to list"
          value={scope}
          onValueChange={setScope}
          options={[
            { value: "everyone", label: "Everyone" },
            { value: "not-opened", label: "Didn't open" },
          ]}
        />
        <p
          className="t-footnote prose-measure"
          style={{ margin: 0, color: "var(--content-tertiary)" }}
        >
          {internal === 0
            ? "No internal colleagues were on this send."
            : `${internal} of these ${
                internal === 1 ? "person is" : "people are"
              } internal and marked as such. Internal recipients are excluded from the headline figures on the Performance tab.`}
        </p>
      </div>

      {recipients.data.incomplete ? (
        <p
          role="status"
          className="t-footnote"
          style={{ margin: 0, color: "var(--signal-caution)" }}
        >
          This report went to {fmtInt(recipients.data.total)} people and the
          first {fmtInt(all.length)} could be read in one pass. The remainder is
          counted but not listed.
        </p>
      ) : null}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.recipientId}
        caption={`Recipients of ${campaign.title}, with delivery, engagement and the rating each left.`}
        pageSizeOptions={[25, 50, 100, 250]}
        emptyState={
          <EmptyState
            icon={Inbox}
            title={
              scope === "not-opened"
                ? "Everybody opened this one"
                : "No recipients recorded"
            }
            description={
              scope === "not-opened"
                ? `All ${fmtInt(all.length)} recipients on record opened or clicked.`
                : "This report has no recipient rows yet, so there is nothing to list."
            }
          />
        }
      />
    </div>
  );
}

/* ── Content ──────────────────────────────────────────────────────────────── */

type Device = "desktop" | "mobile";

const DEVICE_WIDTH: Record<Device, number> = { desktop: 600, mobile: 375 };

function ContentPanel({
  campaign,
  preview,
  previewReason,
}: {
  campaign: CampaignDetail;
  preview: EmailPreview | null;
  previewReason: string | null;
}) {
  const [device, setDevice] = React.useState<Device>("desktop");
  const width = DEVICE_WIDTH[device];

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      <div
        className="flex flex-wrap items-center justify-between"
        style={{ gap: "var(--space-4)" }}
      >
        <Segmented
          label="Preview width"
          value={device}
          onValueChange={setDevice}
          options={[
            { value: "desktop", label: "Desktop 600" },
            { value: "mobile", label: "Mobile 375" },
          ]}
        />
        <p
          className="t-footnote"
          style={{ margin: 0, color: "var(--content-tertiary)" }}
        >
          Subject: {campaign.subject || "Not set"}
        </p>
      </div>

      {preview ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "var(--space-5)",
            background: "var(--surface-grouped)",
            border: "1px solid var(--stroke-rim)",
            borderRadius: "var(--radius-xl)",
          }}
        >
          <div
            style={{
              width: `${width}px`,
              maxWidth: "100%",
              padding: "var(--space-2)",
              background: "var(--surface-raised)",
              border: "1px solid var(--stroke-rim)",
              borderRadius: "var(--radius-xl)",
              boxShadow: "var(--e2)",
              transition: "width var(--dur-glide) var(--ease-glide)",
            }}
          >
            <iframe
              key={device}
              title={`Preview of ${campaign.title} at ${width} pixels wide`}
              srcDoc={preview.html}
              sandbox=""
              className="r-concentric-xl"
              style={{
                display: "block",
                width: "100%",
                height: "720px",
                border: 0,
                background: "var(--surface-canvas)",
              }}
            />
          </div>
        </div>
      ) : (
        <Card style={{ padding: "var(--space-6)" }}>
          <CouldntLoadInline
            what="the email preview"
            reason={
              previewReason ??
              "The stored body could not be rendered, so no approximation is shown."
            }
          />
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle as="h2" description="What this email links to and carries.">
            Attachments and links
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col" style={{ gap: "var(--space-4)" }}>
          <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
            <span className="t-overline" style={{ color: "var(--content-secondary)" }}>
              Attachment
            </span>
            {campaign.attachmentName ? (
              <span className="flex flex-wrap" style={{ gap: "var(--space-2)" }}>
                {campaign.attachmentUrl ? (
                  <a
                    href={campaign.attachmentUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="t-footnote"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      minHeight: "44px",
                      paddingInline: "var(--space-4)",
                      borderRadius: "var(--radius-capsule)",
                      background: "var(--fill-quiet)",
                      border: "1px solid var(--stroke-hairline)",
                      color: "var(--signal-link)",
                      textDecoration: "none",
                    }}
                  >
                    <Paperclip size={14} strokeWidth={1.75} aria-hidden="true" />
                    {campaign.attachmentName}
                  </a>
                ) : (
                  <Pill>
                    <Paperclip size={12} strokeWidth={1.75} aria-hidden="true" />
                    {campaign.attachmentName} — no stored URL
                  </Pill>
                )}
              </span>
            ) : (
              <span className="t-footnote" style={{ color: "var(--content-tertiary)" }}>
                Nothing attached.
              </span>
            )}
          </div>

          <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
            <span className="t-overline" style={{ color: "var(--content-secondary)" }}>
              Report link
            </span>
            {campaign.reportUrl ? (
              <span
                className="flex flex-wrap items-center"
                style={{ gap: "var(--space-3)" }}
              >
                <a
                  href={campaign.reportUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="t-footnote"
                  style={{
                    minHeight: "44px",
                    display: "inline-flex",
                    alignItems: "center",
                    wordBreak: "break-all",
                    color: "var(--signal-link)",
                  }}
                >
                  {campaign.reportUrl}
                </a>
                <span
                  className="t-footnote tabular"
                  style={{ color: "var(--content-secondary)" }}
                >
                  {campaign.stats
                    ? `${fmtInt(campaign.stats.unique_clicks)} ${
                        campaign.stats.unique_clicks === 1 ? "person" : "people"
                      } opened it`
                    : "Click count unavailable"}
                </span>
              </span>
            ) : (
              <span className="t-footnote" style={{ color: "var(--content-tertiary)" }}>
                No report URL was set, so the call to action is not tracked.
              </span>
            )}
          </div>

          <p
            className="t-caption"
            style={{ margin: 0, color: "var(--content-tertiary)" }}
          >
            The click count is unique clickers, not click events — one person
            opening the report twice counts once.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

/* ── Activity ─────────────────────────────────────────────────────────────── */

const ACTIVITY_PAGE = 50;

const KIND_ICON: Record<ActivityKind, LucideIcon> = {
  created: FileText,
  scheduled: CalendarClock,
  sent: Send,
  delivered: MailCheck,
  bounced: MailX,
  open: Eye,
  click: MousePointerClick,
  unsubscribe: BellOff,
  rating: Star,
};

const KIND_LABEL: Record<ActivityKind, string> = {
  created: "Created",
  scheduled: "Scheduled",
  sent: "Sent",
  delivered: "Delivered",
  bounced: "Bounced",
  open: "Opened",
  click: "Opened the report",
  unsubscribe: "Unsubscribed",
  rating: "Rated",
};

const KIND_INK: Record<ActivityKind, string> = {
  created: "var(--content-tertiary)",
  scheduled: "var(--content-tertiary)",
  sent: "var(--content-secondary)",
  delivered: "var(--signal-nominal)",
  bounced: "var(--signal-abort)",
  open: "var(--signal-link)",
  click: "var(--signal-link)",
  unsubscribe: "var(--signal-caution)",
  rating: "var(--content-secondary)",
};

function ActivityPanel({ activity }: { activity: QueryResult<CampaignActivity> }) {
  const [shown, setShown] = React.useState(ACTIVITY_PAGE);

  if (!activity.ok) {
    return (
      <Card style={{ padding: "var(--space-6)" }}>
        <CouldntLoadInline
          what="the activity for this report"
          reason={activity.reason}
        />
      </Card>
    );
  }

  const entries = activity.data.entries;
  const visible = entries.slice(0, shown);

  if (entries.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Inbox}
          title="Nothing has happened yet"
          description="No opens, clicks, bounces or ratings have been recorded against this report."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <Card>
        <CardBody style={{ padding: "var(--space-5)" }}>
          <ol
            className="flex flex-col"
            style={{ gap: "var(--space-4)", margin: 0, padding: 0, listStyle: "none" }}
          >
            {visible.map((entry) => (
              <ActivityLine key={entry.id} entry={entry} />
            ))}
          </ol>
        </CardBody>
      </Card>

      <div
        className="flex flex-wrap items-center justify-between"
        style={{ gap: "var(--space-3)" }}
      >
        <p
          className="t-footnote tabular"
          aria-live="polite"
          style={{ margin: 0, color: "var(--content-secondary)" }}
        >
          Showing 1–{fmtInt(visible.length)} of {fmtInt(activity.data.total)}
          {activity.data.incomplete
            ? " — the remainder is counted but beyond the read limit"
            : ""}
        </p>
        {shown < entries.length ? (
          <Button
            size="s"
            variant="tinted"
            onClick={() => setShown((value) => value + ACTIVITY_PAGE)}
          >
            Show more
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ActivityLine({ entry }: { entry: ActivityEntry }) {
  const Icon = KIND_ICON[entry.kind];
  return (
    <li className="flex items-start" style={{ gap: "var(--space-3)" }}>
      <span
        aria-hidden="true"
        style={{
          display: "grid",
          placeItems: "center",
          width: "var(--space-8)",
          height: "var(--space-8)",
          flex: "none",
          borderRadius: "var(--radius-capsule)",
          background: "var(--fill-quiet)",
          border: "1px solid var(--stroke-hairline)",
          color: KIND_INK[entry.kind],
        }}
      >
        <Icon size={15} strokeWidth={1.75} />
      </span>

      <span className="flex flex-col" style={{ gap: "var(--space-1)", minWidth: 0 }}>
        <span
          className="flex flex-wrap items-center"
          style={{ gap: "var(--space-2)" }}
        >
          <span className="t-subhead" style={{ color: "var(--content-primary)" }}>
            {KIND_LABEL[entry.kind]}
          </span>
          {entry.who ? (
            <span
              className="t-footnote"
              style={{ color: "var(--content-secondary)" }}
            >
              {entry.who}
            </span>
          ) : null}
          {entry.isInternal ? <AudiencePill isInternal /> : null}
        </span>

        <span
          className="t-caption tabular"
          style={{ color: "var(--content-tertiary)" }}
        >
          {fmtDateTime(entry.occurredAt)}
          {entry.detail ? ` · ${entry.detail}` : ""}
        </span>
      </span>
    </li>
  );
}
