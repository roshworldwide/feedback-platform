/**
 * One client, end to end.
 *
 * Every read is a result, and each one fails on its own: a broken feedback
 * query does not take the header, the contacts or the send history down with
 * it. Where a read fails the tab says so, and no figure is invented to fill
 * the hole.
 *
 * All grouping happens here, on the server, from the views the metric layer
 * defines — so the trend on this page is the same arithmetic as the figure on
 * the campaign page, arrived at once.
 */

import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Building2, Clock, Send, User, UserCircle, type LucideIcon } from "lucide-react";
import { Avatar, Card, Pill } from "@/components/ui";
import { CouldntLoad } from "@/components/campaigns/couldnt-load";
import { ClientTabs } from "@/components/clients/client-tabs";
import type {
  CampaignsView,
  FeedbackView,
  PeopleView,
} from "@/components/clients/client-tabs";
import { HealthPill } from "@/components/clients/health-pill";
import { CLIENT_STATUS_LABEL, HEALTH_RULE } from "@/components/clients/vocabulary";
import {
  cadenceOf,
  coverageGapOf,
  peopleOf,
  topEngaged,
  trendOf,
} from "@/components/clients/view-model";
import {
  engagementByPerson,
  getClientBySlug,
  listClientCampaignStats,
  listClientContacts,
  listClientEngagement,
  listClientFeedback,
  listOwners,
} from "@/lib/queries/clients";
import type { QueryResult } from "@/lib/queries/campaigns";
import { internalDomains } from "@/lib/env";
import { getSessionProfile } from "@/lib/supabase/server";
import { fmtDate, fmtInt, fmtRating, relativeDays } from "@/lib/utils";

const TOP_PEOPLE = 5;

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);

  if (!client.ok) {
    return <CouldntLoad what="this client" reason={client.reason} />;
  }
  if (!client.data) notFound();

  const detail = client.data;

  const [contacts, engagement, campaignStats, feedbackRows, owners, profile] =
    await Promise.all([
      listClientContacts(detail.id),
      listClientEngagement(detail.id),
      listClientCampaignStats(detail.id),
      listClientFeedback(detail.id),
      listOwners(),
      getSessionProfile(),
    ]);

  const isManager = profile !== null && ["admin", "team_lead"].includes(String(profile.role));

  /* People — contacts joined to their engagement. A contact with no rows is
     kept, because a person nobody has written to is the finding. */
  let people: QueryResult<PeopleView>;
  if (!contacts.ok) {
    people = { ok: false, reason: contacts.reason };
  } else if (!engagement.ok) {
    people = { ok: false, reason: engagement.reason };
  } else {
    const rows = peopleOf(contacts.data.rows, engagementByPerson(engagement.data.rows));
    people = {
      ok: true,
      data: {
        rows,
        total: contacts.data.total,
        incomplete: contacts.data.incomplete || engagement.data.incomplete,
        top: topEngaged(rows, TOP_PEOPLE),
        coverage: coverageGapOf(rows),
      },
    };
  }

  const campaigns: QueryResult<CampaignsView> = campaignStats.ok
    ? (() => {
        const points = trendOf(campaignStats.data.rows);
        return {
          ok: true,
          data: {
            points,
            cadence: cadenceOf(points),
            total: campaignStats.data.total,
            incomplete: campaignStats.data.incomplete,
            // Read once, on the server, against the request clock.
            daysSinceLastSend: relativeDays(detail.health?.lastSentAt ?? null),
          },
        };
      })()
    : { ok: false, reason: campaignStats.reason };

  const feedback: QueryResult<FeedbackView> = feedbackRows.ok
    ? { ok: true, data: feedbackRows.data }
    : { ok: false, reason: feedbackRows.reason };

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
      <Card style={{ padding: "var(--space-6)" }}>
        <header className="flex flex-col" style={{ gap: "var(--space-4)" }}>
          <div className="flex items-start" style={{ gap: "var(--space-4)" }}>
            <Avatar name={detail.name} size={56} />
            <div style={{ minWidth: 0, flex: "1 1 auto" }}>
              <h1
                className="t-title-2"
                style={{ margin: 0, color: "var(--content-primary)" }}
              >
                {detail.name}
              </h1>
              <p
                className="t-footnote"
                style={{
                  margin: "var(--space-1) 0 0",
                  fontFamily: "var(--font-mono)",
                  color: "var(--content-tertiary)",
                }}
              >
                /{detail.slug}
              </p>
            </div>
            <div
              className="flex flex-wrap items-center"
              style={{ gap: "var(--space-2)" }}
            >
              <Pill tone="neutral">{CLIENT_STATUS_LABEL[detail.status]}</Pill>
              <HealthPill health={detail.health?.health ?? null} />
            </div>
          </div>

          {detail.tags.length > 0 ? (
            <div className="flex flex-wrap" style={{ gap: "var(--space-2)" }}>
              {detail.tags.map((tag) => (
                <Pill key={tag}>{tag}</Pill>
              ))}
            </div>
          ) : null}

          <dl
            className="grid"
            style={{
              margin: 0,
              gap: "var(--space-4)",
              gridTemplateColumns: "repeat(auto-fit, minmax(196px, 1fr))",
            }}
          >
            <Fact icon={User} label="Owner">
              {detail.ownerName ?? "Unassigned"}
            </Fact>
            <Fact icon={UserCircle} label="Primary contact">
              {detail.primaryContactName ?? "Not set"}
              {detail.primaryContactName && detail.health
                ? ` · ${fmtInt(detail.health.campaignsSent)} report${detail.health.campaignsSent === 1 ? "" : "s"}`
                : ""}
            </Fact>
            <Fact icon={Building2} label="Contacts">
              {detail.health
                ? `${fmtInt(detail.health.externalContacts)} client${
                    detail.health.internalContacts > 0
                      ? `, plus ${fmtInt(detail.health.internalContacts)} internal`
                      : ""
                  }`
                : "Not counted"}
            </Fact>
            <Fact icon={Send} label="Reports sent">
              {detail.health ? fmtInt(detail.health.campaignsSent) : "Not counted"}
            </Fact>
            <Fact icon={Clock} label="Last send">
              {detail.health?.lastSentAt
                ? fmtDate(detail.health.lastSentAt)
                : "Never"}
            </Fact>
            <Fact icon={Clock} label="Average rating">
              {detail.health && detail.health.ratings > 0
                ? `${fmtRating(detail.health.avgRating)} across ${fmtInt(
                    detail.health.ratings,
                  )} ratings on ${fmtInt(detail.health.campaignsSent)} reports`
                : "No ratings yet"}
            </Fact>
          </dl>

          <p
            className="t-caption prose-measure"
            style={{ margin: 0, color: "var(--content-tertiary)" }}
          >
            Health is read from the client_health view, never assumed.{" "}
            {HEALTH_RULE}
          </p>
        </header>
      </Card>

      <ClientTabs
        client={detail}
        owners={owners.ok ? owners.data : []}
        ownersReason={owners.ok ? null : owners.reason}
        campaigns={campaigns}
        people={people}
        feedback={feedback}
        isManager={isManager}
        internalDomains={internalDomains()}
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
      <dd
        className="t-subhead tabular"
        style={{ margin: 0, color: "var(--content-primary)" }}
      >
        {children}
      </dd>
    </div>
  );
}
