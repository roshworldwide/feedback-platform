"use client";

/**
 * A rendered email, in a device frame.
 *
 * The document inside is the output of `renderReportEmail` — the same function
 * the sender calls, reached through a server action. There is no second
 * renderer and no approximation: what is behind this glass is the bytes a
 * recipient receives, minus their own name and their own tracking token.
 *
 * A preview is a window, not the page: `height` is a ceiling on how tall the
 * frame is ever allowed to look, not a target it grows to fill. The iframe's
 * own height is capped there too, deliberately — an iframe is its own
 * browsing context, and a wheel scroll over one goes to *its* scrolling, not
 * to a CSS `overflow` ancestor sitting outside it. So content taller than the
 * ceiling scrolls inside the iframe's own document, the same way it would in
 * a real browser pane, rather than growing the page past the fold or landing
 * on a wrapper whose scrollbar a mouse can never actually reach.
 *
 * `allow-same-origin` is the one sandbox token granted — it's what lets this
 * component read the document's own height back. `allow-scripts` stays off,
 * so nothing inside can run regardless; the content is our own renderer's
 * escaped output, never arbitrary third-party HTML.
 *
 * The wheel listener below exists so scrolling doesn't depend on a wheel
 * event correctly crossing into a `transform: scale()`'d iframe's own
 * browsing context — an unnecessary thing to rely on when the wrapper right
 * outside it is never transformed. An event over the wrapper always lands on
 * ordinary, unscaled DOM, so it's read there and forwarded by hand into the
 * iframe's own `scrollBy`, sidestepping the question rather than trusting it.
 */

import * as React from "react";

export type EmailFrameProps = {
  html: string;
  /** The viewport width to render at — 600 for desktop, 375 for a phone. */
  width: number;
  /** The ceiling on visible height, in real (unscaled) pixels — past this, the frame scrolls. */
  height?: number;
  /** Shrinks the whole frame to fit the column it sits in. */
  scale?: number;
  /** Announced to a screen reader — "Desktop preview, 600 pixels wide". */
  title: string;
  /** Drawn as a phone rather than a browser pane. */
  device: "desktop" | "mobile";
};

export function EmailFrame({
  html,
  width,
  height = 680,
  scale = 1,
  title,
  device,
}: EmailFrameProps) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
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

  // Native, not React's onWheel: React attaches wheel listeners passively,
  // which silently drops preventDefault — and without it, the page scrolls
  // along with the frame instead of only the frame.
  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    function onWheel(event: WheelEvent) {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      event.preventDefault();
      win.scrollBy(0, event.deltaY);
    }
    wrapper.addEventListener("wheel", onWheel, { passive: false });
    return () => wrapper.removeEventListener("wheel", onWheel);
  }, []);

  // The iframe's own height is capped at `height` — never taller, so short
  // content never leaves a padded gap, and tall content scrolls inside the
  // iframe's own document rather than the wrapper around it. That distinction
  // matters: an iframe is its own browsing context, and a wheel scroll over
  // one is delivered to *its* scrolling, not to a `overflow: auto` ancestor
  // outside it — so the frame that actually needs to scroll has to be the
  // iframe itself, not the div wrapping it.
  const contentHeight = measured ?? height;
  const visibleHeight = Math.min(contentHeight, height);
  const radius = device === "mobile" ? "var(--radius-lg)" : "var(--radius-sm)";

  return (
    <div
      ref={wrapperRef}
      style={{
        width: `${Math.round(width * scale)}px`,
        height: `${Math.round(visibleHeight * scale)}px`,
        overflow: "hidden",
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
          height: `${visibleHeight}px`,
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
