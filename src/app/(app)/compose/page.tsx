/**
 * Compose — the draft library.
 *
 * FIX: the system this replaces had exactly three global draft slots. They were
 * unnamed, unowned and shared by the whole team, and the template gallery could
 * only load into two of them, so a colleague starting a fourth report silently
 * destroyed your first. A draft here is a row with a name, a client, an owner
 * and a timestamp, and there is no ceiling on how many exist.
 *
 * The search runs on the server against the URL, so the count under the grid is
 * the true count for what is being shown.
 */

import type { Metadata } from "next";
import { DraftLibrary } from "@/components/compose/draft-library";
import { CouldntLoad } from "@/components/campaigns/couldnt-load";
import { firstParam, type SearchParams } from "@/components/campaigns/vocabulary";
import type { ClientOption, DraftCardView } from "@/components/compose/vocabulary";
import { serverNow } from "@/lib/clock";
import { listComposeClients, listDrafts } from "@/lib/queries/drafts";
import { getSessionProfile } from "@/lib/supabase/server";
import { fmtInt } from "@/lib/utils";

export const metadata: Metadata = { title: "Compose" };

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = firstParam(params, "q") ?? "";

  const [library, clients, profile] = await Promise.all([
    listDrafts(query),
    listComposeClients(),
    getSessionProfile(),
  ]);

  const me = profile ? String(profile.id) : null;

  const cards: DraftCardView[] = library.ok
    ? library.data.cards.map((card) => ({
        id: card.id,
        name: card.name,
        clientName: card.clientName,
        templateKey: card.templateKey,
        reportTitle: card.reportTitle,
        updatedAt: card.updatedAt,
        ownerName: card.ownerName,
        mine: me !== null && card.ownerId === me,
      }))
    : [];

  const clientOptions: ClientOption[] | null = clients.ok
    ? clients.data.map((client) => ({
        id: client.id,
        name: client.name,
        slug: client.slug,
        status: client.status,
      }))
    : null;

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
      <header className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <h1 className="t-title-2" style={{ margin: 0, color: "var(--content-primary)" }}>
          Compose
        </h1>
        <p
          className="t-subhead prose-measure"
          style={{ margin: 0, color: "var(--content-secondary)" }}
        >
          {library.ok
            ? `${fmtInt(library.data.total)} ${
                library.data.total === 1 ? "draft" : "drafts"
              } — named, owned and kept until you send them.`
            : "The library could not be read, so no count is shown."}
        </p>
      </header>

      {library.ok ? (
        <DraftLibrary
          cards={cards}
          total={library.data.total}
          incomplete={library.data.incomplete}
          query={query}
          now={serverNow()}
          clients={clientOptions}
          clientsReason={clients.ok ? null : clients.reason}
        />
      ) : (
        <CouldntLoad
          what="your drafts"
          reason={library.reason}
          next="Nothing was changed and nothing was lost. Reload the page to try the read again."
        />
      )}
    </div>
  );
}
