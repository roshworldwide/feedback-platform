"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A media query as a React value, with no setState-in-an-effect and therefore
 * no hydration flash. The server snapshot is always `false`: the rail renders
 * at its full width in the HTML and narrows only once the browser has told us
 * the viewport is small.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** Below this the rail keeps only its icons. */
export const RAIL_COLLAPSE = "(max-width: 1279px)";
/** Below this the rail leaves the page entirely and becomes a drawer. */
export const RAIL_DRAWER = "(max-width: 833px)";
