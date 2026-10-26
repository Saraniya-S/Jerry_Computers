"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

const KEY = "jc-promo-service-dismissed";
const listeners = new Set<() => void>();

function read() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {}
  listeners.forEach((l) => l());
}

/** Sidebar nudge to book a repair, dismissible per browser (the shell's "point-in-time restore" card). */
export function PromoCard() {
  const dismissed = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => true,
  );
  if (dismissed) return null;

  return (
    <div className="rounded-xl border border-line bg-gradient-to-b from-mint-soft to-ink-850 p-3.5">
      <p className="text-sm font-medium text-fg">Something not working?</p>
      <p className="mt-1 text-xs leading-relaxed text-fg-muted">Book a repair at the shop or an on-site visit for laptops, desktops, CCTV, printers and UPS.</p>
      <div className="mt-3 flex gap-2">
        <Link
          href="/services/request"
          className="inline-flex h-7 items-center rounded-md bg-brand px-2.5 text-xs font-medium text-white hover:bg-[var(--brand-hover)]"
        >
          Book a service
        </Link>
        <button type="button" onClick={dismiss} className="inline-flex h-7 items-center rounded-md border border-line-strong px-2.5 text-xs text-fg-muted hover:text-fg">
          Dismiss
        </button>
      </div>
    </div>
  );
}
