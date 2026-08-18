import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/lib/theme";
import { ToastProvider } from "@/components/ui";
import { ThemeScript } from "@/components/shell/theme-script";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Convin Data Labs",
    template: "%s · Convin Data Labs",
  },
  description:
    "Report delivery and client feedback for Convin Data Labs — campaigns, engagement and satisfaction in one instrument.",
};

/**
 * The two literal hexes below are Obsidian and Titanium White, and they are the
 * one place in the app outside the token layer where a hex is correct: browser
 * chrome resolves `themeColor` before any stylesheet loads, so a CSS variable
 * would evaluate to nothing. Keep them in step with `--ti-100` / `--ti-00`.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B0B0B" },
    { media: "(prefers-color-scheme: light)", color: "#F7F6F4" },
  ],
};

/**
 * The root layout carries the token layer and nothing else.
 *
 * `data-finish` is set here so the very first byte of HTML already has a
 * finish, and `ThemeScript` corrects it to the persisted or OS-preferred one
 * while the browser is still parsing `<head>`. Without that there is a flash of
 * the wrong theme — the most visible failure a token layer can have.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-finish="black-titanium" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <a href="#main" className="sr-only">
          Skip to main content
        </a>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
