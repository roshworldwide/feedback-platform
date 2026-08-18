/**
 * Clients.
 *
 * The KPI strip is counted against the database on every render. "At risk"
 * comes from the `client_health` view — v1 shipped that card hard-wired to
 * zero, and "Active" hard-wired to equal "Total", which meant a screen full of
 * numbers that could not be wrong because none of them were measured.
 *
 * A failed count is stated as a failure. It is never rendered as nought.
 */

import type { Metadata } from "next";
import { KpiCard } from "@/components/ui";
import { CouldntLoad, CouldntLoadInline } from "@/components/campaigns/couldnt-load";
import { COUNT_FORMULAE } from "@/components/campaigns/stats-adapter";
import { ClientFiltersBar } from "@/components/clients/client-filters";
import { ClientsView } from "@/components/clients/clients-view";
import { NewClientButton } from "@/components/clients/new-client-button";
import { HEALTH_RULE } from "@/components/clients/vocabulary";
import { getClientKpis, listClients, parseClientFilters } from "@/lib/queries/clients";
import type { SearchParams } from "@/lib/queries/campaigns";
import { internalDomains } from "@/lib/env";
import { fmtInt } from "@/lib/utils";
import { serverNow } from "@/lib/clock";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = parseClientFilters(params);

  const [kpis, page] = await Promise.all([getClientKpis(), listClients(filters)]);

  // The server's clock, read once. "N days ago" is measured against this rather
  // than Date.now() in the browser, so the figure the server printed and the
  // figure the browser hydrates are the same figure.
  const now = serverNow();

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
      <header
        className="flex flex-wrap items-start justify-between"
        style={{ gap: "var(--space-4)" }}
      >
        <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
          <h1
            className="t-title-2"
            style={{ margin: 0, color: "var(--content-primary)" }}
          >
            Clients
          </h1>
          <p
            className="t-subhead prose-measure"
            style={{ margin: 0, color: "var(--content-secondary)" }}
          >
            {page.ok
              ? `${fmtInt(page.data.total)} ${page.data.total === 1 ? "client matches" : "clients match"} the current filters.`
              : "The list could not be read, so no count is shown."}
          </p>
        </div>

        <NewClientButton domains={internalDomains()} />
      </header>

      {kpis.ok ? (
        <div
          className="grid"
          style={{
            gap: "var(--space-4)",
            gridTemplateColumns: "repeat(auto-fit, minmax(212px, 1fr))",
          }}
        >
          <KpiCard
            label="Total clients"
            value={fmtInt(kpis.data.totalClients)}
            formula={COUNT_FORMULAE.clients}
          />
          <KpiCard
            label="Contacts"
            value={fmtInt(kpis.data.externalContacts)}
            formula={COUNT_FORMULAE.contacts}
            footnote={
              kpis.data.internalContacts === 0
                ? "No internal contacts are on file."
                : `${fmtInt(kpis.data.internalContacts)} internal contacts are excluded from this count.`
            }
          />
          <KpiCard
            label="Active"
            value={fmtInt(kpis.data.activeClients)}
            formula={COUNT_FORMULAE.activeClients}
            footnote={`${fmtInt(
              kpis.data.totalClients - kpis.data.activeClients,
            )} are paused or churned.`}
          />
          <KpiCard
            label="At risk"
            value={fmtInt(kpis.data.atRisk)}
            formula={HEALTH_RULE}
            accent={kpis.data.atRisk > 0 ? "abort" : undefined}
            footnote={`Counted from the client_health view. ${fmtInt(
              kpis.data.watch,
            )} more are on watch.`}
          />
        </div>
      ) : (
        <CouldntLoadInline
          what="the client counts"
          reason={`${kpis.reason} No figure is shown in their place.`}
        />
      )}

      <ClientFiltersBar
        filters={filters}
        tags={page.ok ? page.data.tags : null}
        tagsReason={page.ok ? null : page.reason}
      />

      {page.ok && page.data.healthLookupIncomplete ? (
        <p
          role="status"
          className="t-footnote"
          style={{ margin: 0, color: "var(--signal-caution)" }}
        >
          More clients carry this health state than could be read in one pass,
          so the health filter is showing a partial set.
        </p>
      ) : null}

      {page.ok ? (
        <ClientsView
          rows={page.data.rows}
          total={page.data.total}
          filters={filters}
          now={now}
        />
      ) : (
        <CouldntLoad what="clients" reason={page.reason} />
      )}
    </div>
  );
}
