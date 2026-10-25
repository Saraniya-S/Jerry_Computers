"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Menu, UserRound, X } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { navLinks } from "@/config/site";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "./ThemeToggle";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; active: string | null };

const noopSubscribe = () => () => {};

export function MobileNavigation({ open, onOpenChange, active }: Props) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const trigger = triggerRef.current;
    panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = panelRef.current.querySelectorAll<HTMLElement>("a,button");
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open, onOpenChange]);

  const close = () => onOpenChange(false);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => onOpenChange(true)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label="Open menu"
        className="grid size-10 place-items-center rounded-xl border border-line text-fg lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                id="mobile-nav"
                role="dialog"
                aria-modal="true"
                aria-label="Site menu"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-0 z-[60] flex flex-col bg-ink-950/98 px-5 pb-8 pt-5 backdrop-blur-xl lg:hidden"
              >
                <div className="flex h-12 items-center justify-between">
                  <Logo onClick={close} />
                  <button type="button" onClick={close} aria-label="Close menu" className="grid size-10 place-items-center rounded-xl border border-line text-fg">
                    <X className="size-5" aria-hidden />
                  </button>
                </div>

                <ul className="mt-10 flex-1 space-y-1">
                  {navLinks.map((link, i) => (
                    <motion.li
                      key={link.section}
                      initial={reduce ? false : { opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + i * 0.04, duration: 0.35 }}
                    >
                      <Link
                        href={link.href}
                        onClick={close}
                        aria-current={active === link.section ? "true" : undefined}
                        className="flex items-baseline gap-4 border-b border-line py-4 text-3xl font-medium tracking-tight text-fg"
                      >
                        <span className="font-mono text-xs text-fg-dim">0{i + 1}</span>
                        <span className={active === link.section ? "text-copper" : ""}>{link.label}</span>
                      </Link>
                    </motion.li>
                  ))}
                </ul>

                <ThemeToggle showLabel className="mb-4 h-11 self-start border border-line px-4 text-sm" />
                <div className="grid gap-3">
                  <ButtonLink href="/services/request" variant="copper" size="lg" onClick={close}>
                    Book a Service <ArrowUpRight className="size-4" aria-hidden />
                  </ButtonLink>
                  <ButtonLink href="/account" variant="outline" size="lg" onClick={close}>
                    <UserRound className="size-4" aria-hidden /> Login
                  </ButtonLink>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
