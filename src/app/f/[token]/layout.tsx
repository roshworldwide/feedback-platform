import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The public feedback shell.
 *
 * Deliberately outside the application shell: there is no navigation, no
 * session and nothing to sign into. The finish is pinned to Natural Titanium —
 * this page is read once, on a phone, in daylight, by someone who has just come
 * out of an email client, and a dark surface arriving unannounced reads as a
 * different company.
 *
 * `data-finish` on the wrapper is enough: the token layer is scoped by
 * attribute, so every AURUM role inside resolves without a line of JavaScript
 * and without a flash of the wrong theme.
 */

export const metadata: Metadata = {
  title: "Your feedback · Convin Data Labs",
  description: "Rate the report you were sent.",
  robots: { index: false, follow: false },
};

export default function PublicFeedbackLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-finish="natural-titanium"
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-grouped)",
        color: "var(--content-primary)",
        fontFamily: "var(--font-text)",
      }}
    >
      <a href="#feedback-main" className="sr-only">
        Skip to the rating
      </a>

      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-2)",
          padding: "var(--space-6) var(--space-4) var(--space-2)",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "var(--radius-capsule)",
            background: "var(--fill-accent-solid)",
          }}
        />
        <span
          className="t-overline"
          style={{ color: "var(--content-tertiary)" }}
        >
          Convin Data Labs
        </span>
      </header>

      <main
        id="feedback-main"
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "560px",
          margin: "0 auto",
          padding: "var(--space-4) var(--space-4) var(--space-12)",
        }}
      >
        {children}
      </main>

      <footer
        style={{
          padding: "0 var(--space-4) var(--space-8)",
          textAlign: "center",
        }}
      >
        <p
          className="t-caption"
          style={{ margin: 0, color: "var(--content-tertiary)" }}
        >
          Convin Data Labs · Bengaluru · Your rating is seen only by the analyst
          who wrote the report and their team lead.
        </p>
      </footer>
    </div>
  );
}
