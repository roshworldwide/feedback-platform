"use client";

/**
 * The draft library — a list, not a gallery.
 *
 * A thumbnail told a person nothing a draft card needed to say: people scan
 * drafts by name, client and when they last touched them, and several
 * drafts share a template, so the image never discriminated between them.
 * One compact row per draft says everything that matters, and ten of them
 * fit without scrolling.
 *
 * Starters are a separate list under their own heading, never mixed into
 * the count above — a starter is not a draft someone owns, it is the
 * ten-item reference gallery `seed.sql` ships, readable by anyone and
 * editable by no one. Opening one copies it; the row you click is never the
 * row you end up editing.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, FilePlus2, LayoutTemplate, SquarePen, Trash2 } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  Pill,
  SearchInput,
  Segmented,
  Sheet,
  TextInput,
  useToast,
  type Column,
} from "@/components/ui";
import { templateMeta } from "@/lib/email/templates";
import { fmtDateTime } from "@/lib/utils";
import {
  duplicateDraftAction,
  deleteDraftAction,
  createDraftAction,
  openStarterAction,
} from "@/app/(app)/compose/actions";
import { ClientSelect } from "./client-select";
import { stepHref, type ClientOption, type DraftCardView } from "./vocabulary";

export type DraftOwnerFilter = "mine" | "everyone";

export type DraftLibraryProps = {
  cards: DraftCardView[];
  starters: DraftCardView[];
  /** Null when the starter gallery read fine — a failed read is stated, not hidden. */
  startersReason: string | null;
  total: number;
  /** True when more drafts exist than one read could return. Stated on screen. */
  incomplete: boolean;
  query: string;
  owner: DraftOwnerFilter;
  /** The server's clock, captured once, so ages do not differ after hydration. */
  now: number;
  clients: ClientOption[] | null;
  clientsReason: string | null;
};

/** Ages are measured against one server instant, never against a render clock. */
function ageFrom(now: number, iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "date unknown";
  const minutes = Math.floor((now - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return fmtDateTime(iso);
}

const OWNER_OPTIONS = [
  { value: "everyone" as const, label: "Everyone's" },
  { value: "mine" as const, label: "Mine" },
];

export function DraftLibrary({
  cards,
  starters,
  startersReason,
  total,
  incomplete,
  query,
  owner,
  now,
  clients,
  clientsReason,
}: DraftLibraryProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  const [term, setTerm] = React.useState(query);
  const [urlTerm, setUrlTerm] = React.useState(query);

  // The URL stays the source of truth; the box follows it when it changes.
  if (urlTerm !== query) {
    setUrlTerm(query);
    setTerm(query);
  }

  const applyParams = React.useCallback(
    (patch: { q?: string; owner?: DraftOwnerFilter }) => {
      const params = new URLSearchParams();
      const nextQ = patch.q ?? query;
      const nextOwner = patch.owner ?? owner;
      if (nextQ) params.set("q", nextQ);
      if (nextOwner !== "everyone") params.set("owner", nextOwner);
      startTransition(() => {
        const qs = params.toString();
        router.replace(qs ? `/compose/drafts?${qs}` : "/compose/drafts", { scroll: false });
      });
    },
    [query, owner, router],
  );

  React.useEffect(() => {
    if (term.trim() === query) return;
    const timer = window.setTimeout(() => applyParams({ q: term.trim() }), 320);
    return () => window.clearTimeout(timer);
  }, [term, query, applyParams]);

  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newClient, setNewClient] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [doomed, setDoomed] = React.useState<DraftCardView | null>(null);
  const [openingStarter, setOpeningStarter] = React.useState<string | null>(null);

  function create() {
    if (newName.trim() === "") return;
    setBusy(true);
    void createDraftAction(newName, newClient).then((result) => {
      setBusy(false);
      if (!result.ok) {
        toast({ message: result.message, tone: "abort" });
        return;
      }
      setCreating(false);
      setNewName("");
      setNewClient(null);
      router.push(stepHref(result.data.id, "content"));
    });
  }

  function duplicate(card: DraftCardView) {
    startTransition(() => {
      void duplicateDraftAction(card.id).then((result) => {
        if (!result.ok) {
          toast({ message: result.message, tone: "abort" });
          return;
        }
        toast({
          message: `Duplicated as ${result.data.name}.`,
          tone: "nominal",
          action: {
            label: "Open",
            onClick: () => router.push(stepHref(result.data.id, "content")),
          },
        });
        router.refresh();
      });
    });
  }

  function destroy(card: DraftCardView) {
    setBusy(true);
    void deleteDraftAction(card.id).then((result) => {
      setBusy(false);
      setDoomed(null);
      if (!result.ok) {
        toast({ message: result.message, tone: "abort" });
        return;
      }
      toast({ message: `Deleted ${card.name}.`, tone: "neutral" });
      router.refresh();
    });
  }

  function startFromTemplate(card: DraftCardView) {
    setOpeningStarter(card.id);
    void openStarterAction(card.id).then((result) => {
      setOpeningStarter(null);
      if (!result.ok) {
        toast({ message: result.message, tone: "abort" });
        return;
      }
      router.push(stepHref(result.data.id, "content"));
    });
  }

  const columns: Column<DraftCardView>[] = [
    {
      id: "name",
      header: "Draft name",
      required: true,
      sortValue: (row) => row.name.toLowerCase(),
      render: (row) => (
        <Link
          href={stepHref(row.id, "content")}
          className="t-subhead"
          style={{ color: "var(--content-primary)", textDecoration: "none", fontWeight: 600 }}
        >
          {row.name}
        </Link>
      ),
    },
    {
      id: "client",
      header: "Client",
      sortValue: (row) => (row.clientName ?? "").toLowerCase(),
      render: (row) => (
        <span style={{ color: "var(--content-secondary)" }}>
          {row.clientName ?? "No client yet"}
        </span>
      ),
    },
    {
      id: "dl",
      header: "DL number",
      render: (row) => (
        <span className="t-footnote tabular" style={{ color: "var(--content-tertiary)" }}>
          {row.reportNumber ?? "—"}
        </span>
      ),
    },
    {
      id: "template",
      header: "Template",
      render: (row) => <Pill tone="neutral">{templateMeta(row.templateKey).name}</Pill>,
    },
    {
      id: "edited",
      header: "Edited",
      sortValue: (row) => row.updatedAt,
      render: (row) => (
        <span className="t-footnote tabular" style={{ color: "var(--content-tertiary)" }}>
          {ageFrom(now, row.updatedAt)}
        </span>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      render: (row) => (
        <span style={{ color: "var(--content-secondary)" }}>{row.ownerName ?? "Unowned"}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      render: (row) => (
        <div className="flex items-center justify-end" style={{ gap: "var(--space-1)" }}>
          <Button
            as={Link}
            href={stepHref(row.id, "content")}
            size="s"
            variant="plain"
            leadingIcon={SquarePen}
            aria-label={`Open ${row.name}`}
          >
            Open
          </Button>
          <Button
            size="s"
            variant="plain"
            leadingIcon={Copy}
            aria-label={`Duplicate ${row.name}`}
            onClick={() => duplicate(row)}
          >
            Duplicate
          </Button>
          <Button
            size="s"
            variant="plain"
            leadingIcon={Trash2}
            aria-label={`Delete ${row.name}`}
            style={{ color: "var(--signal-abort)" }}
            onClick={() => setDoomed(row)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <section
      aria-label="Draft library"
      className="flex flex-col"
      style={{ gap: "var(--space-6)", opacity: pending ? 0.72 : 1 }}
    >
      <div
        className="flex flex-wrap items-end justify-between"
        style={{ gap: "var(--space-4)" }}
      >
        <div style={{ flex: "1 1 280px", maxWidth: "420px" }}>
          <Field label="Search drafts" hint="Matches the name you gave the draft">
            <SearchInput
              value={term}
              placeholder="September retention review…"
              aria-label="Search drafts by name"
              onSearch={setTerm}
            />
          </Field>
        </div>

        <Segmented
          label="Whose drafts to show"
          value={owner}
          onValueChange={(value) => applyParams({ owner: value })}
          options={OWNER_OPTIONS}
        />

        {/* The one Aurum element on this screen. */}
        <Button
          variant="metal"
          size="m"
          leadingIcon={FilePlus2}
          onClick={() => setCreating(true)}
        >
          New draft
        </Button>
      </div>

      {incomplete ? (
        <p
          role="status"
          className="t-footnote prose-measure"
          style={{ margin: 0, color: "var(--signal-caution)" }}
        >
          More drafts exist than could be read in one pass, so this is a partial
          list. Narrow the search for a complete answer.
        </p>
      ) : null}

      {cards.length === 0 ? (
        <Card elevation="e1">
          <EmptyState
            icon={SquarePen}
            title={
              query
                ? `No draft matches “${query}”`
                : owner === "mine"
                  ? "You have no drafts yet"
                  : "No drafts yet"
            }
            description={
              query
                ? "The search matches a draft's name. Clear it to see all of them."
                : "A draft holds a whole report — the client, the copy, the recipients and the schedule — until you send it. There is no limit on how many you keep."
            }
            action={{
              label: query ? "Clear search" : "New draft",
              variant: "tinted",
              icon: query ? undefined : FilePlus2,
              onClick: () => (query ? router.replace("/compose/drafts") : setCreating(true)),
            }}
          />
        </Card>
      ) : (
        <DataTable
          rows={cards}
          columns={columns}
          rowKey={(row) => row.id}
          caption="Your drafts, most recently edited first."
          total={total}
          pageSizeOptions={[10, 25, 50]}
        />
      )}

      <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
        <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
          <LayoutTemplate size={18} strokeWidth={1.75} style={{ color: "var(--content-tertiary)" }} />
          <h2 className="t-headline" style={{ margin: 0, color: "var(--content-primary)" }}>
            Start from a template
          </h2>
        </div>
        <p className="t-footnote prose-measure" style={{ margin: 0, color: "var(--content-tertiary)" }}>
          Ten references from Convin&rsquo;s own send history. Opening one makes
          your own copy — nothing here is ever edited in place, so it stays a
          clean starting point for the next person too.
        </p>

        {startersReason ? (
          <p className="t-footnote" style={{ margin: 0, color: "var(--signal-abort)" }}>
            Couldn&rsquo;t load the template gallery — {startersReason}.
          </p>
        ) : starters.length === 0 ? (
          <p className="t-footnote" style={{ margin: 0, color: "var(--content-tertiary)" }}>
            No templates on file.
          </p>
        ) : (
          <div
            style={{
              border: "1px solid var(--stroke-rim)",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
              background: "var(--surface-raised)",
            }}
          >
            {starters.map((starter, index) => (
              <div
                key={starter.id}
                className="flex flex-wrap items-center justify-between"
                style={{
                  gap: "var(--space-3)",
                  minHeight: "56px",
                  padding: "var(--space-2) var(--space-4)",
                  borderTop: index === 0 ? "none" : "1px solid var(--stroke-hairline)",
                }}
              >
                <div className="flex flex-wrap items-center" style={{ gap: "var(--space-3)", minWidth: 0 }}>
                  <span className="t-subhead" style={{ fontWeight: 600, color: "var(--content-primary)" }}>
                    {starter.name}
                  </span>
                  <span className="t-footnote" style={{ color: "var(--content-tertiary)" }}>
                    {starter.clientName ?? "No client"}
                  </span>
                  <Pill tone="neutral">{templateMeta(starter.templateKey).name}</Pill>
                </div>
                <Button
                  size="s"
                  variant="tinted"
                  loading={openingStarter === starter.id}
                  onClick={() => startFromTemplate(starter)}
                >
                  Use this template
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="New draft"
        description="Name it now so you and everyone else can find it later."
        footer={
          <>
            <Button variant="glass" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              variant="solid"
              loading={busy}
              disabled={newName.trim() === ""}
              onClick={create}
            >
              Create draft
            </Button>
          </>
        }
      >
        <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
          <Field
            label="Draft name"
            required
            hint="Only you and your colleagues see this — it never reaches a client."
          >
            <TextInput
              value={newName}
              placeholder="September retention review"
              onChange={(event) => setNewName(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") create();
              }}
            />
          </Field>

          <Field
            label="Client"
            hint="You can set this later, but a report cannot be sent without one."
          >
            <ClientSelect
              id="new-draft-client"
              clients={clients}
              clientsReason={clientsReason}
              value={newClient}
              onChange={setNewClient}
            />
          </Field>
        </div>
      </Sheet>

      <Alert
        open={doomed !== null}
        onClose={() => setDoomed(null)}
        title={doomed ? `Delete ${doomed.name}?` : "Delete this draft?"}
        body="The draft and everything written in it go for good. Campaigns already sent are untouched."
        safeAction={{ label: "Keep it", onClick: () => setDoomed(null) }}
        dangerAction={{
          label: "Delete draft",
          loading: busy,
          onClick: () => {
            if (doomed) destroy(doomed);
          },
        }}
      />
    </section>
  );
}
