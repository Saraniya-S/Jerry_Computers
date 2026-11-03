"use client";

import { useEffect } from "react";

/**
 * Refreshing the home page starts again at the top. Menu links such as "Products" leave a section in
 * the address (/#products), and a browser reload would otherwise jump straight back to it. Section
 * links, links from other pages and back/forward still go to their section.
 */
export function ReloadToTop() {
  useEffect(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type !== "reload") return;
    if (window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  return null;
}
