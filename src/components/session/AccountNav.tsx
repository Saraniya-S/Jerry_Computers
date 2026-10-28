"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LayoutDashboard, LogOut, MapPin, Package, UserRound, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/(auth)/actions";
import { useSession, type SessionViewer } from "@/lib/client/session";
import { CartButton } from "./CartButton";

export function initials(v: Pick<SessionViewer, "firstName" | "lastName">) {
  return `${v.firstName[0] ?? ""}${v.lastName[0] ?? ""}`.toUpperCase() || "?";
}

/** Navbar right side: Login for guests; cart and account menu once signed in. */
export function AccountNav() {
  const { status, viewer } = useSession();

  if (status === "loading") return <span className="size-9 animate-pulse rounded-full bg-ink-800" aria-hidden />;
  if (!viewer) {
    return (
      <Link
        href="/login"
        className="hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-fg-muted transition-colors hover:text-fg sm:inline-flex"
      >
        <UserRound className="size-4" aria-hidden />
        Login
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <CartButton />
      <AccountMenu viewer={viewer} />
    </div>
  );
}

const customerLinks = [
  { href: "/account", label: "My account", icon: LayoutDashboard },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/services", label: "Service requests", icon: Wrench },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/profile", label: "Profile & security", icon: UserRound },
];

function AccountMenu({ viewer }: { viewer: SessionViewer }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const links = viewer.role === "customer" ? customerLinks : [{ href: viewer.home, label: "My workspace", icon: LayoutDashboard }];

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
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${viewer.firstName}`}
        className="flex items-center gap-2 rounded-full p-0.5 pr-0.5 transition-colors hover:bg-ink-800 sm:pr-3"
      >
        <span className="grid size-8 place-items-center rounded-full bg-brand text-xs font-semibold text-white">{initials(viewer)}</span>
        <span className="hidden max-w-[8rem] truncate text-sm font-medium text-fg sm:inline">{viewer.firstName}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={reduce ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-2xl border border-line bg-ink-850 p-1.5 shadow-[0_20px_50px_-20px_var(--shadow)]"
          >
            <div className="px-3 pb-2.5 pt-2">
              <p className="truncate text-sm font-medium text-fg">
                {viewer.firstName} {viewer.lastName}
              </p>
              <p className="truncate text-xs text-fg-dim">{viewer.email}</p>
            </div>
            {viewer.role === "customer" && !viewer.onboarded && (
              <Link
                href="/onboarding"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="mx-1 mb-1.5 block rounded-lg bg-mint-soft px-3 py-2 text-xs text-leaf hover:brightness-[0.98]"
              >
                <span className="font-medium">Finish setting up</span> — add your mobile and address
              </Link>
            )}
            <div className="border-t border-line pt-1.5">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-fg hover:bg-ink-900"
                >
                  <l.icon className="size-4 text-fg-dim" aria-hidden /> {l.label}
                </Link>
              ))}
            </div>
            <form action={logout} className="mt-1.5 border-t border-line pt-1.5">
              <button type="submit" role="menuitem" className="flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-sm text-fg hover:bg-ink-900">
                <LogOut className="size-4 text-fg-dim" aria-hidden /> Sign out
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
