/**
 * Skeletons draw the destination in the final layout, so the wait is spent
 * orienting rather than doubting. Never a spinner where a count exists.
 *
 * The shimmer lives in `aurum.css` as `.skeleton`; this only shapes it.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export type SkeletonProps = React.ComponentProps<"div"> & {
  width?: string | number;
  height?: string | number;
  /** Match the shape of the thing that is coming. */
  shape?: "sm" | "lg" | "capsule";
};

const SHAPE: Record<NonNullable<SkeletonProps["shape"]>, string> = {
  sm: "var(--radius-sm)",
  lg: "var(--radius-lg)",
  capsule: "var(--radius-capsule)",
};

export function Skeleton({
  width = "100%",
  height = "var(--space-4)",
  shape = "sm",
  className,
  style,
  ...rest
}: SkeletonProps) {
  return (
    <div
      {...rest}
      aria-hidden="true"
      className={cn("skeleton", className)}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: SHAPE[shape],
        ...style,
      }}
    />
  );
}

export type SkeletonTextProps = React.ComponentProps<"div"> & {
  lines?: number;
  /** Line height step — matches the type step it stands in for. */
  lineHeight?: string;
};

export function SkeletonText({
  lines = 3,
  lineHeight = "var(--space-4)",
  className,
  style,
  ...rest
}: SkeletonTextProps) {
  return (
    <div
      {...rest}
      className={cn("flex flex-col", className)}
      style={{ gap: "var(--space-2)", ...style }}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          height={lineHeight}
          // The last line is short, the way a paragraph actually ends.
          width={index === lines - 1 && lines > 1 ? "62%" : "100%"}
        />
      ))}
    </div>
  );
}
