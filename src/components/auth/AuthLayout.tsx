"use client";

import Link from "next/link";
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
 * Split auth screen: a light card with an orbit reel of our product categories on the left
 * and the form on the right. The reel drops away below lg.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();

  return (
    <main id="main" className="flex min-h-dvh flex-1 bg-ink-950 p-3 sm:p-5">
      <div className="grid w-full flex-1 gap-3 rounded-[28px] border border-line bg-ink-850 p-3 shadow-[0_30px_80px_-40px_var(--shadow)] lg:grid-cols-[1.05fr_1fr]">
        <motion.aside
          className="relative hidden min-h-[560px] overflow-hidden rounded-[20px] lg:block"
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

        <div className="flex flex-col rounded-[20px] border border-line bg-ink-950 px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2.5 text-fg" aria-label="Jerry Computers — home">
              <LogoMark className="size-8" />
              <span className="font-semibold tracking-[-0.02em]">Jerry</span>
            </Link>
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
              Back to website <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-[440px]">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
