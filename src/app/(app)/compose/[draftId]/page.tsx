/**
 * Compose — the five-step flow.
 *
 * The step is a query parameter, so the address bar carries the whole position:
 * a link to `?step=recipients` opens on Recipients, a refresh stays there, and
 * a colleague opening the link sees exactly what you saw.
 *
 * Every list this screen needs is read here and handed down as a value or as a
 * reason. Nothing below fabricates an empty list to stand in for a failed read.
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ComposeEditor } from "@/components/compose/compose-editor";
import { CouldntLoad } from "@/components/campaigns/couldnt-load";
import { firstParam, type SearchParams } from "@/components/campaigns/vocabulary";
import {
  isMine,
  parseComposeDoc,
  parseStep,
  type ClientOption,
  type SeriesOption,
} from "@/components/compose/vocabulary";
import { aiAvailable } from "@/lib/ai";
import { emailProvider } from "@/lib/email/send";
import {
  getDraft,
  listComposeClients,
  listComposeSeries,
} from "@/lib/queries/drafts";
import { getSessionProfile } from "@/lib/supabase/server";
import { openStarterForRedirect } from "../actions";

export const metadata: Metadata = { title: "Compose" };

export default async function ComposeDraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ draftId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { draftId } = await params;
  const step = parseStep(firstParam(await searchParams, "step"));

  const [draft, clients, series, profile] = await Promise.all([
    getDraft(draftId),
    listComposeClients(),
    listComposeSeries(),
    getSessionProfile(),
  ]);

  if (!draft.ok) {
    return (
      <CouldntLoad
        what="this draft"
        reason={draft.reason}
        next="Nothing was changed and nothing was lost. Reload the page, or go back to the library."
      />
    );
  }
  if (!draft.data) notFound();

  // A starter is never edited in place — landing on its URL directly (a
  // bookmark, a stale link) copies it the same way opening it from the
  // library does, and continues into the copy. `redirect` throws, so nothing
  // below this ever runs against the starter row itself.
  if (draft.data.isStarter) {
    const opened = await openStarterForRedirect(draftId);
    if (!opened.ok) {
      return (
        <CouldntLoad
          what="this template"
          reason={opened.message}
          next="Nothing was changed. Go back to the library and try again."
        />
      );
    }
    redirect(`/compose/${opened.data.id}?step=${step}`);
  }

  const clientOptions: ClientOption[] | null = clients.ok
    ? clients.data.map((client) => ({
        id: client.id,
        name: client.name,
        slug: client.slug,
        status: client.status,
      }))
    : null;

  const seriesOptions: SeriesOption[] | null = series.ok
    ? series.data.map((item) => ({
        id: item.id,
        clientId: item.clientId,
        name: item.name,
        frequency: item.frequency,
        templateKey: item.templateKey,
      }))
    : null;

  const me = profile ? String(profile.id) : null;

  return (
    <ComposeEditor
      draftId={draft.data.id}
      draftName={draft.data.name}
      initialDoc={parseComposeDoc(draft.data.payload)}
      step={step}
      clients={clientOptions}
      clientsReason={clients.ok ? null : clients.reason}
      series={seriesOptions}
      seriesReason={series.ok ? null : series.reason}
      provider={emailProvider()}
      mine={isMine(draft.data.ownerId, me)}
      aiCheckAvailable={aiAvailable()}
    />
  );
}
