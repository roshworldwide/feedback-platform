"use client";

/**
 * The frame every application screen sits in.
 *
 * Three states, one skeleton:
 *   ≥ 1280   the rail at 240 pt with its labels
 *   834–1279 the rail at 72 pt, icons only
 *   < 834    no rail; a drawer over a scrim, opened from the top bar
 *
 * Nothing about the content changes across the three. The rail is the only
 * thing that moves.
 */

import * as React from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { RAIL_COLLAPSE, RAIL_DRAWER, useMediaQuery } from "./use-media-query";
import type { ShellProfile } from "./nav";

export type AppShellProps = {
  profile: ShellProfile;
  children: React.ReactNode;
};

export function AppShell({ profile, children }: AppShellProps) {
  const collapsed = useMediaQuery(RAIL_COLLAPSE);
  const drawer = useMediaQuery(RAIL_DRAWER);
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const closeRef = React.useRef<HTMLButtonElement>(null);

  // Two facts close the drawer: arriving somewhere is the end of navigating,
  // and a drawer that is not on screen cannot be open. Both are derived from
  // props rather than chased in an effect — adjusting during render closes it
  // in the same commit, where an effect would paint one frame with it still up.
  const [seen, setSeen] = React.useState({ pathname, drawer });
  if (seen.pathname !== pathname || seen.drawer !== drawer) {
    setSeen({ pathname, drawer });
    if (open) setOpen(false);
  }

  React.useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100dvh",
        background: "var(--surface-canvas)",
      }}
    >
      {drawer ? null : (
        <div
          style={{
            position: "sticky",
            top: 0,
            height: "100dvh",
            flex: "none",
            display: "flex",
          }}
        >
          <Sidebar profile={profile} collapsed={collapsed} />
        </div>
      )}

      <div
        style={{
          flex: "1 1 auto",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--surface-grouped)",
        }}
      >
        <TopBar
          showNavButton={drawer}
          compact={drawer}
          onOpenNav={() => setOpen(true)}
        />
        <main
          id="main"
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            padding: "var(--space-6)",
          }}
        >
          <div style={{ maxWidth: "var(--content-max)", marginInline: "auto" }}>
            {children}
          </div>
        </main>
      </div>

      {/* ── Drawer ────────────────────────────────────────────────────────── */}
      {drawer && open ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
          <button
            type="button"
            aria-label="Close navigation"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              padding: 0,
              border: 0,
              background: "var(--surface-scrim)",
              cursor: "pointer",
              animation: "aurum-fade var(--dur-enter) var(--ease-enter) both",
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            style={{
              position: "absolute",
              inset: "0 auto 0 0",
              boxShadow: "var(--e4)",
              animation: "aurum-fade var(--dur-enter) var(--ease-enter) both",
            }}
          >
            <Sidebar
              profile={profile}
              onNavigate={() => setOpen(false)}
              leading={
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close navigation"
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: "44px",
                    height: "44px",
                    flex: "none",
                    borderRadius: "var(--radius-capsule)",
                    background: "var(--fill-quiet)",
                    border: "1px solid var(--stroke-hairline)",
                    color: "var(--content-primary)",
                    cursor: "pointer",
                  }}
                >
                  <X size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
