"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, type SiteTheme } from "./themeScript";

export type { SiteTheme };

/** Current site theme from `<html data-theme>`; re-renders when it changes. */
export function useSiteTheme(): SiteTheme {
  return useSyncExternalStore(subscribe, read, () => "dark");
}

export function setSiteTheme(theme: SiteTheme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (private mode); the choice still applies for this visit.
  }
}

function read(): SiteTheme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
