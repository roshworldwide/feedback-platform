"use client";

/**
 * The client, in five views.
 *
 * Overview is the account's shape over time; Contacts is who is actually on
 * the list and whether they read anything; Campaigns is every report sent;
 * Feedback is every rating WITH the report it was left against — a rating
 * without its campaign is unusable, which is what v1's feedback screen was.
 * Details is the record itself, editable.
 *
 * Nothing here computes a rate. Every percentage arrives already derived by
 * `src/lib/metrics.ts`, and every count of people states whether internal
 * colleagues are in it.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MailQuestion,
  MessageSquareQuote,
  Send,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  Field,
  Pill,
  Select,
  StarRating,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextArea,
  TextInput,
  useToast,
  type Column,
  type SelectOption,
} from "@/components/ui";
import { AudiencePill, StatusPill } from "@/components/campaigns/status-pill";
import { CouldntLoadInline } from "@/components/campaigns/couldnt-load";
import { fmtDate, fmtDateTime, fmtInt, fmtPct, fmtRating } from "@/lib/utils";
import type {
  ClientDetail,
  ClientFeedbackRow,
  OwnerOption,
} from "@/lib/queries/clients";
import type { QueryResult } from "@/lib/queries/campaigns";
import { CLIENT_STATUSES, CLIENT_STATUS_LABEL } from "./vocabulary";
import { IDLE_CLIENT_FORM } from "./action-types";
import {
  archiveClientAction,
  clearContactBounceAction,
  removeClientAction,
  setContactActiveAction,
  setPrimaryContactAction,
  updateClientAction,
} from "./actions";
import { ContactBulkSheet } from "./contact-bulk-sheet";
import { ContactFormSheet } from "./contact-form-sheet";
import type { CadencePoint, CoverageGap, PersonRow, TrendPoint } from "./view-model";

/* ── Shapes the server hands over ─────────────────────────────────────────── */

export type CampaignsView = {
  /** Oldest first — a trend reads the way time does. */
  points: TrendPoint[];
  cadence: CadencePoint[];
  total: number;
  incomplete: boolean;
  /**
   * Measured on the server against the request clock. Reading the clock
   * during render would make this number change on a re-render that changed
   * nothing.
   */
  daysSinceLastSend: number | null;
};

export type PeopleView = {
  rows: PersonRow[];
  total: number;
  incomplete: boolean;
  top: PersonRow[];
  coverage: CoverageGap;
};

export type FeedbackView = {
  rows: ClientFeedbackRow[];
  total: number;
  incomplete: boolean;
};

export type ClientTabsProps = {
  client: ClientDetail;
  owners: OwnerOption[];
  ownersReason: string | null;
  campaigns: QueryResult<CampaignsView>;
  people: QueryResult<PeopleView>;
  feedback: QueryResult<FeedbackView>;
  /** Only a manager (admin or team lead) sees the destructive action below. */
  isManager: boolean;
  /** For the internal/client pre-fill when a contact is added or pasted. */
  internalDomains: string[];
};

const TREND_WINDOW = 12;

export function ClientTabs({
  client,
  owners,
  ownersReason,
  campaigns,
  people,
  feedback,
  isManager,
  internalDomains,
}: ClientTabsProps) {
  return (
    <Tabs defaultValue="overview">
      <TabList label="Client sections">
        <Tab value="overview">Overview</Tab>
        <Tab value="contacts" count={people.ok ? people.data.total : null}>
          Contacts
        </Tab>
        <Tab value="campaigns" count={campaigns.ok ? campaigns.data.total : null}>
          Campaigns
        </Tab>
        <Tab value="feedback" count={feedback.ok ? feedback.data.total : null}>
          Feedback
        </Tab>
        <Tab value="details">Details</Tab>
      </TabList>

      <TabPanel value="overview">
        <OverviewPanel campaigns={campaigns} people={people} />
      </TabPanel>

      <TabPanel value="contacts">
        <ContactsPanel client={client} people={people} internalDomains={internalDomains} />
      </TabPanel>

      <TabPanel value="campaigns">
        <CampaignsPanel campaigns={campaigns} />
      </TabPanel>

      <TabPanel value="feedback">
        <FeedbackPanel feedback={feedback} />
      </TabPanel>

      <TabPanel value="details">
        <DetailsPanel
          client={client}
          owners={owners}
          ownersReason={ownersReason}
          isManager={isManager}
        />
      </TabPanel>
    </Tabs>
  );
}

/* ── Overview ─────────────────────────────────────────────────────────────── */

function OverviewPanel({
  campaigns,
  people,
}: {
  campaigns: QueryResult<CampaignsView>;
  people: QueryResult<PeopleView>;
}) {
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      {people.ok ? <CoverageCallout coverage={people.data.coverage} /> : null}

      <div
        className="grid"
        style={{
          gap: "var(--space-4)",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle
              as="h2"
              description="Unique openers and clickers over delivered, report by report."
            >
              Engagement trend
            </CardTitle>
          </CardHeader>
          <CardBody>
            {campaigns.ok ? (
              <EngagementTrend view={campaigns.data} />
            ) : (
              <CouldntLoadInline
                what="the engagement trend"
                reason={campaigns.reason}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle
              as="h2"
              description="Every average shown beside the report it belongs to."
            >
              Satisfaction trend
            </CardTitle>
          </CardHeader>
          <CardBody>
            {campaigns.ok ? (
              <CsatTrend view={campaigns.data} />
            ) : (
              <CouldntLoadInline
                what="the satisfaction trend"
                reason={campaigns.reason}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2" description="The gap between one report and the next.">
              Send cadence
            </CardTitle>
          </CardHeader>
          <CardBody>
            {campaigns.ok ? (
              <Cadence view={campaigns.data} />
            ) : (
              <CouldntLoadInline what="the send cadence" reason={campaigns.reason} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle
              as="h2"
              description="Client contacts only — internal colleagues are not ranked here."
            >
              Top-engaged contacts
            </CardTitle>
          </CardHeader>
          <CardBody>
            {people.ok ? (
              <TopEngaged view={people.data} />
            ) : (
              <CouldntLoadInline
                what="the contact engagement"
                reason={people.reason}
              />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function CoverageCallout({ coverage }: { coverage: CoverageGap }) {
  const gaps = coverage.neverSent.length;
  const silent = coverage.neverOpened.length;

  if (gaps === 0 && silent === 0) {
    return (
      <Card accent="nominal" style={{ padding: "var(--space-5)" }}>
        <p className="t-subhead" style={{ margin: 0, color: "var(--content-primary)" }}>
          Every one of the {fmtInt(coverage.externalTotal)} active client contacts
          has been sent a report, and every one of them has opened at least one.
        </p>
      </Card>
    );
  }

  return (
    <Card accent="caution" style={{ padding: "var(--space-5)" }} role="note">
      <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
        <p
          className="t-headline"
          style={{ margin: 0, color: "var(--content-primary)" }}
        >
          Coverage gap
        </p>
        <p
          className="t-subhead prose-measure"
          style={{ margin: 0, color: "var(--content-secondary)" }}
        >
          {gaps > 0
            ? `${fmtInt(gaps)} of ${fmtInt(coverage.externalTotal)} active client contacts have never been on a send.`
            : ""}
          {gaps > 0 && silent > 0 ? " " : ""}
          {silent > 0
            ? `${fmtInt(silent)} have been sent to and have never opened one.`
            : ""}
        </p>

        {gaps > 0 ? (
          <div className="flex flex-wrap" style={{ gap: "var(--space-2)" }}>
            {coverage.neverSent.slice(0, 8).map((person) => (
              <Pill key={person.contactId} tone="caution">
                {person.fullName}
              </Pill>
            ))}
            {coverage.neverSent.length > 8 ? (
              <span
                className="t-footnote tabular"
                style={{ color: "var(--content-secondary)" }}
              >
                +{fmtInt(coverage.neverSent.length - 8)} more — the full list is
                on the Contacts tab
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function TrendWindowNote({ shown, total }: { shown: number; total: number }) {
  if (total <= shown) return null;
  return (
    <p
      className="t-caption tabular"
      style={{ margin: 0, color: "var(--content-tertiary)" }}
    >
      Showing the most recent {fmtInt(shown)} of {fmtInt(total)} reports sent.
    </p>
  );
}

function Bar({ share, tone }: { share: number | null; tone: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "block",
        height: "var(--space-2)",
        borderRadius: "var(--radius-capsule)",
        background: "var(--fill-quiet)",
        border: "1px solid var(--stroke-hairline)",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          display: "block",
          height: "100%",
          width: `${Math.max(0, Math.min(100, share ?? 0))}%`,
          borderRadius: "var(--radius-capsule)",
          background: tone,
        }}
      />
    </span>
  );
}

function EngagementTrend({ view }: { view: CampaignsView }) {
  const points = view.points.slice(-TREND_WINDOW);

  if (points.length === 0) {
    return (
      <EmptyState
        icon={Send}
        title="No report has been sent yet"
        description="The trend starts with the first send. Nothing is charted from nothing."
      />
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <ol
        className="flex flex-col"
        style={{ gap: "var(--space-3)", margin: 0, padding: 0, listStyle: "none" }}
      >
        {points.map((point) => (
          <li key={point.campaignId} className="flex flex-col" style={{ gap: "var(--space-1)" }}>
            <span
              className="flex flex-wrap items-baseline justify-between"
              style={{ gap: "var(--space-2)" }}
            >
              <Link
                href={`/campaigns/${point.campaignId}`}
                className="t-footnote"
                style={{ color: "var(--signal-link)", textDecoration: "none" }}
              >
                {point.reportNumber ?? point.title}
              </Link>
              <span
                className="t-caption tabular"
                style={{ color: "var(--content-secondary)" }}
              >
                Open {fmtPct(point.openRate)} · Click {fmtPct(point.clickRate)} ·{" "}
                {fmtInt(point.delivered)} delivered
              </span>
            </span>
            <Bar
              share={point.openRate}
              tone="color-mix(in oklab, var(--signal-link) 34%, transparent)"
            />
            <Bar
              share={point.clickRate}
              tone="color-mix(in oklab, var(--signal-nominal) 34%, transparent)"
            />
          </li>
        ))}
      </ol>

      <TrendWindowNote shown={points.length} total={view.total} />
      <p className="t-caption" style={{ margin: 0, color: "var(--content-tertiary)" }}>
        The upper bar is unique openers over delivered; the lower is unique
        clickers over delivered. Internal recipients are excluded from both.
      </p>
    </div>
  );
}

function CsatTrend({ view }: { view: CampaignsView }) {
  const points = view.points.slice(-TREND_WINDOW).filter((point) => point.ratings > 0);

  if (points.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareQuote}
        title="No ratings yet"
        description="No report from this account has been rated, so there is no average to show."
      />
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <ol
        className="flex flex-col"
        style={{ gap: "var(--space-3)", margin: 0, padding: 0, listStyle: "none" }}
      >
        {points.map((point) => (
          <li key={point.campaignId} className="flex flex-col" style={{ gap: "var(--space-1)" }}>
            <span
              className="flex flex-wrap items-center justify-between"
              style={{ gap: "var(--space-2)" }}
            >
              {/* The average never travels without the report it belongs to. */}
              <Link
                href={`/campaigns/${point.campaignId}`}
                className="t-footnote"
                style={{ color: "var(--signal-link)", textDecoration: "none" }}
              >
                {point.reportNumber ? `${point.reportNumber} · ` : ""}
                {point.title}
              </Link>
              <span className="flex items-center" style={{ gap: "var(--space-2)" }}>
                <StarRating value={point.avgRating} size="s" showValue />
                <span
                  className="t-caption tabular"
                  style={{ color: "var(--content-tertiary)" }}
                >
                  {fmtInt(point.ratings)}{" "}
                  {point.ratings === 1 ? "rating" : "ratings"}
                </span>
              </span>
            </span>
            <Bar
              share={point.avgRating === null ? null : (point.avgRating / 5) * 100}
              tone="color-mix(in oklab, var(--content-primary) 22%, transparent)"
            />
          </li>
        ))}
      </ol>
      <TrendWindowNote shown={points.length} total={view.total} />
    </div>
  );
}

function Cadence({ view }: { view: CampaignsView }) {
  const points = view.cadence.slice(-TREND_WINDOW).reverse();

  if (points.length === 0) {
    return (
      <EmptyState
        icon={Send}
        title="Nothing has been sent"
        description="There is no cadence to measure until the first report goes out."
      />
    );
  }

  const sinceLast = view.daysSinceLastSend;

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      {sinceLast !== null ? (
        <p
          className="t-subhead tabular"
          style={{
            margin: 0,
            color:
              sinceLast >= 45
                ? "var(--signal-abort)"
                : sinceLast >= 30
                  ? "var(--signal-caution)"
                  : "var(--content-secondary)",
          }}
        >
          {sinceLast} {sinceLast === 1 ? "day" : "days"} since the last report.
        </p>
      ) : null}

      <ol
        className="flex flex-col"
        style={{ gap: "var(--space-2)", margin: 0, padding: 0, listStyle: "none" }}
      >
        {points.map((point) => (
          <li
            key={point.campaignId}
            className="flex flex-wrap items-baseline justify-between"
            style={{ gap: "var(--space-3)" }}
          >
            <Link
              href={`/campaigns/${point.campaignId}`}
              className="t-footnote"
              style={{ color: "var(--signal-link)", textDecoration: "none" }}
            >
              {point.label}
            </Link>
            <span
              className="t-caption tabular"
              style={{ color: "var(--content-secondary)" }}
            >
              {fmtDate(point.sentAt)}
              {point.gapDays === null
                ? " · first on record"
                : ` · ${point.gapDays} ${point.gapDays === 1 ? "day" : "days"} after the previous`}
            </span>
          </li>
        ))}
      </ol>

      <TrendWindowNote shown={points.length} total={view.total} />
    </div>
  );
}

function TopEngaged({ view }: { view: PeopleView }) {
  if (view.top.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nobody has been sent to yet"
        description="Engagement is ranked once at least one client contact has received a report."
      />
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
      <ol
        className="flex flex-col"
        style={{ gap: "var(--space-3)", margin: 0, padding: 0, listStyle: "none" }}
      >
        {view.top.map((person) => (
          <li
            key={person.contactId}
            className="flex flex-wrap items-baseline justify-between"
            style={{ gap: "var(--space-3)" }}
          >
            <span className="flex flex-col" style={{ gap: "var(--space-1)" }}>
              <span className="t-subhead" style={{ color: "var(--content-primary)" }}>
                {person.fullName}
              </span>
              <span className="t-caption" style={{ color: "var(--content-tertiary)" }}>
                {person.title || person.email}
              </span>
            </span>
            <span
              className="t-caption tabular"
              style={{ color: "var(--content-secondary)" }}
            >
              Opened {fmtInt(person.opened)} of {fmtInt(person.sends)} · clicked{" "}
              {fmtInt(person.clicked)} · rated {fmtInt(person.ratings)}
            </span>
          </li>
        ))}
      </ol>

      <p className="t-caption tabular" style={{ margin: 0, color: "var(--content-tertiary)" }}>
        Top {fmtInt(view.top.length)} of {fmtInt(view.coverage.externalTotal)}{" "}
        active client contacts. The full list is on the Contacts tab.
      </p>
    </div>
  );
}

/* ── Contacts ─────────────────────────────────────────────────────────────── */

type EditingContact = {
  id: string;
  fullName: string;
  email: string;
  title: string;
  isInternal: boolean;
};

function ContactsPanel({
  client,
  people,
  internalDomains,
}: {
  client: ClientDetail;
  people: QueryResult<PeopleView>;
  internalDomains: string[];
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [pasting, setPasting] = React.useState(false);
  const [editing, setEditing] = React.useState<EditingContact | null>(null);

  function refresh() {
    router.refresh();
  }

  if (!people.ok) {
    return (
      <Card style={{ padding: "var(--space-6)" }}>
        <CouldntLoadInline what="the contacts for this client" reason={people.reason} />
      </Card>
    );
  }

  const external = people.data.rows.filter((person) => !person.isInternal);
  const internal = people.data.rows.filter((person) => person.isInternal);
  const existingEmails = people.data.rows.map((person) => person.email.toLowerCase());
  const sheetOpen = adding || editing !== null;

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      <div className="flex flex-wrap items-center justify-between" style={{ gap: "var(--space-3)" }}>
        <p className="t-footnote prose-measure" style={{ margin: 0, color: "var(--content-tertiary)" }}>
          Every address here can be sent to. Removing one keeps its send history —
          nothing already delivered is rewritten.
        </p>
        <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
          <Button size="s" variant="glass" onClick={() => setPasting(true)}>
            Paste a list
          </Button>
          <Button size="s" variant="tinted" leadingIcon={UserPlus} onClick={() => setAdding(true)}>
            Add contact
          </Button>
        </div>
      </div>

      {people.data.incomplete ? (
        <p
          role="status"
          className="t-footnote"
          style={{ margin: 0, color: "var(--signal-caution)" }}
        >
          This client has {fmtInt(people.data.total)} contacts and the first{" "}
          {fmtInt(people.data.rows.length)} could be read in one pass. The
          remainder is counted but not listed.
        </p>
      ) : null}

      <ContactGroup
        heading="Client contacts"
        description="The people the reports are written for. Every headline figure on this account counts these and only these."
        rows={external}
        emptyTitle="No client contacts yet"
        emptyDescription="Nothing can be sent to this account until at least one client contact exists."
        clientId={client.id}
        clientSlug={client.slug}
        primaryContactId={client.primaryContactId}
        onEdit={setEditing}
        onChanged={refresh}
      />

      <ContactGroup
        heading="Internal colleagues"
        description="Copied on the send and excluded from every reported figure — their opens and clicks never enter a rate."
        rows={internal}
        emptyTitle="No internal colleagues on this account"
        emptyDescription="Nobody from Convin is copied on reports to this client."
        internal
        clientSlug={client.slug}
        onEdit={setEditing}
        onChanged={refresh}
      />

      <ContactFormSheet
        open={sheetOpen}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        clientId={client.id}
        clientSlug={client.slug}
        domains={internalDomains}
        editing={editing}
        onSaved={refresh}
      />

      <ContactBulkSheet
        open={pasting}
        onClose={() => setPasting(false)}
        clientId={client.id}
        clientSlug={client.slug}
        domains={internalDomains}
        existingEmails={existingEmails}
        onAdded={refresh}
      />
    </div>
  );
}

function ContactGroup({
  heading,
  description,
  rows,
  emptyTitle,
  emptyDescription,
  internal = false,
  clientId,
  clientSlug,
  primaryContactId = null,
  onEdit,
  onChanged,
}: {
  heading: string;
  description: string;
  rows: PersonRow[];
  emptyTitle: string;
  emptyDescription: string;
  internal?: boolean;
  /** Only the client-contacts group (never internal colleagues) can hold the primary contact. */
  clientId?: string;
  clientSlug: string;
  primaryContactId?: string | null;
  onEdit: (contact: EditingContact) => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [settingId, setSettingId] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<PersonRow | null>(null);

  function setPrimary(row: PersonRow) {
    if (!clientId) return;
    const next = primaryContactId === row.contactId ? null : row.contactId;
    setSettingId(row.contactId);
    void setPrimaryContactAction(clientId, clientSlug, next, row.fullName || row.email).then(
      (result) => {
        setSettingId(null);
        if (!result.ok) {
          toast({ message: result.message, tone: "abort" });
          return;
        }
        toast({
          message: next ? `${row.fullName || row.email} is now the primary contact.` : "Primary contact cleared.",
          tone: "neutral",
        });
        router.refresh();
      },
    );
  }

  function confirmRemove() {
    if (!removing) return;
    setBusyId(removing.contactId);
    void setContactActiveAction(removing.contactId, clientSlug, removing.fullName || removing.email, false).then(
      (result) => {
        setBusyId(null);
        setRemoving(null);
        if (!result.ok) {
          toast({ message: result.message, tone: "abort" });
          return;
        }
        toast({ message: `${removing.fullName || removing.email} was removed.`, tone: "neutral" });
        onChanged();
      },
    );
  }

  function restore(row: PersonRow) {
    setBusyId(row.contactId);
    void setContactActiveAction(row.contactId, clientSlug, row.fullName || row.email, true).then((result) => {
      setBusyId(null);
      if (!result.ok) {
        toast({ message: result.message, tone: "abort" });
        return;
      }
      toast({ message: `${row.fullName || row.email} was restored.`, tone: "neutral" });
      onChanged();
    });
  }

  function clearBounce(row: PersonRow) {
    setBusyId(row.contactId);
    void clearContactBounceAction(row.contactId, clientSlug, row.fullName || row.email).then((result) => {
      setBusyId(null);
      if (!result.ok) {
        toast({ message: result.message, tone: "abort" });
        return;
      }
      toast({ message: `The bounce on ${row.fullName || row.email} was cleared.`, tone: "neutral" });
      onChanged();
    });
  }

  const showPrimaryColumn = clientId !== undefined && !internal;

  const columns: Column<PersonRow>[] = [
    {
      id: "name",
      header: "Name",
      required: true,
      sortValue: (row) => row.fullName.toLowerCase(),
      render: (row) => (
        <span className="flex flex-col" style={{ gap: "var(--space-1)" }}>
          <span
            className="flex items-center"
            style={{ gap: "var(--space-2)", color: "var(--content-primary)" }}
          >
            {row.fullName}
            <AudiencePill isInternal={row.isInternal} />
            {row.contactId === primaryContactId ? <Pill tone="accent">Primary</Pill> : null}
            {!row.isActive ? <Pill tone="neutral">Inactive</Pill> : null}
            {row.bouncedAt ? <Pill tone="abort">Bouncing</Pill> : null}
          </span>
          <span className="t-micro" style={{ color: "var(--content-tertiary)" }}>
            {row.title || "No title recorded"} · {row.email}
          </span>
        </span>
      ),
    },
    {
      id: "sends",
      header: "Sent",
      numeric: true,
      sortValue: (row) => row.sends,
      render: (row) => fmtInt(row.sends),
    },
    {
      id: "delivered",
      header: "Delivered",
      numeric: true,
      sortValue: (row) => row.delivered,
      render: (row) => fmtInt(row.delivered),
    },
    {
      id: "opened",
      header: "Opened",
      numeric: true,
      sortValue: (row) => row.opened,
      render: (row) => fmtInt(row.opened),
    },
    {
      id: "clicked",
      header: "Clicked",
      numeric: true,
      sortValue: (row) => row.clicked,
      render: (row) => fmtInt(row.clicked),
    },
    {
      id: "rating",
      header: "Ratings left",
      sortValue: (row) => row.avgRating,
      render: (row) =>
        row.ratings === 0 ? (
          <span style={{ color: "var(--content-tertiary)" }}>None</span>
        ) : (
          <span className="flex flex-col" style={{ gap: "var(--space-1)" }}>
            <StarRating value={row.avgRating} size="s" showValue />
            <span className="t-micro tabular" style={{ color: "var(--content-tertiary)" }}>
              mean of {fmtInt(row.ratings)}{" "}
              {row.ratings === 1 ? "rating" : "ratings"} — see Feedback for the
              report each belongs to
            </span>
          </span>
        ),
    },
    ...(showPrimaryColumn
      ? [
          {
            id: "primary",
            header: "Primary",
            render: (row: PersonRow) => (
              <Button
                variant={row.contactId === primaryContactId ? "solid" : "glass"}
                size="s"
                loading={settingId === row.contactId}
                onClick={() => setPrimary(row)}
              >
                {row.contactId === primaryContactId ? "Primary" : "Make primary"}
              </Button>
            ),
          } satisfies Column<PersonRow>,
        ]
      : []),
    {
      id: "actions",
      header: "",
      render: (row) => (
        <span className="flex items-center justify-end" style={{ gap: "var(--space-2)" }}>
          {row.bouncedAt ? (
            <Button
              size="s"
              variant="plain"
              loading={busyId === row.contactId}
              onClick={() => clearBounce(row)}
            >
              Clear bounce
            </Button>
          ) : null}
          <Button
            size="s"
            variant="plain"
            onClick={() =>
              onEdit({
                id: row.contactId,
                fullName: row.fullName,
                email: row.email,
                title: row.title,
                isInternal: row.isInternal,
              })
            }
          >
            Edit
          </Button>
          {row.isActive ? (
            <Button
              size="s"
              variant="plain"
              style={{ color: "var(--signal-abort)" }}
              onClick={() => setRemoving(row)}
            >
              Remove
            </Button>
          ) : (
            <Button size="s" variant="plain" loading={busyId === row.contactId} onClick={() => restore(row)}>
              Restore
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <section
      aria-label={heading}
      className="flex flex-col"
      style={{
        gap: "var(--space-4)",
        // The two audiences are separated by a surface, not by a rule.
        padding: "var(--space-5)",
        background: internal ? "var(--surface-grouped)" : "transparent",
        border: internal ? "1px solid var(--stroke-hairline)" : "none",
        borderRadius: "var(--radius-xl)",
      }}
    >
      <div className="flex flex-col" style={{ gap: "var(--space-1)" }}>
        <h2
          className="t-title-3 flex items-center"
          style={{ margin: 0, gap: "var(--space-2)", color: "var(--content-primary)" }}
        >
          {heading}
          <span className="t-footnote tabular" style={{ color: "var(--content-tertiary)" }}>
            {fmtInt(rows.length)}
          </span>
        </h2>
        <p
          className="t-footnote prose-measure"
          style={{ margin: 0, color: "var(--content-secondary)" }}
        >
          {description}
        </p>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.contactId}
        caption={`${heading}, with how many reports each has been sent, opened and rated.`}
        columnToggle={false}
        pageSizeOptions={[10, 25, 50, 100]}
        emptyState={
          <EmptyState
            icon={internal ? Users : UserX}
            title={emptyTitle}
            description={emptyDescription}
          />
        }
      />

      <Alert
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={removing ? `Remove ${removing.fullName || removing.email}?` : "Remove this contact?"}
        body={
          removing
            ? `They have received ${removing.sends} ${removing.sends === 1 ? "report" : "reports"} from this account. Removing them takes them off future sends — that history stays exactly as it is.`
            : ""
        }
        safeAction={{ label: "Keep them", onClick: () => setRemoving(null) }}
        dangerAction={{
          label: "Remove contact",
          loading: busyId === removing?.contactId,
          onClick: confirmRemove,
        }}
      />
    </section>
  );
}

/* ── Campaigns ────────────────────────────────────────────────────────────── */

function CampaignsPanel({ campaigns }: { campaigns: QueryResult<CampaignsView> }) {
  if (!campaigns.ok) {
    return (
      <Card style={{ padding: "var(--space-6)" }}>
        <CouldntLoadInline
          what="the reports sent to this client"
          reason={campaigns.reason}
        />
      </Card>
    );
  }

  // Newest first here — a log reads the other way round from a trend.
  const rows = campaigns.data.points.slice().reverse();

  const columns: Column<TrendPoint>[] = [
    {
      id: "dl",
      header: "DL #",
      required: true,
      sortValue: (row) => row.reportNumber,
      render: (row) => (
        <Link
          href={`/campaigns/${row.campaignId}`}
          className="t-footnote tabular"
          style={{
            fontFamily: "var(--font-mono)",
            display: "inline-flex",
            alignItems: "center",
            minHeight: "44px",
            color: "var(--signal-link)",
            textDecoration: "none",
          }}
        >
          {row.reportNumber ?? "No number"}
        </Link>
      ),
    },
    {
      id: "title",
      header: "Title",
      required: true,
      sortValue: (row) => row.title.toLowerCase(),
      render: (row) => row.title,
    },
    {
      id: "sent",
      header: "Sent",
      sortValue: (row) => row.sentAt,
      render: (row) => (
        <span className="tabular" style={{ color: "var(--content-secondary)" }}>
          {row.sentAt ? fmtDateTime(row.sentAt) : "Not sent"}
        </span>
      ),
    },
    {
      id: "recipients",
      header: "Recipients",
      numeric: true,
      sortValue: (row) => row.recipients,
      render: (row) => fmtInt(row.recipients),
    },
    {
      id: "delivered",
      header: "Delivered",
      numeric: true,
      sortValue: (row) => row.delivered,
      render: (row) => fmtInt(row.delivered),
    },
    {
      id: "open",
      header: "Open %",
      numeric: true,
      sortValue: (row) => row.openRate,
      render: (row) => fmtPct(row.openRate),
    },
    {
      id: "click",
      header: "Click %",
      numeric: true,
      sortValue: (row) => row.clickRate,
      render: (row) => fmtPct(row.clickRate),
    },
    {
      id: "rating",
      header: "Avg rating",
      sortValue: (row) => row.avgRating,
      render: (row) => (
        <span className="flex items-center" style={{ gap: "var(--space-2)" }}>
          <StarRating value={row.avgRating} size="s" showValue />
          <span className="t-micro tabular" style={{ color: "var(--content-tertiary)" }}>
            {fmtInt(row.ratings)}
          </span>
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (row) => row.status,
      render: (row) => <StatusPill status={row.status} />,
    },
  ];

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      {campaigns.data.incomplete ? (
        <p
          role="status"
          className="t-footnote"
          style={{ margin: 0, color: "var(--signal-caution)" }}
        >
          {fmtInt(campaigns.data.total)} reports have gone to this client and the
          first {fmtInt(rows.length)} could be read in one pass.
        </p>
      ) : null}

      <p
        className="t-footnote prose-measure"
        style={{ margin: 0, color: "var(--content-tertiary)" }}
      >
        Test sends are excluded from this list. Recipients counts external
        recipients only, and delivered is what the provider accepted.
      </p>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.campaignId}
        caption="Reports sent to this client, with recipients, delivery, engagement and average rating."
        pageSizeOptions={[10, 25, 50, 100]}
        emptyState={
          <EmptyState
            icon={Send}
            title="No report has gone to this client"
            description="Nothing has been sent yet, so there is nothing to list."
          />
        }
      />
    </div>
  );
}

/* ── Feedback ─────────────────────────────────────────────────────────────── */

function FeedbackPanel({ feedback }: { feedback: QueryResult<FeedbackView> }) {
  if (!feedback.ok) {
    return (
      <Card style={{ padding: "var(--space-6)" }}>
        <CouldntLoadInline
          what="the feedback from this client"
          reason={feedback.reason}
        />
      </Card>
    );
  }

  const columns: Column<ClientFeedbackRow>[] = [
    {
      id: "rating",
      header: "Rating",
      required: true,
      sortValue: (row) => row.rating,
      render: (row) => <StarRating value={row.rating} size="s" showValue />,
    },
    {
      id: "campaign",
      // Non-negotiable: the rating and the report it belongs to travel together.
      header: "Report it rates",
      required: true,
      sortValue: (row) => row.campaignSentAt,
      render: (row) => (
        <Link
          href={`/campaigns/${row.campaignId}`}
          className="flex flex-col"
          style={{ gap: "var(--space-1)", textDecoration: "none" }}
        >
          <span className="t-subhead" style={{ color: "var(--signal-link)" }}>
            {row.campaignReportNumber ? `${row.campaignReportNumber} · ` : ""}
            {row.campaignTitle}
          </span>
          <span className="t-micro tabular" style={{ color: "var(--content-tertiary)" }}>
            Sent {row.campaignSentAt ? fmtDate(row.campaignSentAt) : "date not recorded"}
          </span>
        </Link>
      ),
    },
    {
      id: "person",
      header: "Left by",
      sortValue: (row) => row.personName.toLowerCase(),
      render: (row) => (
        <span className="flex flex-col" style={{ gap: "var(--space-1)" }}>
          <span style={{ color: "var(--content-primary)" }}>{row.personName}</span>
          <span className="t-micro" style={{ color: "var(--content-tertiary)" }}>
            {row.personEmail}
          </span>
        </span>
      ),
    },
    {
      id: "comment",
      header: "Comment",
      sortValue: (row) => row.comment,
      render: (row) =>
        row.comment ? (
          <span
            className="t-footnote prose-measure"
            style={{ display: "block", color: "var(--content-secondary)" }}
          >
            {row.comment}
          </span>
        ) : (
          <span style={{ color: "var(--content-tertiary)" }}>
            Rated without a comment
          </span>
        ),
    },
    {
      id: "when",
      header: "Received",
      sortValue: (row) => row.createdAt,
      render: (row) => (
        <span className="tabular" style={{ color: "var(--content-secondary)" }}>
          {fmtDateTime(row.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      {feedback.data.incomplete ? (
        <p
          role="status"
          className="t-footnote"
          style={{ margin: 0, color: "var(--signal-caution)" }}
        >
          {fmtInt(feedback.data.total)} ratings are on record and the first{" "}
          {fmtInt(feedback.data.rows.length)} could be read in one pass.
        </p>
      ) : null}

      <p
        className="t-footnote prose-measure"
        style={{ margin: 0, color: "var(--content-tertiary)" }}
      >
        Ratings left by internal colleagues and against test sends are excluded.
        Every rating is shown beside the report it was left against.
      </p>

      <DataTable
        rows={feedback.data.rows}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Ratings and comments from this client, each with the report it belongs to."
        pageSizeOptions={[10, 25, 50, 100]}
        emptyState={
          <EmptyState
            icon={MailQuestion}
            title="No ratings from this client yet"
            description="Nobody on this account has rated a report. No average is shown in place of one."
          />
        }
      />
    </div>
  );
}

/* ── Details ──────────────────────────────────────────────────────────────── */

function DetailsPanel({
  client,
  owners,
  ownersReason,
  isManager,
}: {
  client: ClientDetail;
  owners: OwnerOption[];
  ownersReason: string | null;
  isManager: boolean;
}) {
  const [state, formAction, pending] = React.useActionState(
    updateClientAction,
    IDLE_CLIENT_FORM,
  );

  const router = useRouter();
  const { toast } = useToast();
  const [confirming, setConfirming] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [blockedCount, setBlockedCount] = React.useState<number | null>(null);

  const contactsCount =
    (client.health?.externalContacts ?? 0) + (client.health?.internalContacts ?? 0);
  const campaignsCount = client.health?.campaignsSent ?? 0;

  function removeClient() {
    setRemoving(true);
    void removeClientAction(client.id, client.name).then((result) => {
      setRemoving(false);
      if (!result.ok) {
        if (result.campaignCount !== undefined) {
          setBlockedCount(result.campaignCount);
          return;
        }
        toast({ message: result.message, tone: "abort" });
        setConfirming(false);
        return;
      }
      toast({ message: `${client.name} was deleted.`, tone: "neutral" });
      setConfirming(false);
      router.push("/clients");
    });
  }

  function archiveClient() {
    setRemoving(true);
    void archiveClientAction(client.id, client.slug, client.name).then((result) => {
      setRemoving(false);
      setConfirming(false);
      setBlockedCount(null);
      if (!result.ok) {
        toast({ message: result.message, tone: "abort" });
        return;
      }
      toast({ message: `${client.name} was archived.`, tone: "neutral" });
      router.refresh();
    });
  }

  const statusOptions: SelectOption[] = CLIENT_STATUSES.map((status) => ({
    value: status,
    label: CLIENT_STATUS_LABEL[status],
  }));

  const ownerOptions: SelectOption[] = [
    { value: "", label: "Unassigned" },
    ...owners.map((owner) => ({ value: owner.id, label: owner.name })),
  ];

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
    <Card>
      <CardHeader>
        <CardTitle
          as="h2"
          description="Changes are saved against your name and recorded in the audit log."
        >
          Client record
        </CardTitle>
      </CardHeader>
      <CardBody>
        <form action={formAction} className="flex flex-col" style={{ gap: "var(--space-5)" }}>
          <input type="hidden" name="id" value={client.id} />
          <input type="hidden" name="slug" value={client.slug} />

          <div
            className="grid"
            style={{
              gap: "var(--space-4)",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            }}
          >
            <Field label="Company name" required>
              <TextInput
                name="name"
                defaultValue={client.name}
                required
                autoComplete="organization"
              />
            </Field>

            <Field label="Status" hint="Paused and churned accounts stay on record.">
              <Select name="status" options={statusOptions} defaultValue={client.status} />
            </Field>

            <Field
              label="Owner"
              error={ownersReason ? `The list of people could not be read — ${ownersReason}` : null}
            >
              <Select
                name="ownerId"
                options={ownerOptions}
                defaultValue={client.ownerId ?? ""}
                disabled={ownersReason !== null}
              />
            </Field>

            <Field label="Time zone" hint="Used when a send is scheduled.">
              <TextInput
                name="timezone"
                defaultValue={client.timezone}
                placeholder="Asia/Kolkata"
              />
            </Field>

            <Field label="Tags" hint="Separate with commas.">
              <TextInput
                name="tags"
                defaultValue={client.tags.join(", ")}
                placeholder="enterprise, apac"
              />
            </Field>

            <Field label="Slug" hint="The address of this page. Not editable here.">
              <TextInput name="slugDisplay" defaultValue={client.slug} readOnly disabled />
            </Field>
          </div>

          <Field label="Notes" hint="Context for whoever writes the next report.">
            <TextArea name="notes" defaultValue={client.notes} rows={5} />
          </Field>

          <div
            className="flex flex-wrap items-center"
            style={{ gap: "var(--space-4)" }}
          >
            {/* The one Aurum element on this screen. */}
            <Button type="submit" variant="metal" loading={pending}>
              Save changes
            </Button>

            <p
              role="status"
              aria-live="polite"
              className="t-footnote prose-measure"
              style={{
                margin: 0,
                color:
                  state.status === "error"
                    ? "var(--signal-abort)"
                    : state.status === "saved"
                      ? "var(--signal-nominal)"
                      : "var(--content-tertiary)",
              }}
            >
              {state.message ||
                `On record since ${fmtDate(client.createdAt)}. Average rating ${fmtRating(
                  client.health?.avgRating,
                )} across ${fmtInt(client.health?.campaignsSent ?? 0)} reports.`}
            </p>
          </div>
        </form>
      </CardBody>
    </Card>

    {isManager ? (
      <Card accent="abort">
        <CardHeader>
          <CardTitle as="h2" description="Only visible to a manager. Every action here is audited.">
            Danger zone
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap items-center justify-between" style={{ gap: "var(--space-4)" }}>
            <p className="t-footnote prose-measure" style={{ margin: 0, color: "var(--content-secondary)" }}>
              Removing {client.name} deletes the client record permanently. This is blocked while any
              campaign — sent, scheduled or draft — still references it; archive instead to keep history
              intact.
            </p>
            <Button variant="destruct" onClick={() => setConfirming(true)}>
              Remove client
            </Button>
          </div>
        </CardBody>
      </Card>
    ) : null}

    <Alert
      open={confirming}
      onClose={() => {
        setConfirming(false);
        setBlockedCount(null);
      }}
      title={`Delete ${client.name}?`}
      body={
        blockedCount !== null
          ? `${client.name} has ${blockedCount} campaign${blockedCount === 1 ? "" : "s"} on record, so deleting is blocked — the history would be orphaned. Archive it instead: it stops appearing as active but every report and rating stays intact.`
          : `${client.name} has ${fmtInt(campaignsCount)} campaign${campaignsCount === 1 ? "" : "s"} and ${fmtInt(contactsCount)} contact${contactsCount === 1 ? "" : "s"}. Deleting is permanent.`
      }
      safeAction={{
        label: "Keep it",
        onClick: () => {
          setConfirming(false);
          setBlockedCount(null);
        },
      }}
      dangerAction={
        blockedCount !== null
          ? { label: "Archive instead", loading: removing, onClick: archiveClient }
          : { label: "Delete client", loading: removing, onClick: removeClient }
      }
    />
    </div>
  );
}
