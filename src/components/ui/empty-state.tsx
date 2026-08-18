"use client";

/**
 * Empty state — an icon, one line of explanation, one thing to do next.
 *
 * The line names the state and the reason. It never blames the user and never
 * fills the space with a second, competing action.
 */

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { Button, type ButtonVariant } from "./button";
import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  /**
   * Either a bare icon component (fine from another Client Component) or an
   * already-rendered element. A Server Component must pass the latter — a
   * raw component reference from a server-only module isn't serializable
   * across the client boundary, only the element it renders to is.
   */
  icon?: LucideIcon | React.ReactElement;
  /** Sentence case, one line, a state and its cause. */
  title: string;
  /** The consequence or the reason, stated in numbers where numbers exist. */
  description?: React.ReactNode;
  action?: {
    /** A verb the user would say aloud — "Send report", never "Submit". */
    label: string;
    onClick?: () => void;
    href?: string;
    variant?: ButtonVariant;
    icon?: LucideIcon;
  };
  className?: string;
};

export function EmptyState({
  icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const iconNode = React.isValidElement(icon)
    ? icon
    : React.createElement(icon as LucideIcon, { size: 22, strokeWidth: 1.5 });

  return (
    <div
      className={cn("flex flex-col items-center text-center", className)}
      style={{
        gap: "var(--space-3)",
        padding: "var(--space-12) var(--space-6)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "grid",
          placeItems: "center",
          width: "var(--space-12)",
          height: "var(--space-12)",
          borderRadius: "var(--radius-capsule)",
          background: "var(--fill-quiet)",
          color: "var(--content-tertiary)",
        }}
      >
        {iconNode}
      </span>

      <p
        className="t-headline"
        style={{ margin: 0, color: "var(--content-primary)" }}
      >
        {title}
      </p>

      {description ? (
        <p
          className="t-subhead prose-measure"
          style={{ margin: 0, color: "var(--content-secondary)" }}
        >
          {description}
        </p>
      ) : null}

      {action ? (
        <div style={{ marginTop: "var(--space-2)" }}>
          <Button
            variant={action.variant ?? "tinted"}
            size="m"
            leadingIcon={action.icon}
            onClick={action.onClick}
            {...(action.href ? { as: "a", href: action.href } : {})}
          >
            {action.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
