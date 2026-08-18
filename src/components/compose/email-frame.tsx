"use client";

/**
 * A rendered email, in a device frame.
 *
 * The document inside is the output of `renderReportEmail` — the same function
 * the sender calls, reached through a server action. There is no second
 * renderer and no approximation: what is behind this glass is the bytes a
 * recipient receives, minus their own name and their own tracking token.
 *
 * The iframe is sandboxed with nothing granted. An email body is untrusted by
 * construction, and a preview must not be able to run anything or navigate the
 * app away from a half-written draft.
 */

import * as React from "react";

export type EmailFrameProps = {
  html: string;
  /** The viewport width to render at — 600 for desktop, 375 for a phone. */
  width: number;
  /** Visible height of the frame before it scrolls. */
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
  const radius = device === "mobile" ? "var(--radius-lg)" : "var(--radius-sm)";

  return (
    <div
      style={{
        width: `${Math.round(width * scale)}px`,
        height: `${Math.round(height * scale)}px`,
        overflow: "hidden",
        borderRadius: radius,
        background: "var(--surface-grouped)",
        border: "1px solid var(--stroke-rim)",
        boxShadow: "var(--e2)",
      }}
    >
      <iframe
        title={title}
        srcDoc={html}
        sandbox=""
        referrerPolicy="no-referrer"
        loading="lazy"
        style={{
          width: `${width}px`,
          height: `${height}px`,
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
