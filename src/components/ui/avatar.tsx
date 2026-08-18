/**
 * Avatar — initials on a deterministic tint.
 *
 * The tint comes from `avatarTint`, which draws from the Vapor axis and the
 * titanium ramp and never from Aurum: an avatar is not the element of
 * consequence. The tint is composited at low alpha and the initials are set in
 * `--content-primary`, so legibility holds in all five finishes.
 */

import * as React from "react";
import { avatarTint, cn, initials as toInitials } from "@/lib/utils";

export type AvatarSize = 24 | 32 | 40 | 56;

const LABEL_STEP: Record<AvatarSize, string> = {
  24: "t-overline",
  32: "t-micro",
  40: "t-caption",
  56: "t-subhead",
};

export type AvatarProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** The full name. Also becomes the accessible label. */
  name: string;
  size?: AvatarSize;
  /** Override the derived initials — for a team or a system sender. */
  text?: string;
};

export function Avatar({
  name,
  size = 32,
  text,
  className,
  style,
  ...rest
}: AvatarProps) {
  const tint = avatarTint(name);
  return (
    <span
      {...rest}
      role="img"
      aria-label={name}
      className={cn(
        LABEL_STEP[size],
        "inline-flex select-none items-center justify-center",
        className,
      )}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        flex: "none",
        borderRadius: "var(--radius-capsule)",
        background: `color-mix(in oklab, ${tint} 28%, transparent)`,
        border: `1px solid color-mix(in oklab, ${tint} 46%, transparent)`,
        color: "var(--content-primary)",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {text ?? toInitials(name)}
    </span>
  );
}

export type AvatarGroupProps = React.ComponentProps<"span"> & {
  size?: AvatarSize;
  names: string[];
  /** Show at most this many, then state the true remainder — never a silent cut. */
  max?: number;
};

export function AvatarGroup({
  names,
  size = 24,
  max = 4,
  className,
  style,
  ...rest
}: AvatarGroupProps) {
  const shown = names.slice(0, max);
  const remainder = names.length - shown.length;

  return (
    <span
      {...rest}
      className={cn("inline-flex items-center", className)}
      style={{ gap: "var(--space-1)", ...style }}
    >
      {shown.map((name) => (
        <Avatar key={name} name={name} size={size} />
      ))}
      {remainder > 0 ? (
        <span
          className="t-micro tabular"
          style={{ color: "var(--content-secondary)" }}
        >
          +{remainder}
        </span>
      ) : null}
    </span>
  );
}
