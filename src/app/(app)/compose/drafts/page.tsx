/**
 * Compose — the draft library.
 *
 * `/compose` opens straight into an editor now; this is where a person comes
 * to find a *different* draft, or to start one from a template. A draft is a
 * row: named, owned, timestamped, and there is no ceiling on how many exist.
 *
 * The search and the "Mine / Everyone's" filter both run on the server
 * against the URL, so the count under the list is the true count for what is
 * being shown — and a filtered library is a shareable address.
 */

import type { Metadata } from "next";
import { DraftLibrary } from "@/components/compose/draft-library";
import { isMine } from "@/components/compose/vocabulary";
import { CouldntLoad } from "@/components/campaigns/couldnt-load";
import { firstParam, type SearchParams } from "@/components/campaigns/vocabulary";
import type { ClientOption, DraftCardView } from "@/components/compose/vocabulary";
import { serverNow } from "@/lib/clock";
import {
  listComposeClients,
  listDrafts,
  listStarterDrafts,
} from "@/lib/queries/drafts";
import { getSessionProfile } from "@/lib/supabase/server";
import { fmtInt } from "@/lib/utils";

export const metadata: Metadata = { title: "Compose · All drafts" };

function ownerOf(raw: string | null): "mine" | "everyone" {
  return raw === "mine" ? "mine" : "everyone";
}

function toView(
  card: {
    id: string;
    name: string;
    clientName: string | null;
    templateKey: DraftCardView["templateKey"];
    reportTitle: string | null;
    reportNumber: string | null;
    updatedAt: string;
    ownerId: string | null;
    ownerName: string | null;
    isStarter: boolean;
  },
  me: string | null,
): DraftCardView {
  return {
    id: card.id,
    name: card.name,
    clientName: card.clientName,
    templateKey: card.templateKey,
    reportTitle: card.reportTitle,
    reportNumber: card.reportNumber,
    updatedAt: card.updatedAt,
    ownerName: card.ownerName,
    mine: isMine(card.ownerId, me),
    isStarter: card.isStarter,
  };
}

export default async function ComposeDraftsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = firstParam(params, "q") ?? "";
  const owner = ownerOf(firstParam(params, "owner"));

  const profile = await getSessionProfile();
  const me = profile ? String(profile.id) : null;

  const [library, starters, clients] = await Promise.all([
    listDrafts(query, { ownerId: owner === "mine" ? me : null }),
    listStarterDrafts(),
    listComposeClients(),
  ]);

  const cards: DraftCardView[] = library.ok
    ? library.data.cards.map((card) => toView(card, me))
    : [];
  const starterCards: DraftCardView[] = starters.ok
    ? starters.data.map((card) => toView(card, me))
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
          All drafts
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
          starters={starterCards}
          startersReason={starters.ok ? null : starters.reason}
          total={library.data.total}
          incomplete={library.data.incomplete}
          query={query}
          owner={owner}
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
