/**
 * A deliberately small Markdown subset for report bodies.
 *
 * The order matters: every character is HTML-escaped FIRST, and only then are
 * the handful of permitted constructs re-introduced. There is therefore no path
 * by which text a user typed can become markup — a report body is prose, and an
 * analyst pasting a chart's `<script>` tooltip must not be able to author HTML
 * inside a client's inbox.
 */

import type { EmailPalette } from "./palette";
import { FONT_STACK } from "./palette";

export type TemplateVariables = {
  client_name: string;
  contact_first_name: string;
  report_number: string;
  /** "98th" from a report number like "DL-098". See `reportOrdinalOf`. */
  report_ordinal: string;
};

export const VARIABLE_TOKENS = [
  "client_name",
  "contact_first_name",
  "report_number",
  "report_ordinal",
] as const;

export type VariableToken = (typeof VARIABLE_TOKENS)[number];

export const VARIABLE_LABEL: Record<VariableToken, string> = {
  client_name: "Client name",
  contact_first_name: "Contact first name",
  report_number: "Report number",
  report_ordinal: "Report ordinal",
};

/** 1 → "1st", 11 → "11th", 22 → "22nd" — the exceptions are 11/12/13. */
function ordinalOf(n: number): string {
  const remainder100 = n % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * "DL-098" → "98th". Reads the last run of digits in the report number —
 * the same convention `suggestReportNumber` uses to find the counter — and
 * returns "next" when there is no number to read, so a template fills with
 * a word rather than an empty gap.
 */
export function reportOrdinalOf(reportNumber: string): string {
  const match = reportNumber.match(/(\d+)(?!.*\d)/);
  if (!match) return "next";
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? ordinalOf(n) : "next";
}

/**
 * Substitutes `{{token}}`. An unknown token is left exactly as typed rather
 * than blanked — a visible `{{owner}}` in a preview is a bug the author can
 * see and fix; an empty space is one they cannot.
 */
export function applyVariables(input: string, vars: TemplateVariables): string {
  return input.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, name: string) => {
    const key = name.toLowerCase() as VariableToken;
    if ((VARIABLE_TOKENS as readonly string[]).includes(key)) {
      return vars[key] ?? "";
    }
    return whole;
  });
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only http(s) survives. `javascript:` and `data:` are dropped entirely. */
export function safeUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isHttpUrl(input: string | null | undefined): boolean {
  return safeUrl(input) !== null;
}

function inline(escaped: string, palette: EmailPalette): string {
  return (
    escaped
      // [label](url) — the URL is re-validated after escaping.
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, href: string) => {
        const url = safeUrl(href.replace(/&amp;/g, "&"));
        if (!url) return label;
        return `<a href="${escapeHtml(url)}" style="color:${palette.linkInk};text-decoration:underline;">${label}</a>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])_([^_]+)_(?=[\s.,)!?]|$)/g, "$1<em>$2</em>")
      .replace(
        /`([^`]+)`/g,
        `<code style="font-family:monospace;font-size:13px;background:${palette.quoteBg};padding:1px 5px;border-radius:4px;">$1</code>`,
      )
  );
}

/**
 * Block-level rendering. Paragraphs, H2/H3, unordered and ordered lists,
 * blockquotes, images and horizontal rules. Everything else is a paragraph.
 */
export function markdownToEmailHtml(source: string, palette: EmailPalette): string {
  const escaped = escapeHtml(source.replace(/\r\n/g, "\n"));
  const blocks = escaped.split(/\n{2,}/);
  const out: string[] = [];
  const font = palette.fontStack ?? FONT_STACK;

  const p = `margin:0 0 14px;font-family:${font};font-size:15px;line-height:24px;color:${palette.inkMuted};`;

  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;

    // ![caption](url) on its own line — an inline report image with its caption.
    const image = block.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (image) {
      const url = safeUrl(image[2].replace(/&amp;/g, "&"));
      if (url) {
        const caption = image[1];
        out.push(
          `<img src="${escapeHtml(url)}" alt="${caption}" width="536" ` +
            `style="display:block;width:100%;max-width:536px;height:auto;border:1px solid ${palette.hairline};border-radius:10px;margin:0 0 8px;">`,
        );
        if (caption) {
          out.push(
            `<p style="margin:0 0 18px;font-family:${font};font-size:12px;line-height:16px;color:${palette.inkFaint};">${caption}</p>`,
          );
        }
        continue;
      }
    }

    if (/^---+$/.test(block)) {
      out.push(
        `<hr style="border:0;border-top:1px solid ${palette.hairline};margin:20px 0;">`,
      );
      continue;
    }

    if (block.startsWith("### ")) {
      out.push(
        `<h3 style="margin:20px 0 8px;font-family:${font};font-size:15px;line-height:20px;font-weight:600;color:${palette.ink};">${inline(block.slice(4), palette)}</h3>`,
      );
      continue;
    }

    if (block.startsWith("## ")) {
      out.push(
        `<h2 style="margin:24px 0 10px;font-family:${font};font-size:18px;line-height:24px;font-weight:600;color:${palette.ink};">${inline(block.slice(3), palette)}</h2>`,
      );
      continue;
    }

    if (block.startsWith("> ")) {
      const quoted = block
        .split("\n")
        .map((line) => line.replace(/^>\s?/, ""))
        .join(" ");
      out.push(
        `<blockquote style="margin:0 0 16px;padding:12px 16px;background:${palette.quoteBg};` +
          `border-left:3px solid ${palette.accent};border-radius:0 8px 8px 0;font-family:${font};` +
          `font-size:15px;line-height:23px;color:${palette.ink};">${inline(quoted, palette)}</blockquote>`,
      );
      continue;
    }

    const lines = block.split("\n");
    const bulleted = lines.every((line) => /^[-*]\s+/.test(line.trim()));
    const numbered = lines.every((line) => /^\d+[.)]\s+/.test(line.trim()));

    if (bulleted || numbered) {
      const tag = numbered ? "ol" : "ul";
      const items = lines
        .map((line) => line.trim().replace(/^([-*]|\d+[.)])\s+/, ""))
        .map(
          (item) =>
            `<li style="margin:0 0 6px;font-family:${font};font-size:15px;line-height:23px;color:${palette.inkMuted};">${inline(item, palette)}</li>`,
        )
        .join("");
      out.push(
        `<${tag} style="margin:0 0 16px;padding-left:22px;">${items}</${tag}>`,
      );
      continue;
    }

    out.push(`<p style="${p}">${inline(lines.join("<br>"), palette)}</p>`);
  }

  return out.join("\n");
}

/** The plain-text alternative. Same content, no markup, no tracking. */
export function markdownToPlainText(source: string): string {
  return source
    .replace(/\r\n/g, "\n")
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_w, caption: string, url: string) =>
      caption ? `${caption}: ${url}` : url,
    )
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)")
    .replace(/^#{2,3}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
