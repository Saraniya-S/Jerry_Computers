"use client";

import { useSyncExternalStore } from "react";

/** SSR-safe media query hook. Returns `false` on the server and first hydration pass. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** True when the viewport is large enough and the user allows motion. */
export function useRichMotion(minWidth = 768, minHeight = 0) {
  return useMediaQuery(`(min-width: ${minWidth}px) and (min-height: ${minHeight}px) and (prefers-reduced-motion: no-preference)`);
}
