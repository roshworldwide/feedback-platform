/**
 * The report email.
 *
 * Tables, 600px, inline styles, no custom properties and no webfont. The
 * anatomy is fixed and ordered — brand bar, "Prepared for", body, call to
 * action, signature, the rating block, footer — because a recipient who reads
 * three of these a month should never have to hunt for the same element twice.
 *
 * Every star is a plain link to the public page, so a rating survives an image
 * blocker, a text-only client and a corporate proxy that rewrites nothing but
 * hrefs. The open pixel is the last element in the body and its failure costs
 * nothing.
 */

import {
  applyVariables,
  escapeHtml,
  markdownToEmailHtml,
  markdownToPlainText,
  reportOrdinalOf,
  safeUrl,
  type TemplateVariables,
} from "./markdown";
import { FONT_STACK, paletteFor, type EmailPalette } from "./palette";
import { templateMeta, type TemplateKey } from "./templates";

export type ReportEmailImage = { url: string; caption: string };

export type ReportEmailInput = {
  templateKey: TemplateKey;
  /** Absolute origin. Every tracking URL is built from it. */
  appUrl: string;
  /** The per-recipient token from `campaign_recipients.token`. */
  token: string;
  clientName: string;
  contactFirstName: string;
  reportNumber: string | null;
  reportTitle: string;
  periodLabel: string;
  subject: string;
  bodyMd: string;
  reportUrl: string | null;
  images?: ReportEmailImage[];
  attachment?: { name: string; url?: string | null } | null;
  feedback: { enabled: boolean; question: string; askComment: boolean };
  signature: { name: string; title: string; org: string; replyTo?: string | null };
  links?: { unsubscribe?: string; preferences?: string; privacy?: string };
  /** A test send says so, at the top, in words. */
  isTest?: boolean;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
  preheader: string;
  /**
   * `List-Unsubscribe` / `List-Unsubscribe-Post`, computed once here so every
   * caller of this renderer carries them — never a second place a header
   * could be composed and drift from what the footer link actually points
   * at. Gmail and Yahoo's bulk-sender rules read both.
   */
  headers: Record<string, string>;
};

/** 600px is the widest column Outlook's reading pane renders without a scrollbar. */
const WIDTH = 600;

function row(inner: string, palette: EmailPalette, padding = "0 32px"): string {
  return `<tr><td style="padding:${padding};background:${palette.cardBg};">${inner}</td></tr>`;
}

function overline(text: string, palette: EmailPalette): string {
  const font = palette.fontStack ?? FONT_STACK;
  return (
    `<p style="margin:0 0 6px;font-family:${font};font-size:10px;line-height:14px;` +
    `font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:${palette.inkFaint};">${escapeHtml(text)}</p>`
  );
}

/* ── Header ──────────────────────────────────────────────────────────────── */

function header(input: ReportEmailInput, palette: EmailPalette): string {
  const meta = templateMeta(input.templateKey);
  const font = palette.fontStack ?? FONT_STACK;
  const mark =
    `<span style="font-family:${font};font-size:15px;line-height:20px;font-weight:700;` +
    `letter-spacing:-0.2px;color:${palette.headerInk};">Convin Data Labs</span>`;
  const sub =
    `<span style="font-family:${font};font-size:11px;line-height:16px;letter-spacing:1.4px;` +
    `text-transform:uppercase;color:${palette.headerInk};opacity:0.72;">${escapeHtml(meta.name === "Alert" ? "Threshold alert" : "Client reporting")}</span>`;

  if (meta.sketch.header === "bar") {
    return (
      `<tr><td style="background:${palette.headerBg};padding:20px 32px;">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td align="left">${mark}</td><td align="right">${sub}</td>` +
      `</tr></table></td></tr>` +
      `<tr><td style="height:3px;line-height:3px;font-size:0;background:${palette.headerRule};">&nbsp;</td></tr>`
    );
  }

  if (meta.sketch.header === "rule") {
    return (
      `<tr><td style="background:${palette.cardBg};padding:28px 32px 16px;">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td align="left"><span style="font-family:${font};font-size:15px;line-height:20px;font-weight:700;color:${palette.ink};">Convin Data Labs</span></td>` +
      `<td align="right"><span style="font-family:${font};font-size:11px;line-height:16px;letter-spacing:1.4px;text-transform:uppercase;color:${palette.inkFaint};">Client reporting</span></td>` +
      `</tr></table></td></tr>` +
      `<tr><td style="padding:0 32px;background:${palette.cardBg};">` +
      `<div style="height:2px;line-height:2px;font-size:0;background:${palette.headerRule};">&nbsp;</div></td></tr>`
    );
  }

  return (
    `<tr><td style="background:${palette.cardBg};padding:32px 32px 8px;">` +
    `<span style="font-family:${font};font-size:15px;line-height:20px;font-weight:700;color:${palette.ink};">Convin Data Labs</span>` +
    `</td></tr>`
  );
}

/* ── Call to action — a bulletproof capsule ──────────────────────────────── */

function cta(href: string, palette: EmailPalette): string {
  const font = palette.fontStack ?? FONT_STACK;
  return (
    `<p style="margin:0 0 10px;font-family:${font};font-size:14px;line-height:19px;font-weight:600;color:${palette.ink};">Access the complete analysis</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">` +
    `<tr><td align="center" bgcolor="${palette.ctaBg}" style="border-radius:999px;background:${palette.ctaBg};border-bottom:2px solid ${palette.ctaShadowRule};">` +
    `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" ` +
    `style="display:inline-block;padding:14px 28px;font-family:${font};font-size:15px;line-height:20px;` +
    `font-weight:600;letter-spacing:0.4px;color:${palette.ctaInk};text-decoration:none;border-radius:999px;">OPEN FULL REPORT &#8594;</a>` +
    `</td></tr></table>`
  );
}

/* ── The rating block ────────────────────────────────────────────────────── */

function ratingBlock(input: ReportEmailInput, palette: EmailPalette): string {
  const font = palette.fontStack ?? FONT_STACK;
  const question = input.feedback.question.trim() || "Was this report helpful?";
  const cells = [1, 2, 3, 4, 5]
    .map((n) => {
      const href = `${input.appUrl}/f/${input.token}?r=${n}`;
      return (
        `<td align="center" style="padding:0 2px;">` +
        `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" ` +
        `title="Rate ${n} out of 5" ` +
        `style="display:block;width:44px;height:44px;line-height:44px;text-align:center;` +
        `font-size:28px;color:${palette.starOn};text-decoration:none;">&#9733;</a>` +
        `<span style="display:block;font-family:${font};font-size:10px;line-height:14px;color:${palette.inkFaint};">${n}</span>` +
        `</td>`
      );
    })
    .join("");

  const comment = input.feedback.askComment
    ? `<p style="margin:10px 0 0;font-family:${font};font-size:12px;line-height:17px;color:${palette.inkFaint};">You can add a comment on the next screen — it goes straight to the analyst who wrote this.</p>`
    : "";

  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
    `style="background:${palette.quoteBg};border:1px solid ${palette.hairline};border-radius:12px;">` +
    `<tr><td align="center" style="padding:22px 24px;">` +
    `<p style="margin:0 0 8px;font-family:${font};font-size:10px;line-height:14px;font-weight:600;` +
    `letter-spacing:1.6px;text-transform:uppercase;color:${palette.inkFaint};">Quick feedback</p>` +
    `<p style="margin:0 0 4px;font-family:${font};font-size:17px;line-height:23px;font-weight:600;color:${palette.ink};">${escapeHtml(question)}</p>` +
    `<p style="margin:0 0 12px;font-family:${font};font-size:12px;line-height:17px;color:${palette.inkFaint};">Takes 15 seconds · Helps us improve future reports</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>${cells}</tr></table>` +
    comment +
    `</td></tr></table>`
  );
}

/* ── Footer ──────────────────────────────────────────────────────────────── */

function footer(input: ReportEmailInput, palette: EmailPalette): string {
  const font = palette.fontStack ?? FONT_STACK;
  const base = `${input.appUrl}/f/${input.token}`;
  // A real route, not a reply-to-this-address policy: /u/{token} both shows a
  // confirmation page and answers the mail client's own one-click POST.
  const unsubscribe = input.links?.unsubscribe ?? `${input.appUrl}/u/${input.token}`;
  const preferences = input.links?.preferences ?? `${base}?a=preferences`;
  const privacy = input.links?.privacy ?? `${base}?a=privacy`;

  const link = (href: string, label: string) =>
    `<a href="${escapeHtml(href)}" style="color:${palette.footerInk};text-decoration:underline;">${label}</a>`;

  return (
    `<table role="presentation" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0" ` +
    `style="width:${WIDTH}px;max-width:${WIDTH}px;">` +
    `<tr><td align="center" style="padding:20px 32px 32px;background:${palette.footerBg};">` +
    `<p style="margin:0 0 6px;font-family:${font};font-size:11px;line-height:17px;color:${palette.footerInk};">` +
    `${link(unsubscribe, "Unsubscribe")} &nbsp;·&nbsp; ${link(preferences, "Preferences")} &nbsp;·&nbsp; ${link(privacy, "Privacy")}` +
    `</p>` +
    `<p style="margin:0;font-family:${font};font-size:11px;line-height:17px;color:${palette.footerInk};">` +
    `Convin Data Labs · Bengaluru, India<br>You are receiving this because ${escapeHtml(input.clientName)} subscribes to this report series.` +
    `</p></td></tr></table>`
  );
}

/* ── Render ──────────────────────────────────────────────────────────────── */

export function renderReportEmail(input: ReportEmailInput): RenderedEmail {
  const palette = paletteFor(input.templateKey);
  const meta = templateMeta(input.templateKey);
  const font = palette.fontStack ?? FONT_STACK;

  const vars: TemplateVariables = {
    client_name: input.clientName,
    contact_first_name: input.contactFirstName,
    report_number: input.reportNumber ?? "",
    report_ordinal: reportOrdinalOf(input.reportNumber ?? ""),
  };

  const subject = applyVariables(input.subject, vars).trim();
  const title = applyVariables(input.reportTitle, vars).trim();

  // Images are appended to the body as Markdown so a stored campaign and a
  // live preview travel the same path — there is one renderer, not two.
  const imageMd = (input.images ?? [])
    .map((image) => safeUrl(image.url) && `![${image.caption}](${image.url})`)
    .filter((line): line is string => Boolean(line))
    .join("\n\n");

  const bodySource = [applyVariables(input.bodyMd, vars).trim(), imageMd]
    .filter(Boolean)
    .join("\n\n");

  const bodyHtml = markdownToEmailHtml(bodySource, palette);
  const reportUrl = safeUrl(input.reportUrl);
  // A test send writes no recipient row, so its token can never resolve to
  // one — routing its CTA through the same tracking redirect a real send
  // uses would always land on "this link has expired," a broken preview of
  // a link that isn't actually broken. Only a real send needs the redirect
  // (that's the only place a click has anyone to record it against);
  // a test send's CTA goes straight to the real destination instead.
  const ctaHref = input.isTest && reportUrl ? reportUrl : `${input.appUrl}/api/t/c/${input.token}`;
  const pixel = `${input.appUrl}/api/t/o/${input.token}`;

  const preheader =
    `${title}${input.periodLabel ? ` · ${input.periodLabel}` : ""} — prepared for ${input.clientName}`.slice(
      0,
      140,
    );

  const rows: string[] = [];

  rows.push(header(input, palette));

  if (input.isTest) {
    rows.push(
      row(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;background:${palette.quoteBg};border:1px dashed ${palette.accent};border-radius:10px;">` +
          `<tr><td style="padding:10px 14px;font-family:${font};font-size:12px;line-height:17px;color:${palette.ink};">` +
          `<strong>Test send.</strong> This copy was addressed to the author, not to the client, and is excluded from every reported figure.` +
          `</td></tr></table>`,
        palette,
      ),
    );
  }

  // "Prepared for {client}"
  rows.push(
    row(
      `<div style="padding-top:28px;">` +
        overline(`Prepared for ${input.clientName}`, palette) +
        `<h1 style="margin:0 0 4px;font-family:${font};font-size:24px;line-height:30px;font-weight:700;letter-spacing:-0.5px;color:${palette.ink};">${escapeHtml(title)}</h1>` +
        `<p style="margin:0 0 20px;font-family:${font};font-size:13px;line-height:18px;color:${palette.inkFaint};">` +
        [
          input.reportNumber ? escapeHtml(input.reportNumber) : null,
          input.periodLabel ? escapeHtml(input.periodLabel) : null,
        ]
          .filter(Boolean)
          .join(" &nbsp;·&nbsp; ") +
        `</p></div>`,
      palette,
    ),
  );

  // Body — nothing is prepended here. A greeting is only in the email if it
  // was typed into the body, e.g. as literal text or as {{contact_first_name}}.
  rows.push(row(bodyHtml, palette));

  // Attachment, stated rather than assumed.
  if (input.attachment?.name) {
    rows.push(
      row(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border:1px solid ${palette.hairline};border-radius:10px;">` +
          `<tr><td style="padding:12px 16px;font-family:${font};font-size:13px;line-height:18px;color:${palette.inkMuted};">` +
          `Attached: <strong style="color:${palette.ink};">${escapeHtml(input.attachment.name)}</strong>` +
          `</td></tr></table>`,
        palette,
      ),
    );
  }

  // Call to action
  if (reportUrl) {
    rows.push(row(cta(ctaHref, palette), palette));
  }

  // Signature
  rows.push(
    row(
      `<div style="border-top:1px solid ${palette.hairline};padding-top:18px;margin-bottom:${meta.key === "executive-brief" ? 20 : 26}px;">` +
        `<p style="margin:0;font-family:${font};font-size:14px;line-height:20px;font-weight:600;color:${palette.ink};">${escapeHtml(input.signature.name)}</p>` +
        `<p style="margin:0;font-family:${font};font-size:13px;line-height:19px;color:${palette.inkFaint};">${escapeHtml(input.signature.title)} · ${escapeHtml(input.signature.org)}</p>` +
        (input.signature.replyTo
          ? `<p style="margin:4px 0 0;font-family:${font};font-size:13px;line-height:19px;"><a href="mailto:${escapeHtml(input.signature.replyTo)}" style="color:${palette.linkInk};text-decoration:underline;">${escapeHtml(input.signature.replyTo)}</a></p>`
          : "") +
        `</div>`,
      palette,
    ),
  );

  // The rating block
  if (input.feedback.enabled) {
    rows.push(row(`<div style="padding-bottom:28px;">${ratingBlock(input, palette)}</div>`, palette));
  } else {
    rows.push(row(`<div style="padding-bottom:12px;"></div>`, palette));
  }

  const html =
    `<!doctype html><html lang="en" xmlns:v="urn:schemas-microsoft-com:vml"><head>` +
    `<meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="x-apple-disable-message-reformatting">` +
    `<meta name="color-scheme" content="${meta.mode}">` +
    `<meta name="supported-color-schemes" content="${meta.mode}">` +
    `<title>${escapeHtml(subject)}</title>` +
    `<style>@media only screen and (max-width:620px){` +
    `.cdl-shell{width:100%!important;}` +
    `.cdl-pad{padding-left:20px!important;padding-right:20px!important;}}` +
    `</style>` +
    `</head>` +
    `<body style="margin:0;padding:0;background:${palette.pageBg};-webkit-font-smoothing:antialiased;">` +
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${palette.pageBg};">` +
    `<tr><td align="center" style="padding:24px 12px;">` +
    `<table role="presentation" class="cdl-shell" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0" ` +
    `style="width:${WIDTH}px;max-width:${WIDTH}px;background:${palette.cardBg};border:1px solid ${palette.hairline};border-radius:14px;overflow:hidden;">` +
    rows.join("") +
    `</table>` +
    footer(input, palette) +
    `</td></tr></table>` +
    `<img src="${escapeHtml(pixel)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;outline:0;">` +
    `</body></html>`;

  const text = [
    `Prepared for ${input.clientName}`,
    "",
    title,
    [input.reportNumber, input.periodLabel].filter(Boolean).join(" · "),
    "",
    markdownToPlainText(bodySource),
    "",
    reportUrl ? `Access the complete analysis — OPEN FULL REPORT: ${ctaHref}` : "",
    input.attachment?.name ? `Attached: ${input.attachment.name}` : "",
    "",
    `${input.signature.name} — ${input.signature.title}, ${input.signature.org}`,
    "",
    input.feedback.enabled
      ? [
          "QUICK FEEDBACK",
          input.feedback.question || "Was this report helpful?",
          "Takes 15 seconds · Helps us improve future reports.",
          ...[1, 2, 3, 4, 5].map((n) => `${n} star${n === 1 ? "" : "s"}: ${input.appUrl}/f/${input.token}?r=${n}`),
        ].join("\n")
      : "",
    "",
    `Unsubscribe: ${input.appUrl}/u/${input.token}`,
  ]
    .filter((line) => line !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const unsubscribeUrl = input.links?.unsubscribe ?? `${input.appUrl}/u/${input.token}`;
  const headers = {
    "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:unsubscribe@convin.ai?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

  return { subject, html, text, preheader, headers };
}

/** Gmail truncates the subject at roughly 70 characters on a phone. */
export const SUBJECT_SOFT_LIMIT = 70;
export const SUBJECT_HARD_LIMIT = 150;
