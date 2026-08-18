/**
 * Template metadata.
 *
 * Deliberately free of colour, with one narrow, documented exception: `swatch`
 * below. This module is imported by the Design step in Compose, which runs in
 * the browser and may only paint AURUM semantic tokens for its own chrome —
 * but a template picker whose job is showing what fourteen different email
 * colour schemes look like cannot do that job in tokens alone, any more than
 * a colour-picker swatch can. `swatch` carries the five hexes a thumbnail
 * needs to be a real preview rather than a generic rectangle; it is a
 * deliberately small, hand-copied subset of `./palette`'s full 20-field
 * `EmailPalette`, kept separate on purpose so the email renderer's palette
 * stays server-only and this file stays the only place the browser reads
 * template colour from.
 */

export const TEMPLATE_KEYS = [
  "convin-premium",
  "convin-signature",
  "convin-dark",
  "convin-light",
  "executive-brief",
  "alert",
  "convin-bold",
  "convin-pro",
  "classic",
  "neon",
  "sunrise",
  "forest",
  "carbon",
  "convin-slate",
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const DEFAULT_TEMPLATE: TemplateKey = "convin-premium";

export function isTemplateKey(value: unknown): value is TemplateKey {
  return (
    typeof value === "string" && (TEMPLATE_KEYS as readonly string[]).includes(value)
  );
}

export function toTemplateKey(value: unknown): TemplateKey {
  return isTemplateKey(value) ? value : DEFAULT_TEMPLATE;
}

/**
 * How the thumbnail should be drawn from semantic tokens. The preview a user
 * scrutinises is the real rendered email in an iframe; this only has to make
 * all fourteen distinguishable at a glance.
 */
export type TemplateSketch = {
  /** Full-bleed bar, a hairline rule, or nothing above the title. */
  header: "bar" | "rule" | "plain";
  /** Inverted means a dark body on a light screen, and the reverse. */
  inverted: boolean;
  /** Which role paints the accent furniture in the sketch. */
  emphasis: "accent" | "neutral" | "caution";
  /** Body line count in the sketch — an executive brief is visibly shorter. */
  lines: number;
};

/** The six literal colours a thumbnail needs. See the file docblock. */
export type TemplateSwatch = {
  ground: string;
  ink: string;
  headerBg: string;
  headerInk: string;
  accent: string;
  ctaBg: string;
};

export type TemplateMeta = {
  key: TemplateKey;
  name: string;
  /** One line. What this template is for, not what it looks like. */
  useCase: string;
  mode: "light" | "dark";
  sketch: TemplateSketch;
  swatch: TemplateSwatch;
};

export const TEMPLATES: readonly TemplateMeta[] = [
  {
    key: "convin-premium",
    name: "Convin Premium",
    useCase: "The default monthly report — brand bar, full body, gold call to action.",
    mode: "light",
    sketch: { header: "bar", inverted: false, emphasis: "accent", lines: 5 },
    swatch: { ground: "#F7F6F4", ink: "#0B0B0B", headerBg: "#0B0B0B", headerInk: "#F7F6F4", accent: "#835C30", ctaBg: "#A5763D" },
  },
  {
    key: "convin-signature",
    name: "Convin Signature",
    useCase: "Long-standing accounts who read every word — quieter, rule instead of bar.",
    mode: "light",
    sketch: { header: "rule", inverted: false, emphasis: "accent", lines: 6 },
    swatch: { ground: "#FFFFFF", ink: "#0B0B0B", headerBg: "#FFFFFF", headerInk: "#0B0B0B", accent: "#835C30", ctaBg: "#0B0B0B" },
  },
  {
    key: "convin-dark",
    name: "Convin Dark",
    useCase: "Dashboards and telemetry reviews, where charts are read on a dark ground.",
    mode: "dark",
    sketch: { header: "bar", inverted: true, emphasis: "accent", lines: 5 },
    swatch: { ground: "#171615", ink: "#F7F6F4", headerBg: "#0B0B0B", headerInk: "#F7F6F4", accent: "#E3C089", ctaBg: "#E3C089" },
  },
  {
    key: "convin-light",
    name: "Convin Light",
    useCase: "Editorial write-ups — no accent at all, hierarchy carried by type weight.",
    mode: "light",
    sketch: { header: "plain", inverted: false, emphasis: "neutral", lines: 7 },
    swatch: { ground: "#FFFFFF", ink: "#0B0B0B", headerBg: "#FFFFFF", headerInk: "#0B0B0B", accent: "#0B0B0B", ctaBg: "#0B0B0B" },
  },
  {
    key: "executive-brief",
    name: "Executive brief",
    useCase: "One screen for a CXO — headline, three lines, one link, nothing else.",
    mode: "light",
    sketch: { header: "rule", inverted: false, emphasis: "neutral", lines: 3 },
    swatch: { ground: "#FFFDF8", ink: "#3A2916", headerBg: "#FFFDF8", headerInk: "#3A2916", accent: "#835C30", ctaBg: "#835C30" },
  },
  {
    key: "alert",
    name: "Alert",
    useCase: "Breach of an agreed threshold. Never gold — an alert is not a celebration.",
    mode: "light",
    sketch: { header: "bar", inverted: false, emphasis: "caution", lines: 4 },
    swatch: { ground: "#F7F6F4", ink: "#0B0B0B", headerBg: "#D70015", headerInk: "#FFFFFF", accent: "#D70015", ctaBg: "#0B0B0B" },
  },
  {
    key: "convin-bold",
    name: "Convin Bold",
    useCase: "High-contrast and confident — launches, wins, anything that should read as good news first.",
    mode: "light",
    sketch: { header: "bar", inverted: false, emphasis: "accent", lines: 5 },
    swatch: { ground: "#FFFFFF", ink: "#0B0B0B", headerBg: "#0B3D91", headerInk: "#FFFFFF", accent: "#1E63C9", ctaBg: "#1E63C9" },
  },
  {
    key: "convin-pro",
    name: "Convin Pro",
    useCase: "A deep, premium finish for board-level and executive-facing sends.",
    mode: "dark",
    sketch: { header: "bar", inverted: true, emphasis: "accent", lines: 5 },
    swatch: { ground: "#12172A", ink: "#F5F7FA", headerBg: "#0A0E1A", headerInk: "#F5F7FA", accent: "#3D5AFE", ctaBg: "#3D5AFE" },
  },
  {
    key: "classic",
    name: "Classic",
    useCase: "Warm, serif, unhurried — for relationship-first accounts who read every word.",
    mode: "light",
    sketch: { header: "rule", inverted: false, emphasis: "neutral", lines: 6 },
    swatch: { ground: "#FFFCF5", ink: "#3B2F22", headerBg: "#FFFCF5", headerInk: "#3B2F22", accent: "#9C7B4F", ctaBg: "#6B4E2E" },
  },
  {
    key: "neon",
    name: "Neon",
    useCase: "High-contrast cyan on black — for product and growth teams who live in dashboards.",
    mode: "dark",
    sketch: { header: "bar", inverted: true, emphasis: "accent", lines: 5 },
    swatch: { ground: "#0D1214", ink: "#E8FFFC", headerBg: "#050708", headerInk: "#E8FFFC", accent: "#00E5D4", ctaBg: "#00E5D4" },
  },
  {
    key: "sunrise",
    name: "Sunrise",
    useCase: "Warm and energetic — for wins, milestones, and good-news updates.",
    mode: "light",
    sketch: { header: "bar", inverted: false, emphasis: "accent", lines: 5 },
    swatch: { ground: "#FFFDFB", ink: "#3A2413", headerBg: "#FF7A30", headerInk: "#FFFFFF", accent: "#E85D04", ctaBg: "#E85D04" },
  },
  {
    key: "forest",
    name: "Forest",
    useCase: "Calm, deep green — for sustainability, wellness and long-term partnership reports.",
    mode: "light",
    sketch: { header: "bar", inverted: false, emphasis: "accent", lines: 5 },
    swatch: { ground: "#FBFDFA", ink: "#14251B", headerBg: "#1B4332", headerInk: "#F1F8F3", accent: "#2D6A4F", ctaBg: "#2D6A4F" },
  },
  {
    key: "carbon",
    name: "Carbon",
    useCase: "Understated charcoal — for internal-facing and technical audiences.",
    mode: "dark",
    sketch: { header: "plain", inverted: true, emphasis: "neutral", lines: 6 },
    swatch: { ground: "#1B1B1B", ink: "#F2F2F2", headerBg: "#1B1B1B", headerInk: "#F2F2F2", accent: "#8C8C8C", ctaBg: "#3A3A3A" },
  },
  {
    key: "convin-slate",
    name: "Convin Slate",
    useCase: "Cool, neutral grey — a quieter alternative to Convin Light with a touch more structure.",
    mode: "light",
    sketch: { header: "plain", inverted: false, emphasis: "neutral", lines: 6 },
    swatch: { ground: "#FFFFFF", ink: "#263238", headerBg: "#FFFFFF", headerInk: "#263238", accent: "#546E7A", ctaBg: "#37474F" },
  },
] as const;

export function templateMeta(key: TemplateKey): TemplateMeta {
  return TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[0];
}
