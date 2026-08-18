"use client";

/**
 * Toast.
 *
 * A capsule that lives four seconds and carries one action. The stack holds
 * two; a third pushes out the oldest, because a queue of notices is a log, not
 * a notification. Anything that needs longer than four seconds or more than one
 * action is not a toast — it is a Sheet.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Spinner } from "./button";

export type ToastTone = "neutral" | "nominal" | "caution" | "abort";

export type ToastAction = { label: string; onClick: () => void };

export type ToastOptions = {
  /** Sentence case, one line, states what happened. */
  message: string;
  tone?: ToastTone;
  /** Exactly one, or none. */
  action?: ToastAction;
  /** Capped at 4000 ms — a toast that outstays its welcome is a banner. */
  duration?: number;
  /** Shows a spinner in place of the tone dot. */
  pending?: boolean;
};

type ToastRecord = ToastOptions & { id: string; entered: boolean };

const MAX_STACK = 2;
const MAX_LIFE = 4000;

const TONE_INK: Record<ToastTone, string> = {
  neutral: "var(--content-tertiary)",
  nominal: "var(--signal-nominal)",
  caution: "var(--signal-caution)",
  abort: "var(--signal-abort)",
};

type ToastContextValue = {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
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

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastRecord[]>([]);
  const mounted = useMounted();
  const timers = React.useRef(new Map<string, number>());

  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, entered: false } : item)),
    );
    const exit = window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
      timers.current.delete(`${id}:exit`);
    }, 240);
    timers.current.set(`${id}:exit`, exit);
  }, []);

  const toast = React.useCallback(
    (options: ToastOptions) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((current) => {
        // The stack holds two. The oldest leaves so the newest can be read.
        const kept = current.slice(Math.max(0, current.length - (MAX_STACK - 1)));
        return [...kept, { ...options, id, entered: false }];
      });

      requestAnimationFrame(() => {
        setItems((current) =>
          current.map((item) => (item.id === id ? { ...item, entered: true } : item)),
        );
      });

      if (!options.pending) {
        const life = Math.min(options.duration ?? MAX_LIFE, MAX_LIFE);
        const timer = window.setTimeout(() => dismiss(id), life);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({ toast, dismiss }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted
        ? createPortal(
            <div
              role="region"
              aria-label="Notifications"
              style={{
                position: "fixed",
                left: "50%",
                bottom: "var(--space-6)",
                transform: "translateX(-50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "var(--space-2)",
                zIndex: 80,
                pointerEvents: "none",
              }}
            >
              {items.map((item) => {
                const tone = item.tone ?? "neutral";
                return (
                  <div
                    key={item.id}
                    role={tone === "abort" ? "alert" : "status"}
                    aria-live={tone === "abort" ? "assertive" : "polite"}
                    className="glass"
                    style={{
                      pointerEvents: "auto",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      minHeight: "var(--cap-m-h)",
                      maxWidth: "min(480px, calc(100vw - var(--space-8)))",
                      padding: "var(--space-2) var(--space-2) var(--space-2) var(--space-4)",
                      borderRadius: "var(--radius-capsule)",
                      boxShadow: "var(--e4)",
                      color: "var(--content-primary)",
                      opacity: item.entered ? 1 : 0,
                      transform: item.entered
                        ? "translateY(0) scale(1)"
                        : "translateY(var(--space-3)) scale(0.98)",
                      transition: item.entered
                        ? "opacity var(--dur-enter) var(--ease-enter), transform var(--dur-enter) var(--ease-enter)"
                        : "opacity var(--dur-exit) var(--ease-exit), transform var(--dur-exit) var(--ease-exit)",
                    }}
                  >
                    {item.pending ? (
                      <span style={{ color: "var(--content-tertiary)", flex: "none" }}>
                        <Spinner size={16} />
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        style={{
                          width: "8px",
                          height: "8px",
                          flex: "none",
                          borderRadius: "var(--radius-capsule)",
                          background: TONE_INK[tone],
                        }}
                      />
                    )}

                    <span className="t-subhead" style={{ flex: "1 1 auto" }}>
                      {item.message}
                    </span>

                    {item.action ? (
                      <button
                        type="button"
                        onClick={() => {
                          item.action?.onClick();
                          dismiss(item.id);
                        }}
                        className="t-subhead relative"
                        style={{
                          flex: "none",
                          minHeight: "36px",
                          paddingInline: "var(--space-3)",
                          borderRadius: "var(--radius-capsule)",
                          background: "var(--fill-quiet)",
                          border: 0,
                          color: "var(--content-accent)",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: "50%",
                            height: "44px",
                            transform: "translateY(-50%)",
                          }}
                        />
                        {item.action.label}
                      </button>
                    ) : null}

                    <button
                      type="button"
                      aria-label="Dismiss"
                      onClick={() => dismiss(item.id)}
                      className="relative"
                      style={{
                        flex: "none",
                        width: "36px",
                        height: "36px",
                        display: "grid",
                        placeItems: "center",
                        borderRadius: "var(--radius-capsule)",
                        background: "transparent",
                        border: 0,
                        color: "var(--content-tertiary)",
                        cursor: "pointer",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          inset: "50% auto auto 50%",
                          width: "44px",
                          height: "44px",
                          transform: "translate(-50%, -50%)",
                        }}
                      />
                      <X size={16} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}
