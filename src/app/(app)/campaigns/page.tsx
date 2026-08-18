/**
 * Campaigns — every report that has been sent, scheduled or drafted.
 *
 * Filtering, sorting and paging all happen on the server against the filter
 * set in the URL, so the total under the table is the true total for what is
 * being shown. v1 filtered a fetched page in the browser and then printed the
 * page length as the count; nothing here can do that.
 */

import type { Metadata } from "next";
import {
  getCampaignFacets,
  listCampaigns,
  parseCampaignFilters,
  type SearchParams,
} from "@/lib/queries/campaigns";
import { CampaignFiltersBar } from "@/components/campaigns/campaign-filters";
import { CampaignsTable } from "@/components/campaigns/campaigns-table";
import { CouldntLoad } from "@/components/campaigns/couldnt-load";
import { FORMULAE } from "@/lib/metrics";
import { fmtInt } from "@/lib/utils";

export const metadata: Metadata = { title: "Campaigns" };

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = parseCampaignFilters(params);

  const [page, facets] = await Promise.all([
    listCampaigns(filters),
    getCampaignFacets(),
  ]);

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
      <header className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <h1
          className="t-title-2"
          style={{ margin: 0, color: "var(--content-primary)" }}
        >
          Campaigns
        </h1>
        <p
          className="t-subhead prose-measure"
          style={{ margin: 0, color: "var(--content-secondary)" }}
        >
          {page.ok
            ? `${fmtInt(page.data.total)} ${page.data.total === 1 ? "campaign matches" : "campaigns match"} the current filters.`
            : "The list could not be read, so no count is shown."}
        </p>
      </header>

      <CampaignFiltersBar
        filters={filters}
        facets={facets.ok ? facets.data : null}
        facetsReason={facets.ok ? null : facets.reason}
      />

      {/* Every exclusion is stated, never silently applied. */}
      <p
        className="t-footnote prose-measure"
        style={{ margin: 0, color: "var(--content-tertiary)" }}
      >
        Recipients and rates count external recipients only — internal
        colleagues on a send are excluded. Delivered is what the provider
        accepted, which is not the same as attempted. Open&nbsp;% is{" "}
        {FORMULAE.uniqueOpenRate.toLowerCase()}; Click&nbsp;% is{" "}
        {FORMULAE.clickRate.toLowerCase()}.
      </p>

      {page.ok && page.data.templateLookupIncomplete ? (
        <p
          className="t-footnote"
          role="status"
          style={{ margin: 0, color: "var(--signal-caution)" }}
        >
          More campaigns use this template than could be read in one pass, so
          the template filter is showing a partial set. Narrow the date range
          for a complete answer.
        </p>
      ) : null}

      {page.ok ? (
        <CampaignsTable
          rows={page.data.rows}
          total={page.data.total}
          filters={filters}
        />
      ) : (
        <CouldntLoad what="campaigns" reason={page.reason} />
      )}
    </div>
  );
}
