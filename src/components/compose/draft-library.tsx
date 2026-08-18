"use client";

/**
 * The draft library.
 *
 * FIX: v1 had exactly three global draft slots. They were unnamed, unowned and
 * shared by everyone, the template gallery could only load into two of them,
 * and a colleague starting a fourth report silently overwrote your first. Here
 * a draft is a row: it has a name you chose, the client it is for, the
 * template it will wear, when it was last touched and who owns it — and there
 * may be as many as the work requires.
 *
 * The search is in the URL, so a filtered library is a shareable address and
 * the count under it is the true count for that search.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, FilePlus2, SquarePen, Trash2 } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Pill,
  SearchInput,
  Sheet,
  TextInput,
  useToast,
} from "@/components/ui";
import { templateMeta } from "@/lib/email/templates";
import { fmtDateTime } from "@/lib/utils";
import {
  createDraftAction,
  deleteDraftAction,
  duplicateDraftAction,
} from "@/app/(app)/compose/actions";
import { ClientSelect } from "./client-select";
import { TemplateThumbnail } from "./template-thumbnail";
import { stepHref, type ClientOption, type DraftCardView } from "./vocabulary";

export type DraftLibraryProps = {
  cards: DraftCardView[];
  total: number;
  /** True when more drafts exist than one read could return. Stated on screen. */
  incomplete: boolean;
  query: string;
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

export function DraftLibrary({
  cards,
  total,
  incomplete,
  query,
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

  React.useEffect(() => {
    if (term.trim() === query) return;
    const timer = window.setTimeout(() => {
      const next = term.trim();
      router.replace(next ? `/compose?q=${encodeURIComponent(next)}` : "/compose", {
        scroll: false,
      });
    }, 320);
    return () => window.clearTimeout(timer);
  }, [term, query, router]);

  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newClient, setNewClient] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [doomed, setDoomed] = React.useState<DraftCardView | null>(null);

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

  return (
    <section
      aria-label="Draft library"
      className="flex flex-col"
      style={{ gap: "var(--space-5)", opacity: pending ? 0.72 : 1 }}
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
              onClick: () => (query ? router.replace("/compose") : setCreating(true)),
            }}
          />
        </Card>
      ) : (
        <ul
          className="grid"
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            gap: "var(--space-4)",
            gridTemplateColumns: "repeat(auto-fill, minmax(288px, 1fr))",
          }}
        >
          {cards.map((card) => {
            const meta = templateMeta(card.templateKey);
            return (
              <li key={card.id}>
                <Card
                  elevation="e1"
                  style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    // Concentric: radius-lg outside, radius-sm on the child at
                    // a space-2 gap.
                    padding: "var(--space-2)",
                  }}
                >
                  <Link
                    href={stepHref(card.id, "content")}
                    style={{
                      display: "block",
                      textDecoration: "none",
                      color: "inherit",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    <TemplateThumbnail meta={meta} width={288} />
                  </Link>

                  <div
                    className="flex flex-col"
                    style={{
                      gap: "var(--space-2)",
                      padding: "var(--space-4) var(--space-3) var(--space-3)",
                      flex: "1 1 auto",
                    }}
                  >
                    <Link
                      href={stepHref(card.id, "content")}
                      className="t-headline"
                      style={{
                        color: "var(--content-primary)",
                        textDecoration: "none",
                      }}
                    >
                      {card.name}
                    </Link>

                    <p
                      className="t-footnote"
                      style={{ margin: 0, color: "var(--content-secondary)" }}
                    >
                      {card.clientName ?? "No client yet"}
                      {card.reportTitle ? ` · ${card.reportTitle}` : ""}
                    </p>

                    <div
                      className="flex flex-wrap items-center"
                      style={{ gap: "var(--space-2)" }}
                    >
                      <Pill tone="neutral">{meta.name}</Pill>
                      {card.mine ? null : <Pill tone="caution">Not yours</Pill>}
                    </div>

                    <p
                      className="t-caption"
                      style={{
                        margin: "auto 0 0",
                        color: "var(--content-tertiary)",
                      }}
                    >
                      Edited {ageFrom(now, card.updatedAt)} ·{" "}
                      {card.ownerName ?? "owner unknown"}
                    </p>
                  </div>

                  <div
                    className="flex flex-wrap items-center"
                    style={{
                      gap: "var(--space-2)",
                      padding: "var(--space-3)",
                      borderTop: "1px solid var(--stroke-hairline)",
                    }}
                  >
                    <Button
                      as={Link}
                      href={stepHref(card.id, "content")}
                      size="s"
                      variant="tinted"
                      leadingIcon={SquarePen}
                    >
                      Open
                    </Button>
                    <Button
                      size="s"
                      variant="plain"
                      leadingIcon={Copy}
                      aria-label={`Duplicate ${card.name}`}
                      onClick={() => duplicate(card)}
                    >
                      Duplicate
                    </Button>
                    <Button
                      size="s"
                      variant="plain"
                      leadingIcon={Trash2}
                      aria-label={`Delete ${card.name}`}
                      style={{ marginLeft: "auto", color: "var(--signal-abort)" }}
                      onClick={() => setDoomed(card)}
                    >
                      Delete
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p
        className="t-footnote"
        style={{ margin: 0, color: "var(--content-tertiary)" }}
      >
        Showing {cards.length} of {total} {total === 1 ? "draft" : "drafts"}.
      </p>

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="New draft"
        description="Name it now so you and everyone else can find it later."
        side="right"
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
