"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navLinks } from "@/config/site";
import { productCategories } from "@/data/products";
import type { Service } from "@/data/services";
import { ProductArt } from "@/components/products/ProductArt";
import { ServiceVisual } from "@/components/services/ServiceVisual";
import { AccountNav } from "@/components/session/AccountNav";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { MegaMenu, type MegaItem } from "./MegaMenu";
import { MobileNavigation } from "./MobileNavigation";
import { useActiveSection } from "./useActiveSection";

type MenuKey = "services" | "products";

type Menus = Record<MenuKey, { heading: string; items: MegaItem[]; footer: { label: string; href: string }[] }>;

const buildMenus = (services: Service[]): Menus => ({
  services: {
    heading: "Services",
    items: services.slice(0, 4).map((s) => ({
      title: s.label === "Support" ? "Diagnostics" : s.label,
      description: s.description,
      href: `/services/${s.slug}`,
      visual: (
        <div className="absolute inset-0 flex items-center px-5">
          <div className="w-full">
            <ServiceVisual id={s.visual} />
          </div>
        </div>
      ),
    })),
    footer: [
      { label: "All services", href: "/#services" },
      ...services.slice(4).map((s) => ({ label: s.label, href: `/services/${s.slug}` })),
      { label: "Request a service", href: "/services/request" },
    ],
  },
  products: {
    heading: "Products",
    items: productCategories.slice(0, 4).map((c, i) => ({
      title: c.label,
      description: c.blurb,
      href: `/products?category=${c.id}`,
      visual: <ProductArt category={c.id} variant={(i % 3) as 0 | 1 | 2} className="absolute inset-0 size-full p-2" />,
    })),
    footer: [
      { label: "All products", href: "/products" },
      ...productCategories.slice(4).map((c) => ({ label: c.label, href: `/products?category=${c.id}` })),
    ],
  },
});

const sectionIds = navLinks.map((l) => l.section);

/** Site header. Rendered by the server Navbar, which supplies the services for the mega menu. */
export function NavbarClient({ services }: { services: Service[] }) {
  const menus = useMemo(() => buildMenus(services), [services]);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<MenuKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = useActiveSection(sectionIds);
  const reduce = useReducedMotion();
  const closeTimer = useRef<number | undefined>(undefined);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const onDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const openMenu = useCallback((key: MenuKey) => {
    window.clearTimeout(closeTimer.current);
    setOpen(key);
  }, []);
  const scheduleClose = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(null), 140);
  }, []);

  const solid = scrolled || open !== null;

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <nav
        ref={navRef}
        aria-label="Main"
        className="relative mx-auto max-w-[1320px]"
        onPointerLeave={(e) => e.pointerType === "mouse" && scheduleClose()}
      >
        <div
          className={`relative flex h-14 items-center justify-between rounded-2xl lg:grid lg:grid-cols-[1fr_auto_1fr] border px-3 transition-[background-color,border-color,box-shadow] duration-300 sm:px-4 ${
            solid
              ? "border-line bg-ink-900/85 shadow-[0_10px_40px_-20px_var(--shadow)] backdrop-blur-xl"
              : "border-transparent bg-transparent"
          }`}
        >
          {/* Left: section links */}
          <ul className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => {
              const menuKey = (link.section === "services" || link.section === "products" ? link.section : null) as MenuKey | null;
              const isActive = active === link.section;
              return (
                <li key={link.section} className="relative flex items-center" onPointerEnter={(e) => e.pointerType === "mouse" && (menuKey ? openMenu(menuKey) : scheduleClose())}>
                  <Link
                    href={link.href}
                    aria-current={isActive ? "true" : undefined}
                    onClick={() => setOpen(null)}
                    className={`relative rounded-lg px-2.5 py-2 text-sm transition-colors ${isActive ? "text-fg" : "text-fg-muted hover:text-fg"}`}
                  >
                    {link.label}
                    {isActive && (
                      <motion.span
                        layoutId={reduce ? undefined : "nav-active"}
                        className="absolute inset-x-2.5 -bottom-0.5 h-px bg-brand"
                        transition={{ type: "spring", stiffness: 400, damping: 34 }}
                      />
                    )}
                  </Link>
                  {menuKey && (
                    <button
                      type="button"
                      aria-expanded={open === menuKey}
                      aria-controls={`mega-${menuKey}`}
                      aria-label={`${open === menuKey ? "Hide" : "Show"} ${link.label.toLowerCase()} menu`}
                      onClick={() => setOpen(open === menuKey ? null : menuKey)}
                      className="-ml-1.5 grid size-6 place-items-center rounded-md text-fg-dim hover:text-fg"
                    >
                      <ChevronDown className={`size-3.5 transition-transform ${open === menuKey ? "rotate-180" : ""}`} aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Mobile: logo sits left */}
          <div className="lg:hidden">
            <Logo />
          </div>

          {/* Center wordmark on desktop */}
          <div className="hidden justify-center lg:flex">
            <Logo />
          </div>

          {/* Right: account + CTA */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-3">
            <AccountNav />
            <span className="hidden sm:contents">
              <ButtonLink href="/services/request" variant="brand" size="sm">
                Book a Service
              </ButtonLink>
            </span>
            <MobileNavigation open={mobileOpen} onOpenChange={setMobileOpen} active={active} />
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              key={open}
              initial={reduce ? false : { opacity: 0, y: -8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-0 top-full hidden pt-2 lg:block"
              onPointerEnter={() => window.clearTimeout(closeTimer.current)}
            >
              <MegaMenu id={`mega-${open}`} {...menus[open]} onNavigate={() => setOpen(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}
