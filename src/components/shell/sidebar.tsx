"use client";

/**
 * The rail.
 *
 * 240 pt on the canvas with a hairline against the working surface, so the
 * navigation is a different plane from the content rather than a panel floating
 * on it. Collapsed it keeps the icons at 72 pt; below 834 pt it leaves the page
 * and is presented as a drawer by the shell.
 *
 * The active row is a 3 pt accent bar and a quiet fill. Colour alone never
 * carries state — `aria-current="page"` says it in words.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Avatar, Pill, Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { NAV_ITEMS, roleLabel, type ShellProfile } from "./nav";

export const RAIL_WIDTH = 240;
export const RAIL_WIDTH_COLLAPSED = 72;

function SignOut({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onSignOut() {
    if (pending) return;
    setPending(true);
    try {
      await createClient().auth.signOut();
    } catch {
      // The cookie may already be gone. Either way the destination is the same.
    }
    router.replace("/signin");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void onSignOut()}
      aria-label="Sign out"
      title="Sign out"
      aria-busy={pending || undefined}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: "var(--space-3)",
        width: "100%",
        minHeight: "44px",
        padding: `var(--space-2) ${collapsed ? "0" : "var(--space-3)"}`,
        borderRadius: "var(--radius-capsule)",
        background: "transparent",
        border: 0,
        color: "var(--content-secondary)",
        font: "var(--t-subhead)",
        letterSpacing: "var(--tr-subhead)",
        cursor: pending ? "progress" : "pointer",
        textAlign: "left",
      }}
    >
      {pending ? (
        <Spinner size={16} />
      ) : (
        <LogOut size={16} strokeWidth={1.75} aria-hidden="true" style={{ flex: "none" }} />
      )}
      {collapsed ? null : <span>Sign out</span>}
    </button>
  );
}

export type SidebarProps = {
  profile: ShellProfile;
  collapsed?: boolean;
  /** Fired after a destination is chosen — the drawer closes on it. */
  onNavigate?: () => void;
  /** Rendered at the top of the rail inside the drawer: the close control. */
  leading?: React.ReactNode;
};

export function Sidebar({
  profile,
  collapsed = false,
  onNavigate,
  leading,
}: SidebarProps) {
  const pathname = usePathname();
  const width = collapsed ? RAIL_WIDTH_COLLAPSED : RAIL_WIDTH;
  const name = profile.full_name.trim() || profile.email;

  return (
    <div
      style={{
        width: `${width}px`,
        flex: "none",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        background: "var(--surface-canvas)",
        borderRight: "1px solid var(--stroke-hairline)",
        transition: "width var(--dur-glide) var(--ease-glide)",
      }}
    >
      {/* ── Mark ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: "var(--space-3)",
          height: "64px",
          flex: "none",
          paddingInline: collapsed ? "var(--space-2)" : "var(--space-5)",
        }}
      >
        <Link
          href="/overview"
          onClick={onNavigate}
          aria-label="Convin Data Labs — go to Overview"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            minHeight: "44px",
            textDecoration: "none",
            color: "var(--content-primary)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "grid",
              placeItems: "center",
              width: "28px",
              height: "28px",
              flex: "none",
              borderRadius: "calc(var(--radius-sm) - var(--space-1))",
              background: "var(--fill-quiet)",
              border: "1px solid var(--stroke-rim)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M11.2 3.6A5 5 0 1 0 11.2 10.4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
          {collapsed ? null : (
            <span
              className="t-headline"
              style={{ whiteSpace: "nowrap", letterSpacing: "var(--tr-headline)" }}
            >
              Convin Data Labs
            </span>
          )}
        </Link>
        {collapsed ? null : leading}
      </div>

      {/* ── Destinations ──────────────────────────────────────────────────── */}
      <nav
        aria-label="Primary"
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          padding: `var(--space-2) ${collapsed ? "var(--space-2)" : "var(--space-3)"}`,
        }}
      >
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-1)",
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? `${item.label} — ${item.hint}` : undefined}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: collapsed ? "center" : "flex-start",
                    gap: "var(--space-3)",
                    minHeight: "44px",
                    paddingInline: collapsed ? 0 : "var(--space-4)",
                    borderRadius: "var(--radius-capsule)",
                    background: active ? "var(--fill-quiet)" : "transparent",
                    color: active
                      ? "var(--content-primary)"
                      : "var(--content-secondary)",
                    font: "var(--t-subhead)",
                    fontWeight: active ? 600 : 400,
                    letterSpacing: "var(--tr-subhead)",
                    textDecoration: "none",
                    transition:
                      "background-color var(--dur-glide) var(--ease-glide), color var(--dur-glide) var(--ease-glide)",
                  }}
                >
                  {/* The 3 pt bar. Rounded so it belongs to the capsule. */}
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: collapsed ? "2px" : "0",
                      top: "50%",
                      width: "3px",
                      height: active ? "20px" : "0px",
                      transform: "translateY(-50%)",
                      borderRadius: "var(--radius-capsule)",
                      background: "var(--content-accent)",
                      transition: "height var(--dur-snap) var(--ease-snap)",
                    }}
                  />
                  <Icon
                    size={18}
                    strokeWidth={active ? 2 : 1.75}
                    aria-hidden="true"
                    style={{ flex: "none" }}
                  />
                  {collapsed ? (
                    <span className="sr-only">{item.label}</span>
                  ) : (
                    <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Who is signed in ──────────────────────────────────────────────── */}
      <div
        style={{
          flex: "none",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
          padding: collapsed ? "var(--space-3) var(--space-2)" : "var(--space-3)",
          borderTop: "1px solid var(--stroke-hairline)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: "var(--space-3)",
            minHeight: "44px",
            paddingInline: collapsed ? 0 : "var(--space-2)",
            minWidth: 0,
          }}
        >
          <Avatar name={name} size={32} />
          {collapsed ? null : (
            <span style={{ minWidth: 0, display: "block" }}>
              <span
                className="t-subhead"
                style={{
                  display: "block",
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {name}
              </span>
              <Pill tone="neutral" style={{ marginTop: "2px" }}>
                {roleLabel(profile.role)}
              </Pill>
            </span>
          )}
        </div>
        <SignOut collapsed={collapsed} />
      </div>
    </div>
  );
}
