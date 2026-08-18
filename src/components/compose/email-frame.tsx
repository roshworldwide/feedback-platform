"use client";

/**
 * A rendered email, in a device frame.
 *
 * The document inside is the output of `renderReportEmail` — the same function
 * the sender calls, reached through a server action. There is no second
 * renderer and no approximation: what is behind this glass is the bytes a
 * recipient receives, minus their own name and their own tracking token.
 *
 * The frame grows to fit the real height of what's inside it, measured after
 * load, rather than a fixed guess — a preview that silently truncates a tall
 * report (an image, a long body, the scoreboard) behind `overflow: hidden`
 * with no visible way to reach the rest is not a preview of the email, it's a
 * preview of the first screenful of it. Only a genuinely extreme document
 * hits the ceiling below, and that one scrolls rather than vanishing.
 *
 * `allow-same-origin` is the one sandbox token granted — it's what lets this
 * component read the document's own height back. `allow-scripts` stays off,
 * so nothing inside can run regardless; the content is our own renderer's
 * escaped output, never arbitrary third-party HTML.
 */

import * as React from "react";

export type EmailFrameProps = {
  html: string;
  /** The viewport width to render at — 600 for desktop, 375 for a phone. */
  width: number;
  /** The starting height, shown until the real content height is measured. */
  height?: number;
  /** Shrinks the whole frame to fit the column it sits in. */
  scale?: number;
  /** Announced to a screen reader — "Desktop preview, 600 pixels wide". */
  title: string;
  /** Drawn as a phone rather than a browser pane. */
  device: "desktop" | "mobile";
};

/** A ceiling, not a target — past this, the frame scrolls instead of growing without bound. */
const MAX_REAL_HEIGHT = 2600;

export function EmailFrame({
  html,
  width,
  height = 680,
  scale = 1,
  title,
  device,
}: EmailFrameProps) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [measured, setMeasured] = React.useState<number | null>(null);

  // A new document means the old measurement no longer describes it — never
  // show yesterday's height against today's html while the new one loads.
  // Adjusted during render, not in an effect, so the stale height never
  // paints even for a single frame.
  const [seenHtml, setSeenHtml] = React.useState(html);
  if (seenHtml !== html) {
    setSeenHtml(html);
    setMeasured(null);
  }

  function onLoad() {
    const doc = iframeRef.current?.contentDocument;
    const next = Math.max(doc?.body?.scrollHeight ?? 0, doc?.documentElement?.scrollHeight ?? 0);
    if (next > 0) setMeasured(next);
  }

  const realHeight = Math.min(measured ?? height, MAX_REAL_HEIGHT);
  const capped = (measured ?? 0) > MAX_REAL_HEIGHT;
  const radius = device === "mobile" ? "var(--radius-lg)" : "var(--radius-sm)";

  return (
    <div
      style={{
        width: `${Math.round(width * scale)}px`,
        height: `${Math.round(realHeight * scale)}px`,
        overflowY: capped ? "auto" : "hidden",
        overflowX: "hidden",
        borderRadius: radius,
        background: "var(--surface-grouped)",
        border: "1px solid var(--stroke-rim)",
        boxShadow: "var(--e2)",
      }}
    >
      <iframe
        ref={iframeRef}
        title={title}
        srcDoc={html}
        sandbox="allow-same-origin"
        referrerPolicy="no-referrer"
        onLoad={onLoad}
        style={{
          width: `${width}px`,
          height: `${Math.max(realHeight, height)}px`,
          border: 0,
          display: "block",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          background: "var(--surface-grouped)",
        }}
      />
    </div>
  );
}

export type DeviceFrameProps = EmailFrameProps & {
  /** The caption under the frame — the device and its exact width. */
  caption: string;
};

export function DeviceFrame({ caption, ...frame }: DeviceFrameProps) {
  return (
    <figure
      className="flex flex-col items-center"
      style={{ margin: 0, gap: "var(--space-3)" }}
    >
      {/* The chrome: a notch for a phone, a title bar for a pane. */}
      <div
        className="flex flex-col items-center"
        style={{
          gap: "var(--space-2)",
          padding: "var(--space-3)",
          borderRadius:
            frame.device === "mobile" ? "var(--radius-xl)" : "var(--radius-lg)",
          background: "var(--surface-grouped)",
          border: "1px solid var(--stroke-rim)",
          boxShadow: "var(--e1)",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "block",
            width: frame.device === "mobile" ? "56px" : "100%",
            height: "4px",
            borderRadius: "var(--radius-capsule)",
            background: "var(--content-quaternary)",
            opacity: 0.5,
          }}
        />
        <EmailFrame {...frame} />
      </div>

      <figcaption
        className="t-caption tabular"
        style={{ color: "var(--content-tertiary)", textAlign: "center" }}
      >
        {caption}
      </figcaption>
    </figure>
  );
}
