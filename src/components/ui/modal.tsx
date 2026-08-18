"use client";

/**
 * Sheet and Alert.
 *
 * Sheet is the working surface: a centered, fully opaque card — radius-xl,
 * e5. It used to slide in from an edge dressed in glass, which reads fine
 * for a single chrome layer like the top bar but breaks the moment a second
 * surface (another glass layer, a dense table underneath) shows through it:
 * two blurred, near-transparent layers stacked on a phone-width viewport
 * compost into exactly the illegible double-exposure a form should never be
 * read through. A dialog holding real input is read, not glimpsed — it gets
 * the same opaque `--surface-raised` Alert already used.
 *
 * Alert is the stop. Two actions at most — the shape of the props makes a third
 * impossible. The title is a question, the body states the consequence in
 * numbers, the safe action sits on the LEFT where the thumb rests, and a
 * destructive action never wears the metal.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Enter : exit is roughly 2 : 1 — leaving is always faster than arriving. */
function usePresence(open: boolean, exitMs = 240) {
  const [present, setPresent] = React.useState(open);
  const [entered, setEntered] = React.useState(false);

  // Adjusted during render, not in an effect: the panel has to exist in the
  // same commit that starts its entrance, and it has to begin leaving in the
  // same commit the caller closes it. Both are prop-driven, not side effects.
  if (open && !present) setPresent(true);
  if (!open && entered) setEntered(false);

  React.useEffect(() => {
    if (!open) {
      const timer = window.setTimeout(() => setPresent(false), exitMs);
      return () => window.clearTimeout(timer);
    }
    // The next frame flips the flag, so the transition has a "from" to leave.
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [open, exitMs]);

  return { present, entered };
}

function useModalBehaviour(
  open: boolean,
  panelRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
) {
  React.useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (firstFocusable ?? panel)?.focus();

    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null,
      );
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = bodyOverflow;
      previouslyFocused?.focus();
    };
  }, [open, panelRef, onClose]);
}

const subscribeToNothing = () => () => {};

/** Hydration-safe "are we on the client yet", with no setState in an effect. */
function useMounted(): boolean {
  return React.useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

function Portal({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  if (!mounted) return null;
  return createPortal(children, document.body);
}

function Scrim({ entered, onClick }: { entered: boolean; onClick: () => void }) {
  return (
    <div
      aria-hidden="true"
      onClick={onClick}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--surface-scrim)",
        opacity: entered ? 1 : 0,
        transition: entered
          ? "opacity var(--dur-enter) var(--ease-enter)"
          : "opacity var(--dur-exit) var(--ease-exit)",
      }}
    />
  );
}

/* ── Sheet ────────────────────────────────────────────────────────────────── */

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** A steady line under the title. */
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Actions live at the foot, out of the scroll. */
  footer?: React.ReactNode;
  className?: string;
};

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: SheetProps) {
  const { present, entered } = usePresence(open);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const titleId = React.useId();
  useModalBehaviour(open, panelRef, onClose);

  if (!present) return null;

  return (
    <Portal>
      <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
        <Scrim entered={entered} onClick={onClose} />
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: "var(--space-5)",
            pointerEvents: "none",
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={cn("flex flex-col", className)}
            style={{
              pointerEvents: "auto",
              width: "min(560px, calc(100vw - 2 * var(--space-5)))",
              maxHeight: "min(85vh, 760px)",
              background: "var(--surface-raised)",
              border: "1px solid var(--stroke-rim)",
              borderRadius: "var(--radius-xl)",
              boxShadow: "var(--e5)",
              color: "var(--content-primary)",
              opacity: entered ? 1 : 0,
              transform: entered ? "scale(1)" : "scale(0.96)",
              transition: entered
                ? "opacity var(--dur-enter) var(--ease-enter), transform var(--dur-enter) var(--ease-enter)"
                : "opacity var(--dur-exit) var(--ease-exit), transform var(--dur-exit) var(--ease-exit)",
            }}
          >
            <div
              className="flex items-start justify-between"
              style={{
                gap: "var(--space-4)",
                padding: "var(--space-4) var(--space-5) var(--space-3)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <h2
                  id={titleId}
                  className="t-title-3"
                  style={{ margin: 0, color: "var(--content-primary)" }}
                >
                  {title}
                </h2>
                {description ? (
                  <p
                    className="t-footnote"
                    style={{
                      margin: "var(--space-1) 0 0",
                      color: "var(--content-secondary)",
                    }}
                  >
                    {description}
                  </p>
                ) : null}
              </div>
              <Button
                size="s"
                variant="plain"
                leadingIcon={X}
                aria-label="Close"
                onClick={onClose}
              />
            </div>

            <div
              style={{
                overflow: "auto",
                padding: "0 var(--space-5) var(--space-5)",
                flex: "1 1 auto",
              }}
            >
              {children}
            </div>

            {footer ? (
              <div
                className="flex flex-wrap items-center justify-end"
                style={{
                  gap: "var(--space-3)",
                  padding: "var(--space-4) var(--space-5)",
                  borderTop: "1px solid var(--stroke-hairline)",
                }}
              >
                {footer}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Portal>
  );
}

/* ── Alert ────────────────────────────────────────────────────────────────── */

export type AlertAction = {
  /** A verb the user would say aloud. */
  label: string;
  onClick: () => void;
  loading?: boolean;
};

export type AlertProps = {
  open: boolean;
  onClose: () => void;
  /** A question — "Delete 3 campaigns?" */
  title: string;
  /** The consequence, stated in numbers. */
  body: React.ReactNode;
  /** The safe way out. Rendered on the LEFT and focused first. */
  safeAction: AlertAction;
  /** At most one more. Never metal — gold is not for consequences you regret. */
  dangerAction?: AlertAction & { destructive?: boolean };
};

export function Alert({
  open,
  onClose,
  title,
  body,
  safeAction,
  dangerAction,
}: AlertProps) {
  const { present, entered } = usePresence(open);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const titleId = React.useId();
  const bodyId = React.useId();
  useModalBehaviour(open, panelRef, onClose);

  if (!present) return null;

  return (
    <Portal>
      <div style={{ position: "fixed", inset: 0, zIndex: 70 }}>
        <Scrim entered={entered} onClick={onClose} />
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: "var(--space-5)",
            pointerEvents: "none",
          }}
        >
          <div
            ref={panelRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            tabIndex={-1}
            style={{
              pointerEvents: "auto",
              width: "min(420px, calc(100vw - 2 * var(--space-5)))",
              padding: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
              background: "var(--surface-raised)",
              border: "1px solid var(--stroke-rim)",
              borderRadius: "var(--radius-xl)",
              boxShadow: "var(--e5)",
              color: "var(--content-primary)",
              opacity: entered ? 1 : 0,
              transform: entered ? "scale(1)" : "scale(0.96)",
              transition: entered
                ? "opacity var(--dur-enter) var(--ease-enter), transform var(--dur-enter) var(--ease-enter)"
                : "opacity var(--dur-exit) var(--ease-exit), transform var(--dur-exit) var(--ease-exit)",
            }}
          >
            <h2
              id={titleId}
              className="t-title-3"
              style={{ margin: 0, color: "var(--content-primary)" }}
            >
              {title}
            </h2>
            <div
              id={bodyId}
              className="t-subhead"
              style={{ color: "var(--content-secondary)" }}
            >
              {body}
            </div>

            <div
              className="flex flex-wrap items-center"
              style={{ gap: "var(--space-3)", marginTop: "var(--space-2)" }}
            >
              {/* Safe on the left. Always. */}
              <Button
                size="m"
                variant="glass"
                loading={safeAction.loading}
                onClick={safeAction.onClick}
              >
                {safeAction.label}
              </Button>
              {dangerAction ? (
                <Button
                  size="m"
                  variant={dangerAction.destructive === false ? "solid" : "destruct"}
                  loading={dangerAction.loading}
                  onClick={dangerAction.onClick}
                >
                  {dangerAction.label}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
