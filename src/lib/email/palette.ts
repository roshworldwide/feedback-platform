/**
 * The one place in the product where a hex is written.
 *
 * Email clients do not support CSS custom properties — Outlook strips them,
 * Gmail's clipper mangles them, and a `var()` that fails resolves to nothing
 * rather than to a default. So the AURUM token layer is resolved here, once, to
 * literal values, and the renderer inlines them on every element.
 *
 * Each value names the AURUM role it is standing in for. Change the token
 * layer and this file is the diff to make; nothing else in the app carries a
 * colour literal.
 */

import type { TemplateKey } from "./templates";

export type EmailPalette = {
  /** Behind the 600px card — the client's own reading surface. */
  pageBg: string;
  cardBg: string;
  headerBg: string;
  headerInk: string;
  headerRule: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
  hairline: string;
  accent: string;
  ctaBg: string;
  ctaInk: string;
  ctaShadowRule: string;
  quoteBg: string;
  footerBg: string;
  footerInk: string;
  linkInk: string;
  /** Stars are amber in every finish — a star is an object, not a signal. */
  starOn: string;
  starOff: string;
  /** Only Classic sets this — a serif finish. Every other template inherits FONT_STACK. */
  fontStack?: string;
};

/* AURUM ramp, resolved.
   ti-00 #F7F6F4 · ti-05 #EFEDEA · ti-10 #E3E0DB · ti-20 #CFCBC4 · ti-40 #98938A
   ti-50 #7C776E · ti-60 #615D56 · ti-70 #4A4741 · ti-80 #35322E · ti-90 #232120
   ti-95 #171615 · ti-100 #0B0B0B
   au-05 #FBF3E6 · au-30 #E3C089 · au-40 #D4A96A · au-50 #C08F4E · au-60 #A5763D
   au-70 #835C30 · au-90 #3A2916
   signal-caution-light #9A6D08 · signal-abort-light #D70015 · link-light #0064D2 */

const STAR_ON = "#F59E0B";

const PALETTES: Record<TemplateKey, EmailPalette> = {
  /* Natural Titanium with a Black Titanium header — the house style. */
  "convin-premium": {
    pageBg: "#EFEDEA",
    cardBg: "#F7F6F4",
    headerBg: "#0B0B0B",
    headerInk: "#F7F6F4",
    headerRule: "#C08F4E",
    ink: "#0B0B0B",
    inkMuted: "#4A4741",
    inkFaint: "#615D56",
    hairline: "#E3E0DB",
    accent: "#835C30",
    ctaBg: "#A5763D",
    ctaInk: "#F7F6F4",
    ctaShadowRule: "#835C30",
    quoteBg: "#FBF3E6",
    footerBg: "#EFEDEA",
    footerInk: "#615D56",
    linkInk: "#0064D2",
    starOn: STAR_ON,
    starOff: "#CFCBC4",
  },

  /* No bar. A single Aurum rule and a lot of air. */
  "convin-signature": {
    pageBg: "#F7F6F4",
    cardBg: "#FFFFFF",
    headerBg: "#FFFFFF",
    headerInk: "#0B0B0B",
    headerRule: "#C08F4E",
    ink: "#0B0B0B",
    inkMuted: "#4A4741",
    inkFaint: "#615D56",
    hairline: "#E3E0DB",
    accent: "#835C30",
    ctaBg: "#0B0B0B",
    ctaInk: "#F7F6F4",
    ctaShadowRule: "#35322E",
    quoteBg: "#EFEDEA",
    footerBg: "#F7F6F4",
    footerInk: "#615D56",
    linkInk: "#0064D2",
    starOn: STAR_ON,
    starOff: "#CFCBC4",
  },

  /* Black Titanium. Champagne is the accent — Aurum 50 on obsidian is too low. */
  "convin-dark": {
    pageBg: "#0B0B0B",
    cardBg: "#171615",
    headerBg: "#0B0B0B",
    headerInk: "#F7F6F4",
    headerRule: "#E3C089",
    ink: "#F7F6F4",
    inkMuted: "#CFCBC4",
    inkFaint: "#98938A",
    hairline: "#35322E",
    accent: "#E3C089",
    ctaBg: "#E3C089",
    ctaInk: "#0B0B0B",
    ctaShadowRule: "#D4A96A",
    quoteBg: "#232120",
    footerBg: "#0B0B0B",
    footerInk: "#98938A",
    linkInk: "#0A84FF",
    starOn: STAR_ON,
    starOff: "#615D56",
  },

  /* White Titanium. No accent at all — weight carries the hierarchy. */
  "convin-light": {
    pageBg: "#FFFFFF",
    cardBg: "#FFFFFF",
    headerBg: "#FFFFFF",
    headerInk: "#0B0B0B",
    headerRule: "#E3E0DB",
    ink: "#0B0B0B",
    inkMuted: "#4A4741",
    inkFaint: "#615D56",
    hairline: "#E3E0DB",
    accent: "#0B0B0B",
    ctaBg: "#0B0B0B",
    ctaInk: "#FFFFFF",
    ctaShadowRule: "#35322E",
    quoteBg: "#F7F6F4",
    footerBg: "#FFFFFF",
    footerInk: "#615D56",
    linkInk: "#0064D2",
    starOn: STAR_ON,
    starOff: "#CFCBC4",
  },

  /* Desert Gold, compressed. One screen, nothing below the fold. */
  "executive-brief": {
    pageBg: "#FBF3E6",
    cardBg: "#FFFDF8",
    headerBg: "#FFFDF8",
    headerInk: "#3A2916",
    headerRule: "#A5763D",
    ink: "#3A2916",
    inkMuted: "#5E4223",
    inkFaint: "#835C30",
    hairline: "#EED6AE",
    accent: "#835C30",
    ctaBg: "#835C30",
    ctaInk: "#FBF3E6",
    ctaShadowRule: "#5E4223",
    quoteBg: "#F6E7CE",
    footerBg: "#FBF3E6",
    footerInk: "#835C30",
    linkInk: "#0064D2",
    starOn: STAR_ON,
    starOff: "#EED6AE",
  },

  /* Gold is never permitted on an alert. The bar is the abort signal. */
  alert: {
    pageBg: "#EFEDEA",
    cardBg: "#F7F6F4",
    headerBg: "#D70015",
    headerInk: "#FFFFFF",
    headerRule: "#9A6D08",
    ink: "#0B0B0B",
    inkMuted: "#4A4741",
    inkFaint: "#615D56",
    hairline: "#E3E0DB",
    accent: "#D70015",
    ctaBg: "#0B0B0B",
    ctaInk: "#F7F6F4",
    ctaShadowRule: "#35322E",
    quoteBg: "#EFEDEA",
    footerBg: "#EFEDEA",
    footerInk: "#615D56",
    linkInk: "#0064D2",
    starOn: STAR_ON,
    starOff: "#CFCBC4",
  },

  /* Bold blue. Launches and wins — good news should read as good news first. */
  "convin-bold": {
    pageBg: "#EAF1FB",
    cardBg: "#FFFFFF",
    headerBg: "#0B3D91",
    headerInk: "#FFFFFF",
    headerRule: "#1E63C9",
    ink: "#0B0B0B",
    inkMuted: "#33475B",
    inkFaint: "#5B7083",
    hairline: "#D7E3F3",
    accent: "#1E63C9",
    ctaBg: "#1E63C9",
    ctaInk: "#FFFFFF",
    ctaShadowRule: "#123E82",
    quoteBg: "#EAF1FB",
    footerBg: "#EAF1FB",
    footerInk: "#5B7083",
    linkInk: "#0064D2",
    starOn: STAR_ON,
    starOff: "#C7D6EA",
  },

  /* Deep navy — the closest a table-based email gets to a gradient header. */
  "convin-pro": {
    pageBg: "#0A0E1A",
    cardBg: "#12172A",
    headerBg: "#0A0E1A",
    headerInk: "#F5F7FA",
    headerRule: "#3D5AFE",
    ink: "#F5F7FA",
    inkMuted: "#C6CCDA",
    inkFaint: "#8891A8",
    hairline: "#26304A",
    accent: "#3D5AFE",
    ctaBg: "#3D5AFE",
    ctaInk: "#FFFFFF",
    ctaShadowRule: "#2A3ECF",
    quoteBg: "#171D33",
    footerBg: "#0A0E1A",
    footerInk: "#8891A8",
    linkInk: "#6D8DFF",
    starOn: STAR_ON,
    starOff: "#3A4260",
  },

  /* Warm cream and serif. The one template that overrides FONT_STACK. */
  classic: {
    pageBg: "#F6F0E4",
    cardBg: "#FFFCF5",
    headerBg: "#FFFCF5",
    headerInk: "#3B2F22",
    headerRule: "#9C7B4F",
    ink: "#3B2F22",
    inkMuted: "#5C4A34",
    inkFaint: "#7A6647",
    hairline: "#E7DBC3",
    accent: "#9C7B4F",
    ctaBg: "#6B4E2E",
    ctaInk: "#FFFCF5",
    ctaShadowRule: "#4E3A22",
    quoteBg: "#F0E5D0",
    footerBg: "#F6F0E4",
    footerInk: "#7A6647",
    linkInk: "#0064D2",
    starOn: STAR_ON,
    starOff: "#DCCBA6",
    fontStack: "Georgia, 'Times New Roman', Times, serif",
  },

  /* Cyan glow on near-black. For teams who live in dashboards. */
  neon: {
    pageBg: "#050708",
    cardBg: "#0D1214",
    headerBg: "#050708",
    headerInk: "#E8FFFC",
    headerRule: "#00E5D4",
    ink: "#E8FFFC",
    inkMuted: "#9FDAD3",
    inkFaint: "#5E8B86",
    hairline: "#17302E",
    accent: "#00E5D4",
    ctaBg: "#00E5D4",
    ctaInk: "#04211E",
    ctaShadowRule: "#00B6A9",
    quoteBg: "#0F1E1C",
    footerBg: "#050708",
    footerInk: "#5E8B86",
    linkInk: "#33F5E4",
    starOn: STAR_ON,
    starOff: "#1B3D3A",
  },

  /* Warm orange. Milestones and good news. */
  sunrise: {
    pageBg: "#FFF3E8",
    cardBg: "#FFFDFB",
    headerBg: "#FF7A30",
    headerInk: "#FFFFFF",
    headerRule: "#FFB25E",
    ink: "#3A2413",
    inkMuted: "#6B4526",
    inkFaint: "#8E6440",
    hairline: "#FBDCC0",
    accent: "#E85D04",
    ctaBg: "#E85D04",
    ctaInk: "#FFFFFF",
    ctaShadowRule: "#B84703",
    quoteBg: "#FFE9D4",
    footerBg: "#FFF3E8",
    footerInk: "#8E6440",
    linkInk: "#0064D2",
    starOn: STAR_ON,
    starOff: "#F3CFA9",
  },

  /* Deep green. Sustainability and long-term partnership reports. */
  forest: {
    pageBg: "#EEF3EC",
    cardBg: "#FBFDFA",
    headerBg: "#1B4332",
    headerInk: "#F1F8F3",
    headerRule: "#52A377",
    ink: "#14251B",
    inkMuted: "#2D4A38",
    inkFaint: "#4C6E58",
    hairline: "#D7E6DC",
    accent: "#2D6A4F",
    ctaBg: "#2D6A4F",
    ctaInk: "#F1F8F3",
    ctaShadowRule: "#1B4332",
    quoteBg: "#E4EFE7",
    footerBg: "#EEF3EC",
    footerInk: "#4C6E58",
    linkInk: "#0064D2",
    starOn: STAR_ON,
    starOff: "#C7DBCD",
  },

  /* Charcoal, monochrome. Internal-facing and technical audiences. */
  carbon: {
    pageBg: "#121212",
    cardBg: "#1B1B1B",
    headerBg: "#1B1B1B",
    headerInk: "#F2F2F2",
    headerRule: "#565656",
    ink: "#F2F2F2",
    inkMuted: "#C2C2C2",
    inkFaint: "#8C8C8C",
    hairline: "#2E2E2E",
    accent: "#8C8C8C",
    ctaBg: "#3A3A3A",
    ctaInk: "#F2F2F2",
    ctaShadowRule: "#202020",
    quoteBg: "#212121",
    footerBg: "#121212",
    footerInk: "#8C8C8C",
    linkInk: "#7FB2FF",
    starOn: STAR_ON,
    starOff: "#3A3A3A",
  },

  /* Slate grey. A quieter, cooler alternative to Convin Light. */
  "convin-slate": {
    pageBg: "#EEF1F3",
    cardBg: "#FFFFFF",
    headerBg: "#FFFFFF",
    headerInk: "#263238",
    headerRule: "#90A4AE",
    ink: "#263238",
    inkMuted: "#46545C",
    inkFaint: "#607D8B",
    hairline: "#DDE4E8",
    accent: "#546E7A",
    ctaBg: "#37474F",
    ctaInk: "#FFFFFF",
    ctaShadowRule: "#263238",
    quoteBg: "#E4EAED",
    footerBg: "#EEF1F3",
    footerInk: "#607D8B",
    linkInk: "#0064D2",
    starOn: STAR_ON,
    starOff: "#C7D2D7",
  },
};

export function paletteFor(key: TemplateKey): EmailPalette {
  return PALETTES[key] ?? PALETTES["convin-premium"];
}

/** Email-safe stacks. No webfont — a blocked font is a broken layout. */
export const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export const FONT_STACK_MONO =
  "'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
