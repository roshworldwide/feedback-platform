"use client";

/**
 * The compose editor.
 *
 * The step lives in the URL, so a half-written report is a shareable address
 * and a refresh returns you to the panel you were on. The document lives here
 * and is persisted on every step change: leaving Content for Design is a save
 * point, so is every other move, and the rail says when the last one landed.
 *
 * Nothing on this screen fabricates. Where a list could not be read the panel
 * says so and names the cause; it never renders an empty list that looks like
 * an answer.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronLeft, RotateCcw, Save } from "lucide-react";
import { Alert, Button, Card, Field, TextInput, useToast } from "@/components/ui";
import { loadRecipientsAction, saveDraftAction } from "@/app/(app)/compose/actions";
import { StepAiCheck } from "./step-ai-check";
import { StepContent } from "./step-content";
import { StepDesign } from "./step-design";
import { StepRail } from "./step-rail";
import { StepRecipients } from "./step-recipients";
import { StepReview } from "./step-review";
import { StepSend } from "./step-send";
import {
  COMPOSE_STEPS,
  EMPTY_DOC,
  isEmailShaped,
  nextStep,
  preflight,
  previousStep,
  stepHref,
  STEP_META,
  type ClientOption,
  type ComposeDoc,
  type ComposeStep,
  type RecipientChoice,
  type SeriesOption,
} from "./vocabulary";

export type ComposeEditorProps = {
  draftId: string;
  draftName: string;
  initialDoc: ComposeDoc;
  step: ComposeStep;
  clients: ClientOption[] | null;
  clientsReason: string | null;
  series: SeriesOption[] | null;
  seriesReason: string | null;
  provider: "resend" | "dev";
  /** False when the draft belongs to a colleague — saving will be refused. */
  mine: boolean;
  /** False renders the AI Check step disabled with a one-line explanation. */
  aiCheckAvailable: boolean;
};

function clockLabel(): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function ComposeEditor({
  draftId,
  draftName,
  initialDoc,
  step,
  clients,
  clientsReason,
  series: initialSeries,
  seriesReason,
  provider,
  mine,
  aiCheckAvailable,
}: ComposeEditorProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [doc, setDoc] = React.useState<ComposeDoc>(initialDoc);
  const [name, setName] = React.useState(draftName);
  const [series, setSeries] = React.useState<SeriesOption[] | null>(initialSeries);
  const [saving, setSaving] = React.useState(false);
  const [savedLabel, setSavedLabel] = React.useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);

  const [contactsNonce, setContactsNonce] = React.useState(0);
  const clientId = doc.clientId;

  /**
   * The contact list, tagged with the client and the attempt it answers.
   * "Loading" is the absence of an answer for the current pair, derived rather
   * than flipped in an effect — so switching client twice quickly can never
   * leave the previous client's people on screen.
   */
  type LoadedContacts = {
    clientId: string;
    nonce: number;
    rows: RecipientChoice[] | null;
    reason: string | null;
  };
  const [loaded, setLoaded] = React.useState<LoadedContacts | null>(null);

  const settled =
    loaded !== null && loaded.clientId === clientId && loaded.nonce === contactsNonce;
  const contacts = settled ? loaded.rows : null;
  const contactsReason = settled ? loaded.reason : null;
  const contactsLoading = clientId !== null && !settled;

  React.useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    void loadRecipientsAction(clientId).then((result) => {
      if (cancelled) return;
      setLoaded({
        clientId,
        nonce: contactsNonce,
        rows: result.ok ? result.data : null,
        reason: result.ok ? null : result.message,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, contactsNonce]);

  const patch = React.useCallback((change: Partial<ComposeDoc>) => {
    setDoc((current) => ({ ...current, ...change }));
  }, []);

  const save = React.useCallback(async (): Promise<boolean> => {
    if (!mine) return false;
    setSaving(true);
    const result = await saveDraftAction(draftId, name, doc);
    setSaving(false);
    if (!result.ok) {
      toast({ message: result.message, tone: "abort" });
      return false;
    }
    setSavedLabel(`at ${clockLabel()}`);
    return true;
  }, [draftId, name, doc, mine, toast]);

  const go = React.useCallback(
    (target: ComposeStep) => {
      // Every step change is a save point. The navigation does not wait on it —
      // a slow write must not hold the panel — but a failure is reported.
      void save();
      router.push(stepHref(draftId, target), { scroll: true });
    },
    [save, router, draftId],
  );

  /**
   * Writes `EMPTY_DOC` directly rather than routing through `save()` — that
   * callback closes over the `doc` from this render, which `setDoc` below
   * has not updated yet, so calling it here would persist the content this
   * is meant to discard.
   */
  async function resetDraft() {
    if (!mine) return;
    setResetting(true);
    const result = await saveDraftAction(draftId, name, EMPTY_DOC);
    setResetting(false);
    setConfirmingReset(false);
    if (!result.ok) {
      toast({ message: result.message, tone: "abort" });
      return;
    }
    setDoc(EMPTY_DOC);
    setSavedLabel(`at ${clockLabel()}`);
    router.push(stepHref(draftId, "content"), { scroll: true });
    toast({ message: "The draft was reset. Everything written in it is gone.", tone: "neutral" });
  }

  /* ── Who is actually selected ───────────────────────────────────────────── */

  const chosen = React.useMemo<RecipientChoice[]>(() => {
    const byKey = new Map<string, RecipientChoice>();
    for (const contact of contacts ?? []) {
      if (doc.contactIds.includes(contact.key)) byKey.set(contact.email, contact);
    }
    for (const person of doc.adHoc) {
      if (byKey.has(person.email)) continue;
      byKey.set(person.email, {
        key: `adhoc:${person.email}`,
        contactId: null,
        email: person.email,
        fullName: person.fullName,
        title: "",
        isInternal: person.isInternal,
        bouncedAt: null,
        isActive: true,
      });
    }
    return [...byKey.values()];
  }, [contacts, doc.contactIds, doc.adHoc]);

  /* ── What the rail shows ────────────────────────────────────────────────── */

  const checks = React.useMemo(() => preflight(doc, chosen), [doc, chosen]);

  const problems = React.useMemo(() => {
    const counts: Partial<Record<ComposeStep, number>> = {};
    for (const check of checks) {
      if (check.tone !== "fail") continue;
      counts[check.fix] = (counts[check.fix] ?? 0) + 1;
    }
    return counts;
  }, [checks]);

  const complete = React.useMemo<Partial<Record<ComposeStep, boolean>>>(() => {
    const contentOk =
      doc.clientId !== null && doc.title.trim() !== "" && doc.subject.trim() !== "";
    return {
      content: contentOk,
      design: true,
      "ai-check": true,
      recipients: chosen.some((person) => !person.isInternal),
      review: checks.every((check) => check.tone !== "fail"),
      send: false,
    };
  }, [doc.clientId, doc.title, doc.subject, chosen, checks]);

  const clientName =
    (clients ?? []).find((client) => client.id === doc.clientId)?.name ?? null;

  const forward = nextStep(step);
  const back = previousStep(step);
  const meta = STEP_META.find((item) => item.step === step) ?? STEP_META[0];

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
      <header className="flex flex-col" style={{ gap: "var(--space-3)" }}>
        <Button
          as={Link}
          href="/compose"
          size="s"
          variant="plain"
          leadingIcon={ChevronLeft}
          style={{ alignSelf: "flex-start" }}
        >
          All drafts
        </Button>

        <div
          className="flex flex-wrap items-end justify-between"
          style={{ gap: "var(--space-4)" }}
        >
          <div style={{ flex: "1 1 320px", maxWidth: "520px" }}>
            <Field
              label="Draft name"
              hint="Internal only. It never appears in an email."
              disabled={!mine}
            >
              <TextInput
                value={name}
                disabled={!mine}
                onChange={(event) => setName(event.currentTarget.value)}
                onBlur={() => {
                  if (mine) void save();
                }}
              />
            </Field>
          </div>

          <Button
            variant="glass"
            leadingIcon={RotateCcw}
            disabled={!mine}
            onClick={() => setConfirmingReset(true)}
          >
            Reset draft
          </Button>

          <Button
            variant="glass"
            leadingIcon={Save}
            loading={saving}
            disabled={!mine}
            onClick={() => void save()}
          >
            Save draft
          </Button>
        </div>

        <Alert
          open={confirmingReset}
          onClose={() => setConfirmingReset(false)}
          title="Reset this draft?"
          body="Every field on every step — the client, the copy, the recipients, the schedule — goes back to blank. The draft itself is not deleted, and this cannot be undone."
          safeAction={{ label: "Keep it", onClick: () => setConfirmingReset(false) }}
          dangerAction={{ label: "Reset draft", loading: resetting, onClick: () => void resetDraft() }}
        />

        {mine ? null : (
          <p
            role="status"
            className="t-footnote prose-measure"
            style={{ margin: 0, color: "var(--signal-caution)" }}
          >
            This draft belongs to a colleague, so it is read-only for you.
            Duplicate it from the library to make your own copy — nothing here
            will be saved.
          </p>
        )}
      </header>

      <div
        className="flex flex-wrap items-start"
        style={{ gap: "var(--space-6)" }}
      >
        <div style={{ flex: "1 1 240px", maxWidth: "296px", position: "sticky", top: "var(--space-4)" }}>
          <Card elevation="e1" style={{ padding: "var(--space-4)" }}>
            <StepRail
              current={step}
              onGo={go}
              complete={complete}
              problems={problems}
              saving={saving}
              savedLabel={savedLabel}
            />
          </Card>
        </div>

        <div
          className="flex flex-col"
          style={{ flex: "999 1 560px", gap: "var(--space-5)", minWidth: 0 }}
        >
            <div>
              <h1
                className="t-title-2"
                style={{ margin: 0, color: "var(--content-primary)" }}
              >
                {meta.label}
              </h1>
              <p
                className="t-subhead prose-measure"
                style={{ margin: "var(--space-1) 0 0", color: "var(--content-secondary)" }}
              >
                Step {COMPOSE_STEPS.indexOf(step) + 1} of {COMPOSE_STEPS.length} ·{" "}
                {meta.hint}
              </p>
            </div>

            {step === "content" ? (
              <StepContent
                doc={doc}
                patch={patch}
                clients={clients}
                clientsReason={clientsReason}
                series={series}
                seriesReason={seriesReason}
                onSeriesAdded={(created) =>
                  setSeries((current) => [...(current ?? []), created])
                }
              />
            ) : null}

            {step === "design" ? <StepDesign doc={doc} patch={patch} /> : null}

            {step === "ai-check" ? (
              <StepAiCheck doc={doc} patch={patch} aiCheckAvailable={aiCheckAvailable} />
            ) : null}

            {step === "recipients" ? (
              <StepRecipients
                doc={doc}
                patch={patch}
                clientName={clientName}
                contacts={contacts}
                contactsReason={contactsReason}
                loading={contactsLoading}
                onReload={() => setContactsNonce((current) => current + 1)}
                chosen={chosen}
              />
            ) : null}

            {step === "review" ? (
              <StepReview doc={doc} chosen={chosen} clientName={clientName} onGo={go} />
            ) : null}

            {step === "send" ? (
              <StepSend
                doc={doc}
                patch={patch}
                draftId={draftId}
                clientName={clientName}
                chosen={chosen}
                series={series}
                provider={provider}
                onGo={go}
                onBeforeSend={async () => {
                  await save();
                }}
              />
            ) : null}

            <nav
              aria-label="Move between steps"
              className="flex flex-wrap items-center justify-between"
              style={{ gap: "var(--space-3)" }}
            >
              {back ? (
                <Button variant="glass" leadingIcon={ArrowLeft} onClick={() => go(back)}>
                  {STEP_META[COMPOSE_STEPS.indexOf(back)].label}
                </Button>
              ) : (
                <span />
              )}
              {forward ? (
                <Button variant="solid" trailingIcon={ArrowRight} onClick={() => go(forward)}>
                  {STEP_META[COMPOSE_STEPS.indexOf(forward)].label}
                </Button>
              ) : (
                <span />
              )}
            </nav>

            {/* Stated once, at the foot, where the exclusions bite. */}
            <p
              className="t-caption prose-measure"
              style={{ margin: 0, color: "var(--content-tertiary)" }}
            >
              Internal recipients receive the report and are excluded from every
              engagement figure. Test sends write no campaign at all.{" "}
              {chosen.some((person) => !isEmailShaped(person.email))
                ? "One or more selected addresses is not usable and will not be sent to."
                : ""}
            </p>
        </div>
      </div>
    </div>
  );
}
