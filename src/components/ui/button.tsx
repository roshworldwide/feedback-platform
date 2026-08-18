"use client";

/**
 * The capsule family.
 *
 * Six variants, five sizes, one shape. `metal` is the Aurum element — one per
 * screen, never on an error, a warning or a destructive action. Everything a
 * finger touches is a capsule; sizes below 44pt carry an invisible hit area so
 * the target never shrinks with the pixels.
 */

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "metal"
  | "solid"
  | "glass"
  | "tinted"
  | "plain"
  | "destruct";

export type ButtonSize = "xs" | "s" | "m" | "l" | "xl";

type Cap = { h: string; px: string; label: string; belowTarget: boolean };

/** Capsule sizing comes from the token layer, never from a literal. */
const CAP: Record<ButtonSize, Cap> = {
  xs: {
    h: "var(--cap-xs-h)",
    px: "var(--cap-xs-px)",
    label: "var(--cap-xs-label)",
    belowTarget: true,
  },
  s: {
    h: "var(--cap-s-h)",
    px: "var(--cap-s-px)",
    label: "var(--cap-s-label)",
    belowTarget: true,
  },
  m: {
    h: "var(--cap-m-h)",
    px: "var(--cap-m-px)",
    label: "var(--cap-m-label)",
    belowTarget: false,
  },
  l: {
    h: "var(--cap-l-h)",
    px: "var(--cap-l-px)",
    label: "var(--cap-l-label)",
    belowTarget: false,
  },
  xl: {
    h: "var(--cap-xl-h)",
    px: "var(--cap-xl-px)",
    label: "var(--cap-xl-label)",
    belowTarget: false,
  },
};

/**
 * A 16pt spinner drawn in SVG so it needs no keyframe of its own. It inherits
 * `currentColor`, so it is correct on every variant and every finish.
 */
export function Spinner({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const r = (size - 2) / 2;
  const circumference = 2 * Math.PI * r;
  const centre = size / 2;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      <circle
        cx={centre}
        cy={centre}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        opacity={0.22}
      />
      <circle
        cx={centre}
        cy={centre}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={`${circumference * 0.28} ${circumference}`}
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from={`0 ${centre} ${centre}`}
          to={`360 ${centre} ${centre}`}
          dur="900ms"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

type Skin = {
  background?: string;
  color: string;
  boxShadow?: string;
  border?: string;
  filter?: string;
};

function skinFor(
  variant: ButtonVariant,
  hovered: boolean,
  pressed: boolean,
): Skin {
  switch (variant) {
    case "metal":
      return {
        background: "var(--fill-accent)",
        color: "var(--content-on-accent)",
        boxShadow: hovered && !pressed ? "var(--e2)" : "var(--e1)",
        filter: pressed
          ? "brightness(0.94)"
          : hovered
            ? "brightness(1.06)"
            : undefined,
      };
    case "solid":
      return {
        background: "var(--content-primary)",
        color: "var(--surface-canvas)",
        boxShadow: hovered && !pressed ? "var(--e2)" : "var(--e1)",
        filter: pressed
          ? "brightness(0.92)"
          : hovered
            ? "brightness(1.04)"
            : undefined,
      };
    case "glass":
      return {
        // `.glass` supplies the surface, the blur and the rim.
        background: pressed ? "var(--fill-pressed)" : undefined,
        color: "var(--content-primary)",
        boxShadow: hovered && !pressed ? "var(--e2)" : "var(--e1)",
      };
    case "tinted":
      return {
        background: hovered || pressed ? "var(--fill-pressed)" : "var(--fill-quiet)",
        color: "var(--content-accent)",
        border: "1px solid var(--stroke-hairline)",
      };
    case "plain":
      return {
        background: pressed
          ? "var(--fill-pressed)"
          : hovered
            ? "var(--fill-quiet)"
            : "transparent",
        color: "var(--content-accent)",
      };
    case "destruct":
      return {
        background: "var(--signal-abort)",
        color: "var(--content-on-accent)",
        boxShadow: hovered && !pressed ? "var(--e2)" : "var(--e1)",
        filter: pressed
          ? "brightness(0.94)"
          : hovered
            ? "brightness(1.06)"
            : undefined,
      };
  }
}

export type ButtonOwnProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Rendered at 0.82× the label, 6pt before it. */
  leadingIcon?: LucideIcon;
  /** Rendered at 0.82× the label, 6pt after it. */
  trailingIcon?: LucideIcon;
  fullWidth?: boolean;
  /** Render as another element — `as={Link}` for navigation. */
  as?: React.ElementType;
  href?: string;
};

export type ButtonProps = ButtonOwnProps &
  Omit<React.ComponentProps<"button">, "ref"> & {
    ref?: React.Ref<HTMLButtonElement>;
  };

export function Button({
  variant = "solid",
  size = "m",
  loading = false,
  leadingIcon: LeadingIcon,
  trailingIcon: TrailingIcon,
  fullWidth = false,
  as,
  href,
  className,
  children,
  disabled,
  style,
  onPointerDown,
  onPointerUp,
  onPointerEnter,
  onPointerLeave,
  onBlur,
  type,
  ref,
  ...rest
}: ButtonProps) {
  const [hovered, setHovered] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);

  const cap = CAP[size];
  const inert = Boolean(disabled) || loading;
  const skin = skinFor(variant, hovered && !inert, pressed && !inert);
  const iconSize = `calc(${cap.label} * 0.82)`;
  const iconOnly = children === undefined || children === null || children === false;

  const Comp: React.ElementType = as ?? "button";
  const isNativeButton = Comp === "button";

  const elementProps: Record<string, unknown> = { ...rest };
  if (isNativeButton) {
    elementProps.type = type ?? "button";
    elementProps.disabled = inert;
  } else {
    elementProps.href = inert ? undefined : href;
    elementProps.role = "button";
    elementProps["aria-disabled"] = inert || undefined;
    elementProps.tabIndex = inert ? -1 : 0;
  }

  return (
    <Comp
      {...elementProps}
      ref={ref}
      aria-busy={loading || undefined}
      className={cn(
        "relative inline-flex select-none items-center justify-center no-underline",
        variant === "glass" && "glass",
        fullWidth && "w-full",
        className,
      )}
      style={{
        height: cap.h,
        minWidth: cap.h,
        paddingInline: iconOnly ? 0 : cap.px,
        gap: "6px",
        borderRadius: "var(--radius-capsule)",
        fontFamily: "var(--font-text)",
        fontSize: cap.label,
        fontWeight: 600,
        letterSpacing: "var(--tr-headline)",
        lineHeight: 1,
        cursor: inert ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        borderWidth: skin.border ? undefined : 0,
        transform: pressed && !inert ? "scale(0.97)" : "scale(1)",
        transition:
          "transform var(--dur-press) var(--ease-standard), " +
          "filter var(--dur-press) var(--ease-standard), " +
          "background-color var(--dur-glide) var(--ease-glide), " +
          "box-shadow var(--dur-glide) var(--ease-glide), " +
          "opacity var(--dur-glide) var(--ease-glide)",
        ...skin,
        ...style,
      }}
      onPointerEnter={(event: React.PointerEvent<HTMLButtonElement>) => {
        setHovered(true);
        onPointerEnter?.(event);
      }}
      onPointerLeave={(event: React.PointerEvent<HTMLButtonElement>) => {
        setHovered(false);
        setPressed(false);
        onPointerLeave?.(event);
      }}
      onPointerDown={(event: React.PointerEvent<HTMLButtonElement>) => {
        if (!inert) setPressed(true);
        onPointerDown?.(event);
      }}
      onPointerUp={(event: React.PointerEvent<HTMLButtonElement>) => {
        setPressed(false);
        onPointerUp?.(event);
      }}
      onBlur={(event: React.FocusEvent<HTMLButtonElement>) => {
        setPressed(false);
        onBlur?.(event);
      }}
    >
      {/* Below 44pt the pixels shrink but the target does not. */}
      {cap.belowTarget ? (
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
      ) : null}

      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          // The label keeps its box while loading, so nothing resizes.
          opacity: loading ? 0 : 1,
          transition: "opacity var(--dur-exit) var(--ease-exit)",
        }}
      >
        {LeadingIcon ? (
          <LeadingIcon
            size={iconSize}
            strokeWidth={1.75}
            aria-hidden="true"
            style={{ flex: "none" }}
          />
        ) : null}
        {iconOnly ? null : <span>{children}</span>}
        {TrailingIcon ? (
          <TrailingIcon
            size={iconSize}
            strokeWidth={1.75}
            aria-hidden="true"
            style={{ flex: "none" }}
          />
        ) : null}
      </span>

      {loading ? (
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Spinner size={16} />
        </span>
      ) : null}
    </Comp>
  );
}
