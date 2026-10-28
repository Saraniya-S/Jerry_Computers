"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight, Menu, X, type LucideIcon } from "lucide-react";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { LogoMark } from "@/components/ui/Logo";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

type Props = {
  groups: NavGroup[];
  /** Breadcrumb root for this area, e.g. My account or Admin. */
  root: { href: string; label: string };
  /** Top-bar buttons on the right. */
  actions?: ReactNode;
  /** Above the navigation (e.g. search). */
  sidebarTop?: ReactNode;
  /** Between the navigation and the account menu (e.g. a promo card). */
  sidebarBottom?: ReactNode;
  userMenu: ReactNode;
  children: ReactNode;
};

/**
 * Dashboard chrome after ReactBits Pro "App Shell 7", shared by the customer and admin areas:
 * a full-width top bar with breadcrumbs, a sidebar with grouped navigation and the account menu,
 * and the page in an inset panel. Below lg the sidebar becomes a drawer.
 */
export function DashboardShell({ groups, root, actions, sidebarTop, sidebarBottom, userMenu, children }: Props) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const sidebar = (
    <div className="flex h-full flex-col gap-4 px-3 pb-3 pt-4">
      {sidebarTop}
      <nav aria-label={root.label} className="flex-1 space-y-5 overflow-y-auto">
        {/* The URL is request data on dynamic routes, so the active state streams in. */}
        <Suspense fallback={<NavLinks groups={groups} root={root} pathname="" reduce={reduce} onNavigate={() => setOpen(false)} />}>
          <ActiveNavLinks groups={groups} root={root} reduce={reduce} onNavigate={() => setOpen(false)} />
        </Suspense>
      </nav>
      {sidebarBottom}
      {userMenu}
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-ink-900">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-ink-900/85 px-3 backdrop-blur-md sm:px-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid size-9 place-items-center rounded-lg text-fg-muted hover:bg-ink-800 hover:text-fg lg:hidden"
          aria-label="Open menu"
          aria-expanded={open}
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
          <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg px-1.5 py-1 font-semibold tracking-[-0.01em] text-fg hover:bg-ink-800">
            <LogoMark className="size-7" />
            <span className="hidden sm:inline">Jerry Computers</span>
          </Link>
          <ChevronRight className="size-4 shrink-0 text-fg-dim" aria-hidden />
          <Link href={root.href} className="shrink-0 rounded-lg px-1.5 py-1 text-fg-muted hover:bg-ink-800 hover:text-fg">
            {root.label}
          </Link>
          <Suspense>
            <CurrentCrumb groups={groups} root={root} />
          </Suspense>
        </nav>
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </header>

      <div className="flex flex-1">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 lg:block">{sidebar}</aside>

        <AnimatePresence>
          {open && (
            <>
              <motion.div
                key="scrim"
                className="fixed inset-0 z-40 bg-[rgb(28_25_56/0.35)] backdrop-blur-[2px] lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpen(false)}
              />
              <motion.aside
                key="drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Menu"
                className="fixed inset-y-0 left-0 z-50 w-[min(18rem,86vw)] bg-ink-900 shadow-2xl lg:hidden"
                initial={reduce ? { opacity: 0 } : { x: "-100%" }}
                animate={reduce ? { opacity: 1 } : { x: 0 }}
                exit={reduce ? { opacity: 0 } : { x: "-100%" }}
                transition={{ type: "spring", stiffness: 420, damping: 40 }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-lg text-fg-muted hover:bg-ink-800 hover:text-fg"
                  aria-label="Close menu"
                >
                  <X className="size-5" aria-hidden />
                </button>
                <div className="h-full pt-10">{sidebar}</div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main id="main" className="min-w-0 flex-1 p-2 sm:p-3 lg:pl-0">
          <div className="min-h-full rounded-2xl border border-line bg-ink-850 shadow-[0_1px_3px_var(--line)]">{children}</div>
        </main>
      </div>
    </div>
  );
}

type NavProps = { groups: NavGroup[]; root: Props["root"]; reduce: boolean | null; onNavigate: () => void };

function ActiveNavLinks(props: NavProps) {
  return <NavLinks {...props} pathname={usePathname()} />;
}

function NavLinks({ groups, root, pathname, reduce, onNavigate }: NavProps & { pathname: string }) {
  return (
    <>
        {groups.map((g) => (
        <div key={g.label}>
          <p className="px-3 pb-1.5 text-xs font-medium text-fg-dim">{g.label}</p>
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = isActive(pathname, it);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors ${
                      active ? "font-medium text-fg" : "text-fg-muted hover:bg-ink-900 hover:text-fg"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId={`${root.href}-nav-active`}
                        className="absolute inset-0 rounded-lg border border-line bg-ink-850 shadow-[0_1px_2px_var(--line)]"
                        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                      />
                    )}
                    <it.icon className={`relative size-4 ${active ? "text-brand" : ""}`} aria-hidden />
                    <span className="relative">{it.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

function CurrentCrumb({ groups, root }: { groups: NavGroup[]; root: Props["root"] }) {
  const pathname = usePathname();
  const current = groups
    .flatMap((g) => g.items)
    .filter((i) => i.href.startsWith(root.href) && isActive(pathname, i))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (!current || current.href === root.href) return null;
  return (
    <>
      <ChevronRight className="size-4 shrink-0 text-fg-dim" aria-hidden />
      <span aria-current="page" className="truncate px-1.5 py-1 font-medium text-fg">
        {current.label}
      </span>
    </>
  );
}
