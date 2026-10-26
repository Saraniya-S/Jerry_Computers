"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { showcase } from "@/data/showcase";
import { LogoMark } from "@/components/ui/Logo";
import { OrbitReel, type OrbitItem } from "./OrbitReel";

const ease = [0.22, 1, 0.36, 1] as const;
/** Reel background; the logo fade blends into the same colour. */
const PANEL_BG = "#e9f1e7";

const reelItems: OrbitItem[] = showcase.map((s) => ({ src: s.image, alt: s.title, title: s.title, subtitle: s.subtitle }));

/**
 * Split auth screen: an orbit reel of our product categories on the left and the form card
 * on the right. The reel drops away below lg.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();

  return (
    <main id="main" className="flex min-h-dvh flex-1 bg-ink-950 p-3 sm:p-5">
      <div className="grid w-full flex-1 gap-3 sm:gap-4 lg:grid-cols-[1.05fr_1fr]">
        <motion.aside
          className="relative hidden min-h-[560px] overflow-hidden rounded-[28px] lg:block"
          initial={reduce ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease }}
        >
          <OrbitReel items={reelItems} backgroundColor={PANEL_BG}>
            <p className="max-w-[12rem] text-balance text-center text-2xl font-medium leading-tight tracking-[-0.02em] text-fg">
              Hardware, builds <span className="font-serif font-normal italic">&amp; repairs</span>
            </p>
          </OrbitReel>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#e9f1e7] to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-7">
            <Link href="/" className="pointer-events-auto inline-flex items-center gap-2.5 text-fg" aria-label="Jerry Computers — home">
              <LogoMark className="size-9" />
              <span className="text-[1.05rem] font-semibold tracking-[-0.02em]">
                Jerry<span className="font-normal text-fg-muted"> Computers</span>
              </span>
            </Link>
            <Link
              href="/"
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-line bg-white/70 px-3.5 py-1.5 text-sm text-fg backdrop-blur-md transition-colors hover:bg-white"
            >
              Back to website <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </motion.aside>

        <section className="relative flex flex-col overflow-hidden rounded-[28px] border border-line bg-ink-850 px-5 py-5 shadow-[0_30px_80px_-50px_var(--shadow)] sm:px-8 sm:py-7">
          {/* Soft brand glow behind the heading */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--mint-soft),transparent)]"
          />

          <header className="relative flex items-center justify-between gap-3">
            <Link href="/" className="inline-flex items-center gap-2 text-fg lg:hidden" aria-label="Jerry Computers — home">
              <LogoMark className="size-8" />
            </Link>
            <ModeSwitch />
            <Link href="/#contact" className="hidden text-sm text-fg-muted transition-colors hover:text-fg sm:inline">
              Need help?
            </Link>
          </header>

          <div className="relative flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-[400px]">{children}</div>
          </div>

          <footer className="relative flex flex-wrap items-center justify-between gap-2 text-xs text-fg-dim">
            <span>© Jerry Computers</span>
            <nav aria-label="Policies" className="flex gap-4">
              <Link href="/policies/privacy" className="hover:text-fg">
                Privacy
              </Link>
              <Link href="/policies/terms" className="hover:text-fg">
                Terms
              </Link>
            </nav>
          </footer>
        </section>
      </div>
    </main>
  );
}

const modes = [
  { href: "/login", label: "Log in" },
  { href: "/register", label: "Sign up" },
] as const;

/** Segmented Log in / Sign up switch; the pill slides because the layout stays mounted across both routes. */
function ModeSwitch() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="flex rounded-full border border-line bg-ink-950 p-1">
      {modes.map((m) => {
        const active = pathname === m.href;
        return (
          <Link
            key={m.href}
            href={m.href}
            aria-current={active ? "page" : undefined}
            className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${active ? "text-white" : "text-fg-muted hover:text-fg"}`}
          >
            {active && (
              <motion.span
                layoutId="auth-mode-pill"
                className="absolute inset-0 rounded-full bg-brand"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{m.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
