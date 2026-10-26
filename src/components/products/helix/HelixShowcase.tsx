"use client";

import Link from "next/link";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { formatPrice, getCategory, type Product, type ProductCategoryId } from "@/data/products";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductCategoryNavigation } from "@/components/products/ProductCategoryNavigation";
import { useMediaQuery, useRichMotion } from "@/lib/useMediaQuery";
import { desktopHelix as cfg, facing, frontTime, helixPoint, strandOf } from "./helixMath";
import { HelixMobile } from "./HelixMobile";

const CARD_W = 196;
const CARD_H = 246;
/** Viewport heights of scrolling per product. */
const VH_PER_PRODUCT = 22;

export function HelixShowcase({ products }: { products: Product[] }) {
  const rich = useRichMotion(1024);
  const short = useMediaQuery("(max-height: 860px)");
  const veryShort = useMediaQuery("(max-height: 760px)");
  const [focus, setFocus] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const fMax = frontTime(products.length - 1);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.5 });
  const f = useTransform(smooth, [0, 1], [0, fMax]);

  useMotionValueEvent(f, "change", (v) => {
    const next = Math.max(0, Math.min(products.length - 1, Math.round(v * 2)));
    setFocus((cur) => (cur === next ? cur : next));
  });

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = sectionRef.current;
      if (!el) return;
      const clamped = Math.max(0, Math.min(products.length - 1, index));
      const p = frontTime(clamped) / fMax;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const travel = el.offsetHeight - window.innerHeight;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: top + p * travel + 1, behavior: reduce ? "auto" : "smooth" });
    },
    [fMax, products.length],
  );

  const firstOfCategory = useMemo(() => {
    const map = new Map<ProductCategoryId, number>();
    products.forEach((p, i) => !map.has(p.category) && map.set(p.category, i));
    return map;
  }, [products]);

  const current = products[focus];

  if (!rich) {
    return (
      <div ref={sectionRef}>
        <HelixMobile products={products} />
      </div>
    );
  }

  // Rungs every half step across the whole run plus margins.
  const rungs: number[] = [];
  for (let t = -3; t <= fMax + 3; t += 0.5) rungs.push(t);

  return (
    <div ref={sectionRef} style={{ height: `calc(100svh + ${products.length * VH_PER_PRODUCT}vh)` }} className="relative">
      <div className="sticky top-0 flex h-[100svh] min-h-[700px] flex-col overflow-hidden pt-[calc(var(--nav-h)+28px)]">
        <div className="relative z-30 mx-auto w-full max-w-[1320px] px-8">
          <ProductCategoryNavigation active={current.category} onSelect={(id) => scrollToIndex(firstOfCategory.get(id) ?? 0)} />
        </div>

        <div className="relative mx-auto grid w-full max-w-[1320px] flex-1 grid-cols-[minmax(280px,0.8fr)_1.6fr_minmax(160px,0.5fr)] items-center px-8">
          {/* Focused product details */}
          <div className="relative z-20" aria-live="polite">
            <motion.div
              key={current.slug}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-brand">
                {String(focus + 1).padStart(2, "0")} / {String(products.length).padStart(2, "0")} · {getCategory(current.category).label}
              </p>
              <h3 className="mt-4 text-4xl font-medium tracking-[-0.03em] text-fg">{current.name}</h3>
              <p className="mt-3 max-w-xs text-[0.95rem] leading-relaxed text-fg-muted">{current.summary}</p>
              <p className="mt-5 text-lg text-fg">{formatPrice(current.price)}</p>
            </motion.div>
            <div className="mt-7 flex items-center gap-3">
              <Link
                href={`/products/${current.slug}`}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-fg px-5 text-[0.95rem] font-medium text-ink-950 transition-colors hover:opacity-90"
              >
                View product <ArrowUpRight className="size-4" aria-hidden />
              </Link>
              <button
                type="button"
                onClick={() => scrollToIndex(focus - 1)}
                disabled={focus === 0}
                aria-label="Previous product"
                className="grid size-11 place-items-center rounded-full border border-line-strong text-fg transition-colors hover:bg-[var(--inset)] disabled:opacity-30"
              >
                <ArrowLeft className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => scrollToIndex(focus + 1)}
                disabled={focus === products.length - 1}
                aria-label="Next product"
                className="grid size-11 place-items-center rounded-full border border-line-strong text-fg transition-colors hover:bg-[var(--inset)] disabled:opacity-30"
              >
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          {/* The helix */}
          <div className="relative h-full [perspective:1500px]" aria-hidden>
            <div
              className="absolute left-1/2 top-1/2 [transform-style:preserve-3d]"
              style={{ transform: `rotateZ(-7deg) scale(${veryShort ? 0.72 : short ? 0.84 : 1})` }}
            >
              {/* Axis glow */}
              <div className="absolute left-1/2 top-1/2 h-[140vh] w-px -translate-1/2 bg-gradient-to-b from-transparent via-brand/30 to-transparent" />
              {rungs.map((t) => (
                <Rung key={t} tau={t} f={f} />
              ))}
              {products.map((product, i) => (
                <HelixCard key={product.slug} product={product} index={i} f={f} focused={i === focus} />
              ))}
            </div>
          </div>

          {/* Strand legend */}
          <div className="relative z-20 hidden justify-self-end text-right xl:block">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-fg-dim">Scroll to turn</p>
            <div className="ml-auto mt-3 h-28 w-px overflow-hidden bg-line">
              <motion.div style={{ scaleY: smooth }} className="h-full w-full origin-top bg-brand" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HelixCard({ product, index, f, focused }: { product: Product; index: number; f: MotionValue<number>; focused: boolean }) {
  const tau = frontTime(index);
  const strand = strandOf(index);

  const transform = useTransform(f, (v) => {
    const { angle, y } = helixPoint(tau, strand, v, cfg);
    return `translate3d(${-CARD_W / 2}px, ${y - CARD_H / 2}px, 0) rotateY(${angle}deg) translateZ(${cfg.radius}px)`;
  });
  const opacity = useTransform(f, (v) => {
    const { angle, y } = helixPoint(tau, strand, v, cfg);
    const face = facing(angle);
    const vertical = Math.max(0, 1 - Math.max(0, Math.abs(y) - 260) / 220);
    return (face > 0 ? 0.25 + face * 0.75 : 0.08 + (face + 1) * 0.17) * vertical;
  });
  const pointerEvents = useTransform(f, (v) => (facing(helixPoint(tau, strand, v, cfg).angle) > 0.8 ? "auto" : "none"));

  return (
    <motion.div
      style={{ transform, opacity, pointerEvents, width: CARD_W, height: CARD_H }}
      className="absolute left-0 top-0 [backface-visibility:hidden] will-change-transform"
    >
      <div className={`h-full rounded-2xl transition-shadow duration-300 ${focused ? "shadow-[0_0_0_1px_rgb(55_47_99/0.6),0_0_50px_-6px_rgb(55_47_99/0.45)]" : ""}`}>
        <ProductCard product={product} interactive={false} />
      </div>
    </motion.div>
  );
}

function Rung({ tau, f }: { tau: number; f: MotionValue<number> }) {
  const transform = useTransform(f, (v) => {
    const { angle, y } = helixPoint(tau, 0, v, cfg);
    return `translate3d(${-cfg.radius}px, ${y}px, 0) rotateY(${angle + 90}deg)`;
  });
  const opacity = useTransform(f, (v) => {
    const { y } = helixPoint(tau, 0, v, cfg);
    return Math.max(0, 1 - Math.abs(y) / 520);
  });
  return (
    <motion.div style={{ transform, opacity, width: cfg.radius * 2 }} className="absolute left-0 top-0 flex h-px items-center justify-between">
      <span className="absolute inset-x-[6%] h-px bg-gradient-to-r from-brand/50 via-[var(--line)] to-brand/50" />
      <span className="relative size-1.5 rounded-full bg-brand/80 shadow-[0_0_8px_rgb(55_47_99/0.8)]" />
      <span className="relative size-1.5 rounded-full bg-brand/80 shadow-[0_0_8px_rgb(55_47_99/0.8)]" />
    </motion.div>
  );
}
