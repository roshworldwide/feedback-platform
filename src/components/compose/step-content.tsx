"use client";

/**
 * Step 1 · Content.
 *
 * The client is a foreign-key select and nothing else. Every other field on
 * this step is prose the author owns; this one is a reference to a row, and it
 * is the difference between a send history that can be counted and v1's, which
 * could not.
 *
 * The DL number is suggested from the numbers already used for *this client*
 * — a fresh, never-before-used one, as a convenience default. Reusing a
 * number is allowed and not flagged; the field is free text and the
 * suggestion fills it and stops there, never applied silently.
 */

import * as React from "react";
import { Paperclip, Plus, Sparkles, Trash2, Upload, WandSparkles } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Select,
  Sheet,
  Switch,
  TextInput,
  useToast,
  type SelectOption,
} from "@/components/ui";
import {
  createSeriesAction,
  suggestReportNumberAction,
  uploadMediaAction,
} from "@/app/(app)/compose/actions";
import { BodyEditor } from "./body-editor";
import { ClientSelect } from "./client-select";
import { StepAiCheck } from "./step-ai-check";
import {
  DEFAULT_FEEDBACK_QUESTION,
  MAX_IMAGES,
  SUBJECT_SOFT_LIMIT,
  TITLE_LIST_TRUNCATE_AT,
  dlTemplateBody,
  dlTitleConvention,
  fmtBytes,
  isHttpUrl,
  truncateForList,
  type ClientOption,
  type ComposeDoc,
  type SeriesOption,
} from "./vocabulary";

export type StepContentProps = {
  doc: ComposeDoc;
  patch: (change: Partial<ComposeDoc>) => void;
  clients: ClientOption[] | null;
  clientsReason: string | null;
  series: SeriesOption[] | null;
  seriesReason: string | null;
  /** Adds a newly created series to the list without a round trip. */
  onSeriesAdded: (series: SeriesOption) => void;
  /** False renders "Polish this draft" disabled with a one-line explanation. */
  aiCheckAvailable: boolean;
};

const FREQUENCIES: SelectOption[] = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "adhoc", label: "Ad hoc" },
];

function sectionCard(title: string, description: string, children: React.ReactNode) {
  return (
    <Card elevation="e1">
      <CardHeader>
        <CardTitle as="h2" description={description}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col" style={{ gap: "var(--space-5)" }}>
        {children}
      </CardBody>
    </Card>
  );
}

export function StepContent({
  doc,
  patch,
  clients,
  clientsReason,
  series,
  seriesReason,
  onSeriesAdded,
  aiCheckAvailable,
}: StepContentProps) {
  const { toast } = useToast();
  const [suggesting, setSuggesting] = React.useState(false);
  const [creatingSeries, setCreatingSeries] = React.useState(false);
  const [seriesName, setSeriesName] = React.useState("");
  const [seriesFrequency, setSeriesFrequency] = React.useState("monthly");
  const [seriesBusy, setSeriesBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState<string | null>(null);
  const [polishing, setPolishing] = React.useState(false);

  const forClient = React.useMemo(
    () => (series ?? []).filter((item) => item.clientId === doc.clientId),
    [series, doc.clientId],
  );

  const subject = doc.subject;
  const subjectOver = subject.trim().length > SUBJECT_SOFT_LIMIT;

  function suggestNumber() {
    if (!doc.clientId) return;
    setSuggesting(true);
    void suggestReportNumberAction(doc.clientId).then((result) => {
      setSuggesting(false);
      if (!result.ok) {
        toast({ message: result.message, tone: "abort" });
        return;
      }
      if (result.data) patch({ reportNumber: result.data });
    });
  }

  function createSeries() {
    if (!doc.clientId || seriesName.trim() === "") return;
    setSeriesBusy(true);
    void createSeriesAction(doc.clientId, seriesName, seriesFrequency).then((result) => {
      setSeriesBusy(false);
      if (!result.ok) {
        toast({ message: result.message, tone: "abort" });
        return;
      }
      const created: SeriesOption = {
        id: result.data.id,
        clientId: doc.clientId ?? "",
        name: result.data.name,
        frequency: result.data.frequency,
        templateKey: doc.templateKey,
      };
      onSeriesAdded(created);
      patch({ seriesId: created.id });
      setCreatingSeries(false);
      setSeriesName("");
      toast({ message: `Created the ${created.name} series.`, tone: "nominal" });
    });
  }

  function upload(file: File, slot: string, onDone: (url: string, name: string, size: number) => void) {
    setUploading(slot);
    const form = new FormData();
    form.set("file", file);
    void uploadMediaAction(form).then((result) => {
      setUploading(null);
      if (!result.ok) {
        toast({ message: result.message, tone: "abort" });
        return;
      }
      onDone(result.data.url, result.data.name, result.data.sizeBytes);
    });
  }

  function patchImage(index: number, change: Partial<{ url: string; caption: string }>) {
    const images = doc.images.map((image, position) =>
      position === index ? { ...image, ...change } : image,
    );
    patch({ images });
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      {sectionCard(
        "Who it is for",
        "A campaign cannot be created without a client. This is a reference to a record, never a name you type.",
        <>
          <Field
            label="Client"
            required
            error={
              doc.clientId === null && clients !== null
                ? "Pick a client. The report cannot be sent, or counted, without one."
                : null
            }
            hint="Search by name or slug. Add a new client on the Clients screen."
          >
            <ClientSelect
              id="compose-client"
              clients={clients}
              clientsReason={clientsReason}
              value={doc.clientId}
              invalid={doc.clientId === null}
              onChange={(clientId) =>
                // A series and a set of contacts belong to a client. Keeping
                // either across a change would attach this report to people who
                // do not work there.
                patch({
                  clientId,
                  seriesId: null,
                  contactIds: [],
                })
              }
            />
          </Field>

          <Field
            label="Report series"
            hint={
              seriesReason
                ? undefined
                : "The cadence this report belongs to. DL numbers are suggested from it."
            }
            error={seriesReason ? `Couldn't load series — ${seriesReason}` : null}
          >
            <div className="flex flex-wrap items-center" style={{ gap: "var(--space-3)" }}>
              <div style={{ flex: "1 1 240px" }}>
                <Select
                  options={[
                    { value: "", label: "No series — a one-off report" },
                    ...forClient.map((item) => ({
                      value: item.id,
                      label: `${item.name} · ${item.frequency}`,
                    })),
                  ]}
                  value={doc.seriesId ?? ""}
                  disabled={!doc.clientId}
                  aria-label="Report series"
                  onChange={(event) =>
                    patch({ seriesId: event.currentTarget.value || null })
                  }
                />
              </div>
              <Button
                size="s"
                variant="tinted"
                leadingIcon={Plus}
                disabled={!doc.clientId}
                onClick={() => setCreatingSeries((current) => !current)}
              >
                New series
              </Button>
            </div>
          </Field>

          {creatingSeries ? (
            <div
              className="flex flex-wrap items-end"
              style={{
                gap: "var(--space-3)",
                padding: "var(--space-4)",
                borderRadius: "var(--radius-sm)",
                background: "var(--fill-quiet)",
              }}
            >
              <div style={{ flex: "1 1 200px" }}>
                <Field label="Series name" required>
                  <TextInput
                    value={seriesName}
                    placeholder="Monthly quality review"
                    onChange={(event) => setSeriesName(event.currentTarget.value)}
                  />
                </Field>
              </div>
              <div style={{ flex: "0 1 180px" }}>
                <Field label="Frequency">
                  <Select
                    options={FREQUENCIES}
                    value={seriesFrequency}
                    aria-label="Series frequency"
                    onChange={(event) => setSeriesFrequency(event.currentTarget.value)}
                  />
                </Field>
              </div>
              <Button
                variant="solid"
                loading={seriesBusy}
                disabled={seriesName.trim() === ""}
                onClick={createSeries}
              >
                Create series
              </Button>
            </div>
          ) : null}
        </>,
      )}

      {sectionCard(
        "What it is",
        "The header of the email, and the row you will look for on the Campaigns screen a month from now.",
        <>
          <div
            className="grid"
            style={{
              gap: "var(--space-5)",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            <Field
              label="DL number"
              hint="Free text — reuse one as often as you like. 'Next' suggests an unused one."
            >
              <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                <TextInput
                  value={doc.reportNumber}
                  placeholder="DL-034"
                  onChange={(event) => patch({ reportNumber: event.currentTarget.value })}
                />
                <Button
                  size="s"
                  variant="plain"
                  leadingIcon={Sparkles}
                  loading={suggesting}
                  disabled={!doc.clientId}
                  onClick={suggestNumber}
                >
                  Next
                </Button>
              </div>
            </Field>

            <Field label="Period covered" hint="As the client refers to it.">
              <TextInput
                value={doc.periodLabel}
                placeholder="August 2026"
                onChange={(event) => patch({ periodLabel: event.currentTarget.value })}
              />
            </Field>
          </div>

          <Field
            label="Report title"
            required
            error={
              doc.title.trim() === ""
                ? "A title heads the email and names the row in Campaigns."
                : null
            }
            hint={
              doc.title.trim() !== "" ? (
                <span className="flex flex-col" style={{ gap: "var(--space-1)" }}>
                  <span
                    className="t-footnote"
                    style={{ color: "var(--content-tertiary)" }}
                  >
                    In a list that truncates at {TITLE_LIST_TRUNCATE_AT} characters:
                  </span>
                  <span
                    className="t-footnote tabular"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color:
                        doc.title.trim().length > TITLE_LIST_TRUNCATE_AT
                          ? "var(--signal-caution)"
                          : "var(--content-secondary)",
                    }}
                  >
                    {truncateForList(doc.title)}
                  </span>
                </span>
              ) : undefined
            }
          >
            <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
              <TextInput
                value={doc.title}
                placeholder="Monthly quality review"
                onChange={(event) => patch({ title: event.currentTarget.value })}
              />
              <Button
                size="s"
                variant="plain"
                leadingIcon={Sparkles}
                onClick={() => patch({ title: dlTitleConvention() })}
              >
                Use the DL convention
              </Button>
            </div>
          </Field>

          <Field
            label="Subject line"
            required
            error={
              doc.subject.trim() === ""
                ? "An empty subject will not send. Write the line the client sees first."
                : null
            }
            note={
              <span
                className="tabular"
                style={{
                  color: subjectOver ? "var(--signal-caution)" : "var(--content-tertiary)",
                }}
              >
                {subject.length} characters ·{" "}
                {subjectOver
                  ? `over ${SUBJECT_SOFT_LIMIT}, so Gmail will truncate it on a phone`
                  : `${SUBJECT_SOFT_LIMIT - subject.trim().length} left before Gmail truncates it on a phone`}
              </span>
            }
          >
            <TextInput
              value={doc.subject}
              maxLength={150}
              placeholder="Your August quality review is ready"
              onChange={(event) => patch({ subject: event.currentTarget.value })}
            />
          </Field>
        </>,
      )}

      {sectionCard(
        "What it says",
        "Markdown. Headings, lists, quotes, links, bold, italic and rules — everything else is escaped before it reaches an inbox.",
        <>
          <Field label="Body" hint="Written to the contact by name where you use the variable.">
            <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
              <div className="flex flex-wrap items-center" style={{ gap: "var(--space-2)" }}>
                <Button
                  size="s"
                  variant="plain"
                  leadingIcon={Sparkles}
                  onClick={() => patch({ bodyMd: dlTemplateBody() })}
                >
                  Use the DL template
                </Button>
                <Button
                  size="s"
                  variant="plain"
                  leadingIcon={WandSparkles}
                  disabled={!aiCheckAvailable}
                  onClick={() => setPolishing(true)}
                >
                  Polish this draft
                </Button>
              </div>
              <BodyEditor
                id="compose-body"
                value={doc.bodyMd}
                onChange={(bodyMd) => patch({ bodyMd })}
              />
              {aiCheckAvailable ? null : (
                <p className="t-caption" style={{ margin: 0, color: "var(--content-tertiary)" }}>
                  Polish is off — no API key is configured.
                </p>
              )}
            </div>
          </Field>

          <Field
            label="Report URL"
            hint="The call to action links here, through a click-tracking redirect."
            error={
              doc.reportUrl.trim() !== "" && !isHttpUrl(doc.reportUrl)
                ? "Only http and https addresses survive the renderer. Correct it, or clear the field."
                : null
            }
          >
            <TextInput
              value={doc.reportUrl}
              inputMode="url"
              placeholder="https://reports.convin.ai/august"
              onChange={(event) => patch({ reportUrl: event.currentTarget.value })}
            />
          </Field>
        </>,
      )}

      {sectionCard(
        "Images",
        `Up to ${MAX_IMAGES}. An inbox fetches an image from a public address, so a file on your laptop cannot be sent — upload it or paste a link.`,
        <>
          {doc.images.length === 0 ? (
            <p className="t-footnote" style={{ margin: 0, color: "var(--content-tertiary)" }}>
              No images. The body reads as prose.
            </p>
          ) : null}

          {doc.images.map((image, index) => (
            <div
              key={index}
              className="flex flex-col"
              style={{
                gap: "var(--space-3)",
                padding: "var(--space-4)",
                borderRadius: "var(--radius-sm)",
                background: "var(--fill-quiet)",
              }}
            >
              <div
                className="flex items-center justify-between"
                style={{ gap: "var(--space-3)" }}
              >
                <span className="t-footnote" style={{ color: "var(--content-secondary)", fontWeight: 600 }}>
                  Image {index + 1}
                </span>
                <Button
                  size="s"
                  variant="plain"
                  leadingIcon={Trash2}
                  aria-label={`Remove image ${index + 1}`}
                  style={{ color: "var(--signal-abort)" }}
                  onClick={() =>
                    patch({ images: doc.images.filter((_, position) => position !== index) })
                  }
                >
                  Remove
                </Button>
              </div>

              <Field
                label="Image address"
                error={
                  image.url.trim() !== "" && !isHttpUrl(image.url)
                    ? "Only http and https addresses are embedded. Anything else is dropped."
                    : null
                }
              >
                <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                  <TextInput
                    value={image.url}
                    inputMode="url"
                    placeholder="https://…/chart.png"
                    onChange={(event) => patchImage(index, { url: event.currentTarget.value })}
                  />
                  <label
                    className="t-micro relative inline-flex items-center"
                    style={{
                      flex: "none",
                      gap: "var(--space-1)",
                      height: "var(--cap-s-h)",
                      paddingInline: "var(--space-4)",
                      borderRadius: "var(--radius-capsule)",
                      background: "var(--fill-quiet)",
                      border: "1px solid var(--stroke-hairline)",
                      color: "var(--content-accent)",
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: "50%",
                        height: "44px",
                        transform: "translateY(-50%)",
                      }}
                    />
                    <Upload size={12} strokeWidth={2} aria-hidden="true" />
                    {uploading === `image-${index}` ? "Uploading…" : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = "";
                        if (file) {
                          upload(file, `image-${index}`, (url) => patchImage(index, { url }));
                        }
                      }}
                    />
                  </label>
                </div>
              </Field>

              <Field label="Caption" hint="Also the alt text, so it is read aloud when images are blocked.">
                <TextInput
                  value={image.caption}
                  placeholder="Resolution time by queue, August"
                  onChange={(event) => patchImage(index, { caption: event.currentTarget.value })}
                />
              </Field>
            </div>
          ))}

          {doc.images.length < MAX_IMAGES ? (
            <div>
              <Button
                size="s"
                variant="tinted"
                leadingIcon={Plus}
                onClick={() => patch({ images: [...doc.images, { url: "", caption: "" }] })}
              >
                Add image
              </Button>
            </div>
          ) : (
            <p className="t-caption" style={{ margin: 0, color: "var(--content-tertiary)" }}>
              {MAX_IMAGES} of {MAX_IMAGES} used. Remove one to add another.
            </p>
          )}
        </>,
      )}

      {sectionCard(
        "Attachment",
        "One file, named in the email and linked from it. The size is checked against the 20 MB ceiling on the Review step.",
        doc.attachment ? (
          <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
            <div
              className="flex flex-wrap items-center"
              style={{
                gap: "var(--space-3)",
                padding: "var(--space-4)",
                borderRadius: "var(--radius-sm)",
                background: "var(--fill-quiet)",
              }}
            >
              <Paperclip
                size={16}
                strokeWidth={1.75}
                aria-hidden="true"
                style={{ color: "var(--content-tertiary)" }}
              />
              <span className="t-subhead" style={{ flex: "1 1 auto", minWidth: 0 }}>
                {doc.attachment.name}
                <span
                  className="t-caption tabular"
                  style={{ display: "block", color: "var(--content-tertiary)" }}
                >
                  {fmtBytes(doc.attachment.sizeBytes)}
                </span>
              </span>
              <Button
                size="s"
                variant="plain"
                leadingIcon={Trash2}
                style={{ color: "var(--signal-abort)" }}
                onClick={() => patch({ attachment: null })}
              >
                Remove
              </Button>
            </div>

            <Field
              label="Attachment link"
              hint="The address the client opens. An email carries the link, not the bytes."
              error={
                doc.attachment.url.trim() !== "" && !isHttpUrl(doc.attachment.url)
                  ? "Only http and https addresses are usable here."
                  : null
              }
            >
              <TextInput
                value={doc.attachment.url}
                inputMode="url"
                placeholder="https://…/august-review.pdf"
                onChange={(event) =>
                  patch({
                    attachment: doc.attachment
                      ? { ...doc.attachment, url: event.currentTarget.value }
                      : null,
                  })
                }
              />
            </Field>
          </div>
        ) : (
          <div className="flex flex-wrap items-center" style={{ gap: "var(--space-3)" }}>
            <label
              className="t-subhead relative inline-flex items-center"
              style={{
                gap: "var(--space-2)",
                height: "var(--cap-m-h)",
                paddingInline: "var(--space-5)",
                borderRadius: "var(--radius-capsule)",
                background: "var(--fill-quiet)",
                border: "1px solid var(--stroke-hairline)",
                color: "var(--content-accent)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Upload size={14} strokeWidth={2} aria-hidden="true" />
              {uploading === "attachment" ? "Uploading…" : "Choose a file"}
              <input
                type="file"
                className="sr-only"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (!file) return;
                  // The name and the size are recorded from the file itself, so
                  // the 20 MB pre-flight check measures the real thing.
                  patch({
                    attachment: { name: file.name, url: "", sizeBytes: file.size },
                  });
                  upload(file, "attachment", (url, name, sizeBytes) =>
                    patch({ attachment: { name, url, sizeBytes } }),
                  );
                }}
              />
            </label>
            <Button
              size="s"
              variant="plain"
              leadingIcon={Plus}
              onClick={() =>
                patch({ attachment: { name: "Report.pdf", url: "", sizeBytes: null } })
              }
            >
              Link one instead
            </Button>
          </div>
        ),
      )}

      {sectionCard(
        "Feedback and figures",
        "The rating block is how this product knows whether a report landed. Turning it off is allowed, and stated on the Review step.",
        <>
          <div className="flex items-start" style={{ gap: "var(--space-4)" }}>
            <Switch
              checked={doc.feedbackEnabled}
              label="Ask for a rating"
              onCheckedChange={(feedbackEnabled) => patch({ feedbackEnabled })}
            />
            <div style={{ minWidth: 0 }}>
              <p className="t-subhead" style={{ margin: 0, color: "var(--content-primary)" }}>
                Ask for a rating
              </p>
              <p
                className="t-caption prose-measure"
                style={{ margin: 0, color: "var(--content-tertiary)" }}
              >
                Five stars, each one a plain link, so a rating survives an image
                blocker and a text-only client.
              </p>
            </div>
          </div>

          {doc.feedbackEnabled ? (
            <>
              <Field label="Question" hint="Sentence case. It sits above the stars.">
                <TextInput
                  value={doc.feedbackQuestion}
                  placeholder={DEFAULT_FEEDBACK_QUESTION}
                  onChange={(event) => patch({ feedbackQuestion: event.currentTarget.value })}
                />
              </Field>

              <div className="flex items-start" style={{ gap: "var(--space-4)" }}>
                <Switch
                  checked={doc.feedbackAskComment}
                  label="Ask for a written comment after the rating"
                  onCheckedChange={(feedbackAskComment) => patch({ feedbackAskComment })}
                />
                <div style={{ minWidth: 0 }}>
                  <p className="t-subhead" style={{ margin: 0, color: "var(--content-primary)" }}>
                    Ask for a written comment after the rating
                  </p>
                  <p
                    className="t-caption prose-measure"
                    style={{ margin: 0, color: "var(--content-tertiary)" }}
                  >
                    The comment box appears on the page the star opens, never in
                    the email itself.
                  </p>
                </div>
              </div>
            </>
          ) : null}

          <div className="flex items-start" style={{ gap: "var(--space-4)" }}>
            <Switch
              checked={doc.scoreboardEnabled}
              label="Include the performance scoreboard"
              onCheckedChange={(scoreboardEnabled) => patch({ scoreboardEnabled })}
            />
            <div style={{ minWidth: 0 }}>
              <p className="t-subhead" style={{ margin: 0, color: "var(--content-primary)" }}>
                Include the performance scoreboard
              </p>
              <p
                className="t-caption prose-measure"
                style={{ margin: 0, color: "var(--content-tertiary)" }}
              >
                Appends this client&rsquo;s last three sent reports with their
                real open counts and average ratings, read from{" "}
                <code>campaign_stats</code> — the same numbers the Campaigns
                screen shows. Internal recipients and test sends are already
                excluded. If the client has no sent reports yet, nothing is
                appended rather than a row of dashes.
              </p>
            </div>
          </div>
        </>,
      )}

      <Sheet
        open={polishing}
        onClose={() => setPolishing(false)}
        title="Polish this draft"
        description="Tone, spacing and structure only. Every number in the body is checked and guaranteed unchanged — nothing is applied until you accept it below."
      >
        <StepAiCheck doc={doc} patch={patch} aiCheckAvailable={aiCheckAvailable} />
      </Sheet>
    </div>
  );
}
