/**
 * Step 1 · Upload — no run exists yet, so this isn't `[id]`-scoped. Once
 * `uploadCsvAction` succeeds it creates the run and redirects into
 * `/audits/[id]?step=map`.
 */

import type { Metadata } from "next";
import { StepUpload } from "@/components/audits/step-upload";
import { CouldntLoad } from "@/components/campaigns/couldnt-load";
import { listComposeClients } from "@/lib/queries/drafts";
import type { ClientOption } from "@/components/compose/vocabulary";

export const metadata: Metadata = { title: "New audit" };

export default async function NewAuditPage() {
  const clients = await listComposeClients();

  const clientOptions: ClientOption[] | null = clients.ok
    ? clients.data.map((c) => ({ id: c.id, name: c.name, slug: c.slug, status: c.status }))
    : null;

  if (!clients.ok && !clientOptions) {
    return <CouldntLoad what="the client list" reason={clients.reason} next="Nothing was changed. Reload the page to try again." />;
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      <div>
        <h1 className="t-title-1" style={{ margin: 0, color: "var(--content-primary)" }}>
          New audit
        </h1>
        <p className="t-subhead" style={{ margin: "var(--space-1) 0 0", color: "var(--content-secondary)" }}>
          Step 1 of 5 · Upload
        </p>
      </div>
      <StepUpload clients={clientOptions} clientsReason={clients.ok ? null : clients.reason} />
    </div>
  );
}
