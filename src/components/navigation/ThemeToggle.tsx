"use client";

import { Moon, Sun } from "lucide-react";
import { setSiteTheme, useSiteTheme } from "@/lib/theme";

export function ThemeToggle({ className = "", showLabel = false }: { className?: string; showLabel?: boolean }) {
  const theme = useSiteTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setSiteTheme(next)}
      aria-label={`Switch to ${next} theme`}
      className={`inline-flex items-center justify-center gap-2 rounded-xl text-fg-muted transition-colors hover:text-fg ${className}`}
    >
      {theme === "dark" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
      {showLabel && <span>{next === "light" ? "Light theme" : "Dark theme"}</span>}
    </button>
  );
}
