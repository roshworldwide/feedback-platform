"use client";

/**
 * The finish, applied while the HTML is still parsing.
 *
 * `themeBootstrapScript` lives in a "use client" module, so a Server Component
 * cannot read it as a string — its exports become client references. This thin
 * client component is the bridge: it still server-renders into the streamed
 * HTML, so the browser executes it in `<head>` before the first paint.
 *
 * On a soft navigation the root layout does not re-render and the script would
 * not execute anyway, so it is emitted as `text/plain` on the client. The
 * ThemeProvider owns the finish from hydration onwards.
 */

import { themeBootstrapScript } from "@/lib/theme";

export function ThemeScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
    />
  );
}
