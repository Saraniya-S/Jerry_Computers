"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/(auth)/actions";

/** Account button pinned to the bottom of the sidebar; opens upward with profile and sign-out. */
export function UserMenu({ name, email }: { name: string; email: string }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className="absolute inset-x-0 bottom-full z-20 mb-1.5 rounded-xl border border-line bg-ink-850 p-1 shadow-[0_16px_40px_-16px_var(--shadow)]"
            initial={reduce ? false : { opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            <Link
              href="/account/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-fg hover:bg-ink-900"
            >
              <UserRound className="size-4 text-fg-dim" aria-hidden /> Profile &amp; security
            </Link>
            <form action={logout}>
              <button type="submit" role="menuitem" className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-fg hover:bg-ink-900">
                <LogOut className="size-4 text-fg-dim" aria-hidden /> Sign out
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-ink-800"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-white">{initials}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{name}</span>
          <span className="block truncate text-xs text-fg-dim">{email}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-fg-dim" aria-hidden />
      </button>
    </div>
  );
}

export function UserMenuSkeleton() {
  return (
    <div className="flex items-center gap-2.5 p-2" aria-hidden>
      <span className="size-8 animate-pulse rounded-full bg-ink-800" />
      <span className="flex-1 space-y-1.5">
        <span className="block h-3 w-24 animate-pulse rounded bg-ink-800" />
        <span className="block h-2.5 w-32 animate-pulse rounded bg-ink-800" />
      </span>
    </div>
  );
}
