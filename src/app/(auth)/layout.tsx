import type { ReactNode } from "react";

/**
 * The way in. Canvas, centred, nothing else on screen — no navigation to a
 * place you cannot yet go.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-6)",
        background: "var(--surface-canvas)",
      }}
    >
      <main id="main" style={{ width: "100%", maxWidth: "420px" }}>
        {children}
      </main>
    </div>
  );
}
