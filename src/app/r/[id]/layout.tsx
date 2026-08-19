import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The public hosted report shell — outside the application shell, no
 * navigation, no session, same reasoning as `/f/[token]`'s layout. Wider than
 * the feedback page's 560px: this holds real tables, not a star rating.
 */

export const metadata: Metadata = {
  title: "Call audit report · Convin Data Labs",
  robots: { index: false, follow: false },
};

export default function PublicReportLayout({ children }: { children: ReactNode }) {
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
      <a href="#report-main" className="sr-only">
        Skip to the report
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
        <span aria-hidden="true" style={{ width: "10px", height: "10px", borderRadius: "var(--radius-capsule)", background: "var(--fill-accent-solid)" }} />
        <span className="t-overline" style={{ color: "var(--content-tertiary)" }}>
          Convin Data Labs
        </span>
      </header>

      <main id="report-main" style={{ flex: 1, width: "100%", maxWidth: "880px", margin: "0 auto", padding: "var(--space-4) var(--space-4) var(--space-12)" }}>
        {children}
      </main>

      <footer style={{ padding: "0 var(--space-4) var(--space-8)", textAlign: "center" }}>
        <p className="t-caption" style={{ margin: 0, color: "var(--content-tertiary)" }}>
          Convin Data Labs · Bengaluru
        </p>
      </footer>
    </div>
  );
}
