"use client";

/**
 * The top bar — an island, not a strip.
 *
 * 64 pt, glass, floating clear of every edge with a full capsule radius, so it
 * reads as one object resting a few points above the canvas rather than a bar
 * welded to the top of the screen. It holds still until something gives it a
 * reason to move: the whole shape answers a search focus with a small snap
 * forward, the same "something is happening in here" gesture a live island
 * makes when it has news.
 *
 * The single breathing dot beside the wordmark is the one animation on this
 * screen allowed to loop forever — it says the data behind this whole shell is
 * live, once, and never competes with the metal for attention. "New campaign"
 * stays the one Aurum element on every application screen; nothing else here
 * may be metal, and the dot is titanium/signal, not gold.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, Menu, Plus } from "lucide-react";
import { Button, DarkModeToggle, SearchInput } from "@/components/ui";
import { trailFor } from "./nav";

export type TopBarProps = {
  /** Rendered only while the rail is a drawer. */
  onOpenNav?: () => void;
  showNavButton?: boolean;
  /** Below 834 pt the search collapses out of the bar. */
  compact?: boolean;
};

export function TopBar({
  onOpenNav,
  showNavButton = false,
  compact = false,
}: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { crumbs, title } = trailFor(pathname);

  const [query, setQuery] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl-K puts the caret in the search field from anywhere.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function onSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    router.push(`/campaigns?q=${encodeURIComponent(term)}`);
  }

  return (
    <header
      className="glass"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-4)",
        height: "64px",
        flex: "none",
        paddingInline: "var(--space-6)",
        borderRadius: "var(--radius-capsule)",
        boxShadow: focused ? "var(--e5)" : "var(--e4)",
        transform: focused ? "scale(1.008)" : "scale(1)",
        transformOrigin: "center top",
        animation: "aurum-enter var(--dur-enter) var(--ease-enter) both",
        transition:
          "box-shadow var(--dur-glide) var(--ease-glide), transform var(--dur-snap) var(--ease-snap)",
      }}
    >
      {showNavButton ? (
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
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
          <Menu size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      ) : null}

      {/* ── Where you are ─────────────────────────────────────────────────── */}
      <div style={{ minWidth: 0, flex: "0 1 auto" }}>
        <nav aria-label="Breadcrumb">
          <ol
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              alignItems: "center",
              gap: "var(--space-1)",
            }}
          >
            <li
              aria-hidden="true"
              title="Live"
              style={{
                position: "relative",
                display: "grid",
                placeItems: "center",
                width: "8px",
                height: "8px",
                marginRight: "var(--space-1)",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "var(--radius-capsule)",
                  background: "var(--signal-nominal)",
                  animation: "aurum-breathe 2400ms var(--ease-standard) infinite",
                }}
              />
              <span
                style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "var(--radius-capsule)",
                  background: "var(--signal-nominal)",
                }}
              />
            </li>
            {crumbs.map((crumb, index) => (
              <li
                key={`${crumb.label}-${index}`}
                style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}
              >
                {index > 0 ? (
                  <ChevronRight
                    size={10}
                    strokeWidth={2}
                    aria-hidden="true"
                    style={{ color: "var(--content-quaternary)" }}
                  />
                ) : null}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="t-overline"
                    style={{ color: "var(--content-tertiary)", textDecoration: "none" }}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="t-overline" style={{ color: "var(--content-tertiary)" }}>
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <h1
          className="t-title-3"
          style={{
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </h1>
      </div>

      <div style={{ flex: "1 1 auto" }} />

      {/* ── What you do from anywhere ─────────────────────────────────────── */}
      {compact ? null : (
        <form
          role="search"
          onSubmit={onSearch}
          style={{ position: "relative", flex: "0 1 320px", minWidth: "180px" }}
        >
          <SearchInput
            ref={searchRef}
            value={query}
            onSearch={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label="Search campaigns, clients and people"
            placeholder="Search"
            style={{ paddingRight: query ? undefined : "var(--space-16)" }}
          />
          {query ? null : (
            <kbd
              aria-hidden="true"
              className="t-micro"
              style={{
                position: "absolute",
                right: "var(--space-3)",
                top: "50%",
                transform: "translateY(-50%)",
                padding: "2px var(--space-2)",
                borderRadius: "calc(var(--radius-sm) / 2)",
                background: "var(--fill-quiet)",
                border: "1px solid var(--stroke-hairline)",
                color: "var(--content-tertiary)",
                fontFamily: "var(--font-mono)",
                pointerEvents: "none",
              }}
            >
              ⌘K
            </kbd>
          )}
        </form>
      )}

      <DarkModeToggle />

      <Button
        as={Link}
        href="/compose"
        variant="metal"
        size="m"
        leadingIcon={Plus}
        style={{ flex: "none" }}
      >
        New campaign
      </Button>
    </header>
  );
}
