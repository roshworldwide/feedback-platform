/**
 * Compose vocabulary — the steps, the document, the rules.
 *
 * A leaf module on purpose. It imports nothing that reaches a database and
 * nothing that carries a colour literal, so the five step panels (client
 * components) and the server actions that persist and send share exactly one
 * definition of what a draft is. v1's compose screen defined its payload twice
 * and the two definitions drifted; this one cannot.
 *
 * `src/lib/email/templates` is the only email module safe to import here — it
 * is deliberately free of colour. `palette`, `render` and `markdown` all carry
 * or import literal hexes and stay on the server.
 */

import {
  DEFAULT_TEMPLATE,
  isTemplateKey,
  type TemplateKey,
} from "@/lib/email/templates";

/* ── The five steps ───────────────────────────────────────────────────────── */

export const COMPOSE_STEPS = [
  "content",
  "design",
  "ai-check",
  "recipients",
  "review",
  "send",
] as const;

export type ComposeStep = (typeof COMPOSE_STEPS)[number];

export type StepMeta = {
  step: ComposeStep;
  label: string;
  /** One line in the rail — what this step decides, not what it contains. */
  hint: string;
};

export const STEP_META: readonly StepMeta[] = [
  { step: "content", label: "Content", hint: "Who it is for and what it says" },
  { step: "design", label: "Design", hint: "Which template carries it" },
  { step: "ai-check", label: "AI Check", hint: "Polish tone and structure, optional" },
  { step: "recipients", label: "Recipients", hint: "Who receives it" },
  { step: "review", label: "Review", hint: "How it will land" },
  { step: "send", label: "Send", hint: "Now, later, or every month" },
] as const;

export function isComposeStep(value: unknown): value is ComposeStep {
  return (
    typeof value === "string" && (COMPOSE_STEPS as readonly string[]).includes(value)
  );
}

export function parseStep(value: unknown): ComposeStep {
  return isComposeStep(value) ? value : "content";
}

export function stepIndex(step: ComposeStep): number {
  return COMPOSE_STEPS.indexOf(step);
}

/** The address of a step. Shareable, and it survives a refresh. */
export function stepHref(draftId: string, step: ComposeStep): string {
  return `/compose/${draftId}?step=${step}`;
}

export function nextStep(step: ComposeStep): ComposeStep | null {
  return COMPOSE_STEPS[stepIndex(step) + 1] ?? null;
}

export function previousStep(step: ComposeStep): ComposeStep | null {
  const index = stepIndex(step);
  return index > 0 ? COMPOSE_STEPS[index - 1] : null;
}

/* ── Limits ───────────────────────────────────────────────────────────────── */

export const MAX_IMAGES = 3;

/** Mirrors `SUBJECT_SOFT_LIMIT` in `src/lib/email/render.ts`. */
export const SUBJECT_SOFT_LIMIT = 70;
/** Mirrors `SUBJECT_HARD_LIMIT` in `src/lib/email/render.ts`. */
export const SUBJECT_HARD_LIMIT = 150;

/** Most providers reject above 25 MB encoded; 20 MB raw is the working ceiling. */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export const DEFAULT_FEEDBACK_QUESTION = "Was this report helpful?";

export const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
] as const;

export type Timezone = (typeof TIMEZONES)[number];

export function isTimezone(value: unknown): value is Timezone {
  return typeof value === "string" && (TIMEZONES as readonly string[]).includes(value);
}

/* ── Wall time in a zone → the instant it names ───────────────────────────── */

/** The zone's offset from UTC, in milliseconds, at a given instant. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));

  const read = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    // Some engines render midnight as hour 24.
    read("hour") % 24,
    read("minute"),
    read("second"),
  );
  return asUtc - utcMs;
}

/**
 * "2026-09-01" + "09:00" + "Asia/Kolkata" → the ISO instant that names.
 *
 * A schedule stated in the client's own timezone and stored as UTC is the only
 * pair that survives a daylight-saving change. The offset is resolved twice so
 * a time that falls on a transition still lands on the correct side of it.
 * Returns null when either field is unreadable — a bad date must produce a
 * sentence, never a silently wrong send time.
 */
export function zonedToUtcISO(
  date: string,
  time: string,
  timeZone: string,
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{2}:\d{2}$/.test(time)) return null;

  const naive = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(naive)) return null;

  try {
    const firstPass = naive - zoneOffsetMs(naive, timeZone);
    const settled = naive - zoneOffsetMs(firstPass, timeZone);
    return new Date(settled).toISOString();
  } catch {
    return null;
  }
}

/* ── Variables ────────────────────────────────────────────────────────────── */

/**
 * Mirrors `VARIABLE_TOKENS` in `src/lib/email/markdown.ts`, which cannot be
 * imported here because it pulls the email palette into the browser bundle.
 */
export const COMPOSE_VARIABLES = [
  { token: "client_name", label: "Client name", sample: "Cleartrip" },
  { token: "contact_first_name", label: "Contact first name", sample: "Priya" },
  { token: "report_number", label: "Report number", sample: "DL-034" },
  { token: "report_ordinal", label: "Report ordinal", sample: "34th" },
] as const;

export type ComposeVariable = (typeof COMPOSE_VARIABLES)[number]["token"];

export function variableChip(token: ComposeVariable): string {
  return `{{${token}}}`;
}

/** Every `{{token}}` occurrence in the body, in the order it appears. */
export function usedVariables(source: string): ComposeVariable[] {
  const found: ComposeVariable[] = [];
  for (const match of source.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)) {
    const token = match[1].toLowerCase();
    const known = COMPOSE_VARIABLES.find((item) => item.token === token);
    if (known) found.push(known.token);
  }
  return found;
}

/** Removes every occurrence of one variable, and the space it leaves behind. */
export function removeVariable(source: string, token: ComposeVariable): string {
  return source
    .replace(new RegExp(`\\{\\{\\s*${token}\\s*\\}\\}`, "gi"), "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n");
}

/* ── The DL template ──────────────────────────────────────────────────────── */

/** The bracket the author is expected to type over — never resolved automatically. */
export const TOPIC_PLACEHOLDER = "[the topic of this analysis]";

/**
 * v1's body pattern, tokenised. `{{report_ordinal}}` and `{{report_number}}`
 * resolve at render time, same as anywhere else in the body; the topic has
 * no live source on the document, so it stays a plain bracket the author
 * types over, same convention as every other "fill this in" placeholder in
 * the product.
 *
 * v1's own pattern opened with "Hi {{client_name}} Team,", but v2's renderer
 * already prepends "Hi {contact's first name}," to every body, for every
 * template — porting v1's greeting verbatim would double it into "Hi Admin,
 * Hi Thyrocare Team,". Dropped here rather than reproduced.
 */
export function dlTemplateBody(): string {
  return [
    "Here is the {{report_ordinal}} set of findings from Convin's Data Research Lab.",
    "",
    `{{report_number}}: The purpose of this analysis is to identify ${TOPIC_PLACEHOLDER}.`,
  ].join("\n");
}

/** v1's campaign title convention, tokenised the same way as the body. */
export function dlTitleConvention(): string {
  return `{{report_number}} || Convin Data Insights || ${TOPIC_PLACEHOLDER} || {{client_name}} ||`;
}

/**
 * A single-line list row truncates titles around this width. v1's titles
 * were cut mid-word ("|| PW On", "|| Cleartr") because the convention was
 * never designed against the medium — this is the number that convention is
 * now designed against.
 */
export const TITLE_LIST_TRUNCATE_AT = 60;

/** What a list row actually shows: the title, cut with an ellipsis. */
export function truncateForList(title: string, limit: number = TITLE_LIST_TRUNCATE_AT): string {
  const trimmed = title.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit).trimEnd()}…`;
}

/* ── The document ─────────────────────────────────────────────────────────── */

export type ComposeImage = { url: string; caption: string };

export type ComposeAttachment = {
  name: string;
  url: string;
  /** Null when the file was linked rather than measured. Stated on screen. */
  sizeBytes: number | null;
};

export type AdHocRecipient = {
  email: string;
  fullName: string;
  isInternal: boolean;
};

export type SendMode = "now" | "schedule" | "series";

export type ComposeDoc = {
  /** A real `clients.id`. Never a typed name — this is the v1 defect. */
  clientId: string | null;
  seriesId: string | null;
  reportNumber: string;
  title: string;
  periodLabel: string;
  subject: string;
  bodyMd: string;
  templateKey: TemplateKey;
  reportUrl: string;
  images: ComposeImage[];
  attachment: ComposeAttachment | null;
  feedbackEnabled: boolean;
  feedbackQuestion: string;
  feedbackAskComment: boolean;
  /** Appends this client's last three reports' real figures under the body. */
  scoreboardEnabled: boolean;
  /** Selected `contacts.id` values. `is_internal` is read from the row at send. */
  contactIds: string[];
  adHoc: AdHocRecipient[];
  sendMode: SendMode;
  /** yyyy-mm-dd. Empty until a schedule is chosen. */
  scheduledDate: string;
  /** HH:mm, 24 hour. */
  scheduledTime: string;
  timezone: Timezone;
};

export const EMPTY_DOC: ComposeDoc = {
  clientId: null,
  seriesId: null,
  reportNumber: "",
  title: "",
  periodLabel: "",
  subject: "",
  bodyMd: "",
  templateKey: DEFAULT_TEMPLATE,
  reportUrl: "",
  images: [],
  attachment: null,
  feedbackEnabled: true,
  feedbackQuestion: DEFAULT_FEEDBACK_QUESTION,
  feedbackAskComment: true,
  scoreboardEnabled: false,
  contactIds: [],
  adHoc: [],
  sendMode: "now",
  scheduledDate: "",
  scheduledTime: "09:00",
  timezone: "Asia/Kolkata",
};

/* ── Parsing ──────────────────────────────────────────────────────────────── */

type Bag = Record<string, unknown>;

function bag(value: unknown): Bag {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Bag)
    : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function idOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function sendModeOf(value: unknown): SendMode {
  return value === "schedule" || value === "series" ? value : "now";
}

/**
 * Reads a stored `drafts.payload` into a document, filling anything missing
 * with a stated default. A payload written by an older shape loads rather than
 * throwing — a draft a colleague started must never become unopenable.
 */
export function parseComposeDoc(payload: unknown): ComposeDoc {
  const source = bag(payload);

  const images: ComposeImage[] = list(source.images)
    .map((item) => {
      const image = bag(item);
      return { url: text(image.url).trim(), caption: text(image.caption) };
    })
    .filter((image) => image.url !== "" || image.caption !== "")
    .slice(0, MAX_IMAGES);

  const attachmentSource = source.attachment;
  const attachment: ComposeAttachment | null = (() => {
    if (attachmentSource === null || attachmentSource === undefined) return null;
    const item = bag(attachmentSource);
    const name = text(item.name).trim();
    if (name === "") return null;
    const size = Number(item.sizeBytes);
    return {
      name,
      url: text(item.url).trim(),
      sizeBytes: Number.isFinite(size) && size > 0 ? Math.round(size) : null,
    };
  })();

  const adHoc: AdHocRecipient[] = list(source.adHoc)
    .map((item) => {
      const person = bag(item);
      return {
        email: text(person.email).trim().toLowerCase(),
        fullName: text(person.fullName).trim(),
        isInternal: bool(person.isInternal, false),
      };
    })
    .filter((person) => person.email !== "");

  const contactIds = [
    ...new Set(
      list(source.contactIds).filter(
        (item): item is string => typeof item === "string" && item !== "",
      ),
    ),
  ];

  const templateKey = source.templateKey;

  return {
    clientId: idOrNull(source.clientId),
    seriesId: idOrNull(source.seriesId),
    reportNumber: text(source.reportNumber),
    title: text(source.title),
    periodLabel: text(source.periodLabel),
    subject: text(source.subject),
    bodyMd: text(source.bodyMd),
    templateKey: isTemplateKey(templateKey) ? templateKey : DEFAULT_TEMPLATE,
    reportUrl: text(source.reportUrl),
    images,
    attachment,
    feedbackEnabled: bool(source.feedbackEnabled, true),
    feedbackQuestion: text(source.feedbackQuestion, DEFAULT_FEEDBACK_QUESTION),
    feedbackAskComment: bool(source.feedbackAskComment, true),
    scoreboardEnabled: bool(source.scoreboardEnabled, false),
    contactIds,
    adHoc,
    sendMode: sendModeOf(source.sendMode),
    scheduledDate: text(source.scheduledDate),
    scheduledTime: text(source.scheduledTime, "09:00"),
    timezone: isTimezone(source.timezone) ? source.timezone : "Asia/Kolkata",
  };
}

/* ── Small validators ─────────────────────────────────────────────────────── */

/**
 * Mirrors `safeUrl` in `src/lib/email/markdown.ts`. Only http(s) passes, so a
 * `javascript:` report link is rejected in the form as well as in the renderer.
 */
export function isHttpUrl(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed === "") return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Mirrors the `contacts_email_shape` check, plus a dot in the domain. */
export function isEmailShaped(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

export function fmtBytes(bytes: number | null): string {
  if (bytes === null) return "size unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Recipients ───────────────────────────────────────────────────────────── */

export type RecipientChoice = {
  /** A `contacts.id`, or `adhoc:<email>` for one added by hand. */
  key: string;
  contactId: string | null;
  email: string;
  fullName: string;
  title: string;
  isInternal: boolean;
  bouncedAt: string | null;
  isActive: boolean;
};

/**
 * Every recipient list a send actually goes to passes through this first —
 * an unsubscribe or a spam complaint sets `contacts.is_active = false`, and
 * that must remove the person from the very next send, not merely mark them
 * with a pill on a screen someone might not be looking at.
 */
export function activeOnly(choices: RecipientChoice[]): RecipientChoice[] {
  return choices.filter((person) => person.isActive);
}

export type RecipientSummary = {
  total: number;
  client: number;
  internal: number;
  bounced: number;
  invalid: number;
};

export function summariseRecipients(chosen: RecipientChoice[]): RecipientSummary {
  let client = 0;
  let internal = 0;
  let bounced = 0;
  let invalid = 0;
  for (const person of chosen) {
    if (person.isInternal) internal += 1;
    else client += 1;
    if (person.bouncedAt) bounced += 1;
    if (!isEmailShaped(person.email)) invalid += 1;
  }
  return { total: chosen.length, client, internal, bounced, invalid };
}

/** "9 recipients — 5 client, 4 internal". Never a rounded or guessed figure. */
export function recipientSentence(summary: RecipientSummary): string {
  if (summary.total === 0) return "No recipients yet";
  const noun = summary.total === 1 ? "recipient" : "recipients";
  return `${summary.total} ${noun} — ${summary.client} client, ${summary.internal} internal`;
}

/* ── Pre-flight ───────────────────────────────────────────────────────────── */

export type CheckId =
  | "client"
  | "title"
  | "subject"
  | "report-url"
  | "attachment"
  | "recipients"
  | "addresses"
  | "feedback";

export type CheckTone = "pass" | "warn" | "fail";

export type PreflightCheck = {
  id: CheckId;
  label: string;
  tone: CheckTone;
  /** States the fact. A failure also states the next action. */
  detail: string;
  /** The step that fixes it. */
  fix: ComposeStep;
};

/**
 * The list the Review step renders and the send action re-runs. One definition,
 * so a send can never succeed on a rule the checklist showed as failing.
 */
export function preflight(
  doc: ComposeDoc,
  chosen: RecipientChoice[],
): PreflightCheck[] {
  const summary = summariseRecipients(chosen);
  const subject = doc.subject.trim();
  const checks: PreflightCheck[] = [];

  checks.push(
    doc.clientId
      ? {
          id: "client",
          label: "Client is set",
          tone: "pass",
          detail: "The report is attributed to a client record.",
          fix: "content",
        }
      : {
          id: "client",
          label: "Client is set",
          tone: "fail",
          detail:
            "Pick the client on the Content step. A campaign cannot be created without one.",
          fix: "content",
        },
  );

  checks.push(
    doc.title.trim() !== ""
      ? {
          id: "title",
          label: "Report title is set",
          tone: "pass",
          detail: doc.title.trim(),
          fix: "content",
        }
      : {
          id: "title",
          label: "Report title is set",
          tone: "fail",
          detail: "Add a title on the Content step — it heads the email.",
          fix: "content",
        },
  );

  if (subject === "") {
    checks.push({
      id: "subject",
      label: "Subject line is set",
      tone: "fail",
      detail: "Add a subject on the Content step. An empty subject will not send.",
      fix: "content",
    });
  } else if (subject.length > SUBJECT_SOFT_LIMIT) {
    checks.push({
      id: "subject",
      label: "Subject line is set",
      tone: "warn",
      detail: `${subject.length} characters — Gmail truncates around ${SUBJECT_SOFT_LIMIT} on a phone.`,
      fix: "content",
    });
  } else {
    checks.push({
      id: "subject",
      label: "Subject line is set",
      tone: "pass",
      detail: `${subject.length} of ${SUBJECT_SOFT_LIMIT} characters before truncation.`,
      fix: "content",
    });
  }

  if (doc.reportUrl.trim() === "") {
    checks.push({
      id: "report-url",
      label: "Report URL is valid",
      tone: "warn",
      detail: "No report link, so the email will carry no call to action.",
      fix: "content",
    });
  } else if (isHttpUrl(doc.reportUrl)) {
    checks.push({
      id: "report-url",
      label: "Report URL is valid",
      tone: "pass",
      detail: doc.reportUrl.trim(),
      fix: "content",
    });
  } else {
    checks.push({
      id: "report-url",
      label: "Report URL is valid",
      tone: "fail",
      detail:
        "The report link is not an http or https address, so it would be dropped. Correct it on the Content step.",
      fix: "content",
    });
  }

  if (!doc.attachment) {
    checks.push({
      id: "attachment",
      label: "Attachment under 20 MB",
      tone: "pass",
      detail: "No attachment on this report.",
      fix: "content",
    });
  } else if (doc.attachment.sizeBytes === null) {
    checks.push({
      id: "attachment",
      label: "Attachment under 20 MB",
      tone: "warn",
      detail: `${doc.attachment.name} was linked, not uploaded, so its size is unknown.`,
      fix: "content",
    });
  } else if (doc.attachment.sizeBytes > MAX_ATTACHMENT_BYTES) {
    checks.push({
      id: "attachment",
      label: "Attachment under 20 MB",
      tone: "fail",
      detail: `${doc.attachment.name} is ${fmtBytes(doc.attachment.sizeBytes)}. Link it from the report instead.`,
      fix: "content",
    });
  } else {
    checks.push({
      id: "attachment",
      label: "Attachment under 20 MB",
      tone: "pass",
      detail: `${doc.attachment.name} — ${fmtBytes(doc.attachment.sizeBytes)}.`,
      fix: "content",
    });
  }

  checks.push(
    summary.client > 0
      ? {
          id: "recipients",
          label: "At least one client recipient",
          tone: "pass",
          detail: recipientSentence(summary),
          fix: "recipients",
        }
      : {
          id: "recipients",
          label: "At least one client recipient",
          tone: "fail",
          detail:
            summary.total === 0
              ? "Nobody is selected. Choose recipients on the Recipients step."
              : "Only internal colleagues are selected, so no client would receive this.",
          fix: "recipients",
        },
  );

  if (summary.invalid > 0) {
    checks.push({
      id: "addresses",
      label: "All recipients valid",
      tone: "fail",
      detail: `${summary.invalid} of ${summary.total} addresses are not usable. Correct them on the Recipients step.`,
      fix: "recipients",
    });
  } else if (summary.bounced > 0) {
    checks.push({
      id: "addresses",
      label: "All recipients valid",
      tone: "warn",
      detail: `${summary.bounced} previously bounced. They are still included — remove them if the address has not been corrected.`,
      fix: "recipients",
    });
  } else {
    checks.push({
      id: "addresses",
      label: "All recipients valid",
      tone: "pass",
      detail: "Every address is well formed and none has bounced before.",
      fix: "recipients",
    });
  }

  checks.push(
    doc.feedbackEnabled
      ? {
          id: "feedback",
          label: "Feedback block enabled",
          tone: "pass",
          detail: doc.feedbackQuestion.trim() || DEFAULT_FEEDBACK_QUESTION,
          fix: "content",
        }
      : {
          id: "feedback",
          label: "Feedback block enabled",
          tone: "warn",
          detail:
            "The rating block is off, so this report will collect no satisfaction data.",
          fix: "content",
        },
  );

  return checks;
}

export function blockingFailures(checks: PreflightCheck[]): PreflightCheck[] {
  return checks.filter((check) => check.tone === "fail");
}

/* ── What the server hands the panels ─────────────────────────────────────── */

/** One row of `clients`, as the searchable select needs it. */
export type ClientOption = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type SeriesOption = {
  id: string;
  clientId: string;
  name: string;
  frequency: string;
  templateKey: TemplateKey;
};

export type DraftCardView = {
  id: string;
  name: string;
  clientName: string | null;
  templateKey: TemplateKey;
  reportTitle: string | null;
  updatedAt: string;
  ownerName: string | null;
  /** True when the signed-in person may rename, overwrite or delete it. */
  mine: boolean;
};

/* ── Action results ───────────────────────────────────────────────────────── */

export type ActionResult<T> =
  | { ok: true; data: T }
  /** Names the state, the cause and the next action. Never blames the reader. */
  | { ok: false; message: string };

export type SavedDraft = { id: string; name: string; updatedAt: string };

export type RenderedPreview = {
  subject: string;
  html: string;
  text: string;
  /** True when the scoreboard block was appended from real prior figures. */
  scoreboardIncluded: boolean;
};

export type SentCampaign = {
  campaignId: string;
  status: "sent" | "scheduled";
  attempted: number;
  accepted: number;
  failed: number;
  clientName: string;
  scheduledFor: string | null;
};
