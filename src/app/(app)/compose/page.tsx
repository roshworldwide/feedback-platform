/**
 * Compose — lands on work, not on a gallery.
 *
 * A thumbnail grid was the wrong hero for a *draft*: people scan drafts by
 * name, client and when they last touched them, several drafts share a
 * template, and it cost about 250px per card — ten drafts read as two and a
 * half screens before anyone reached the one they wanted.
 *
 * This route never renders a screen of its own. It resolves the caller's
 * most recently edited draft — one cheap `id … limit 1` read, never the
 * whole library — and redirects straight into the editor. Nobody has one
 * yet, a fresh draft is created and opened instead, silently: the library
 * remains one click away at `/compose/drafts`, but it is not the thing a
 * person who clicked "Compose" was asking to see.
 */

import { redirect } from "next/navigation";
import { CouldntLoad } from "@/components/campaigns/couldnt-load";
import { mostRecentEditableDraftId } from "@/lib/queries/drafts";
import { getSessionProfile } from "@/lib/supabase/server";
import { createDraftForRedirect } from "./actions";

export default async function ComposePage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/signin?reason=inactive");

  const existing = await mostRecentEditableDraftId(profile.id);
  if (!existing.ok) {
    return (
      <CouldntLoad
        what="your drafts"
        reason={existing.reason}
        next="Nothing was changed. Reload the page to try again, or open the library directly."
      />
    );
  }
  if (existing.data) redirect(`/compose/${existing.data}`);

  const created = await createDraftForRedirect("Untitled draft", null);
  if (!created.ok) {
    return (
      <CouldntLoad
        what="a new draft"
        reason={created.message}
        next="Nothing was changed. Reload the page to try again."
      />
    );
  }
  redirect(`/compose/${created.data.id}`);
}
