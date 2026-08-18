/**
 * Card — the squircle that holds content.
 *
 * `--radius-lg`, `--surface-raised`, `e1`, a rim hairline. The optional accent
 * draws a 3pt top edge in a signal colour; it is an inset shadow so it follows
 * the corner radius exactly rather than squaring it off.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export type CardAccent = "nominal" | "caution" | "abort" | "link" | "accent";

const ACCENT_TOKEN: Record<CardAccent, string> = {
  nominal: "var(--signal-nominal)",
  caution: "var(--signal-caution)",
  abort: "var(--signal-abort)",
  link: "var(--signal-link)",
  accent: "var(--content-accent)",
};

export type CardProps = React.ComponentProps<"div"> & {
  accent?: CardAccent;
  /** e0 flush · e1 card · e2 hover or dragged. */
  elevation?: "e0" | "e1" | "e2";
};

export function Card({
  accent,
  elevation = "e1",
  className,
  style,
  children,
  ...rest
}: CardProps) {
  const base = elevation === "e0" ? undefined : `var(--${elevation})`;
  const edge = accent ? `inset 0 3px 0 0 ${ACCENT_TOKEN[accent]}` : undefined;

  return (
    <div
      {...rest}
      className={cn("relative", className)}
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--stroke-rim)",
        borderRadius: "var(--radius-lg)",
        boxShadow: [edge, base].filter(Boolean).join(", ") || undefined,
        color: "var(--content-primary)",
        transition: "box-shadow var(--dur-glide) var(--ease-glide)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export type CardHeaderProps = React.ComponentProps<"div"> & {
  /** Rendered opposite the title — a button, a pill, a menu. */
  action?: React.ReactNode;
};

export function CardHeader({
  className,
  style,
  children,
  action,
  ...rest
}: CardHeaderProps) {
  return (
    <div
      {...rest}
      className={cn("flex items-start justify-between", className)}
      style={{
        gap: "var(--space-4)",
        padding: "var(--space-5) var(--space-5) var(--space-3)",
        ...style,
      }}
    >
      <div style={{ minWidth: 0 }}>{children}</div>
      {action ? <div style={{ flex: "none" }}>{action}</div> : null}
    </div>
  );
}

export type CardTitleProps = React.ComponentProps<"h3"> & {
  as?: "h1" | "h2" | "h3" | "h4";
  /** A short line under the title, in the secondary role. */
  description?: React.ReactNode;
};

export function CardTitle({
  as = "h3",
  className,
  style,
  children,
  description,
  ...rest
}: CardTitleProps) {
  const Heading = as;
  return (
    <>
      <Heading
        {...rest}
        className={cn("t-title-3", className)}
        style={{ margin: 0, color: "var(--content-primary)", ...style }}
      >
        {children}
      </Heading>
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
    </>
  );
}

export function CardBody({
  className,
  style,
  children,
  ...rest
}: React.ComponentProps<"div">) {
  return (
    <div
      {...rest}
      className={className}
      style={{
        padding: "0 var(--space-5) var(--space-5)",
        color: "var(--content-primary)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  style,
  children,
  ...rest
}: React.ComponentProps<"div">) {
  return (
    <div
      {...rest}
      className={cn("flex flex-wrap items-center", className)}
      style={{
        gap: "var(--space-3)",
        padding: "var(--space-4) var(--space-5)",
        borderTop: "1px solid var(--stroke-hairline)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
