"use client";

import Link from "next/link";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type MotionValue,
} from "motion/react";
import { ArrowLeft, ArrowRight, ArrowUpRight, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatPrice, getCategory, type Product, type ProductCategoryId } from "@/data/products";
import { ProductArt } from "@/components/products/ProductArt";
import { ProductCategoryNavigation, type CategoryFilter } from "@/components/products/ProductCategoryNavigation";

/** Tuning, after the Elastic Reel reference (bar width, magnify, lift, influence…). */
const reel = {
  barWidth: 44,
  gap: 10,
  gapSmall: 4,
  barHeight: 0.55,
  magnify: 2.4,
  lift: 1.15,
  influence: 200,
  openSize: 0.9,
  /** Idle sweep speed in bars per second. */
  speed: 1.4,
  /** Pause the sweep this long after the visitor interacts. */
  idleDelay: 1600,
};

const tints: Record<ProductCategoryId, string> = {
  laptops: "linear-gradient(180deg,#ece9fb,#dcd7f3)",
  desktops: "linear-gradient(180deg,#e7f3e5,#d3e8d0)",
  components: "linear-gradient(180deg,#eef0f7,#dde1ee)",
  cctv: "linear-gradient(180deg,#e9f1ec,#d6e5db)",
  printers: "linear-gradient(180deg,#f2f1ec,#e4e2d9)",
  ups: "linear-gradient(180deg,#e8edf7,#d6deef)",
  accessories: "linear-gradient(180deg,#f0ebf6,#e1d8ec)",
};

type BarHandle = { tw: MotionValue<number>; th: MotionValue<number>; label: MotionValue<number> };

/**
 * A dock of narrow product "slices" that swell under the pointer (or a finger
 * dragged along it) and open into a full product tile on click. While idle, a
 * magnifying focus sweeps across the reel. Page scrolling is never captured.
 */
export function ElasticReel({ products: all }: { products: Product[] }) {
  const reduce = useReducedMotion() ?? false;
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const products = useMemo(() => (filter === "all" ? all : all.filter((p) => p.category === filter)), [all, filter]);
  const [open, setOpen] = useState<number | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const size = useRef({ w: 0, h: 0 });
  const bars = useRef<(BarHandle | null)[]>([]);
  const openRef = useRef<number | null>(null);
  const pointer = useRef({ x: null as number | null, hovering: false, dragging: false, startX: 0, moved: false });
  const lastInteract = useRef(-Infinity);
  const inView = useRef(false);

  const layout = useCallback(() => {
    const n = products.length;
    const { w } = size.current;
    const gap = window.innerWidth < 640 ? reel.gapSmall : reel.gap;
    const w0 = Math.max(4, Math.min(reel.barWidth, (w - gap * (n - 1)) / n));
    const total = n * w0 + gap * (n - 1);
    return { n, gap, w0, total, start: (w - total) / 2 };
  }, [products.length]);

  /** Set every bar's target size for a focus position (px from the stage's left edge). */
  const update = useCallback(
    (fx: number | null) => {
      const { w, h } = size.current;
      if (!w) return;
      const { n, gap, w0, start } = layout();
      const h0 = h * reel.barHeight;
      const current = openRef.current;

      if (current !== null) {
        const openH = h * reel.openSize;
        const openW = Math.min(openH, w * 0.62);
        const other = Math.max(3, Math.min(w0 * 0.7, (w - openW - gap * (n - 1)) / Math.max(1, n - 1)));
        bars.current.forEach((b, i) => {
          if (!b) return;
          b.tw.set(i === current ? openW : other);
          b.th.set(i === current ? openH : h0 * 0.8);
          b.label.set(0);
        });
        return;
      }

      const sigma = Math.min(reel.influence, w * 0.25) * 0.55;
      // Only the bar nearest the focus is labelled.
      const nearest = fx === null ? -1 : Math.round((fx - start - w0 / 2) / (w0 + gap));
      const gains = bars.current.map((_, i) => {
        const c = start + i * (w0 + gap) + w0 / 2;
        return fx === null ? 0 : Math.exp(-((c - fx) ** 2) / (2 * sigma * sigma));
      });
      const widths = gains.map((g) => w0 * (1 + (reel.magnify - 1) * g));
      // Keep the swollen row inside the stage on narrow screens.
      const room = w - gap * (n - 1);
      const sum = widths.reduce((acc, x) => acc + x, 0);
      const fit = sum > room ? room / sum : 1;
      bars.current.forEach((b, i) => {
        if (!b) return;
        b.tw.set(widths[i] * fit);
        b.th.set(h0 * (1 + (reel.lift - 1) * gains[i]));
        b.label.set(i === nearest ? 1 : 0);
      });
    },
    [layout],
  );

  const register = useCallback((i: number, handle: BarHandle | null) => {
    bars.current[i] = handle;
  }, []);

  // Measure the stage and watch visibility.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      size.current = { w: el.clientWidth, h: el.clientHeight };
      update(pointer.current.x);
    });
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => (inView.current = e.isIntersecting));
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, [update]);

  // Re-target whenever the open product or the filtered list changes.
  useEffect(() => {
    openRef.current = open;
    update(pointer.current.x);
  }, [open, products, update]);

  // Idle sweep: a magnifying focus glides back and forth across the reel.
  useAnimationFrame(() => {
    if (reduce || openRef.current !== null || pointer.current.hovering || !inView.current) return;
    const now = performance.now();
    if (now - lastInteract.current < reel.idleDelay) return;
    const { n, w0, total, start } = layout();
    const period = ((2 * n) / reel.speed) * 1000;
    const phase = (now % period) / period;
    const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2;
    const eased = 0.5 - 0.5 * Math.cos(tri * Math.PI);
    update(start + w0 / 2 + eased * (total - w0));
  });

  const step = useCallback(
    (dir: 1 | -1) => setOpen((o) => (o === null ? o : (o + dir + products.length) % products.length)),
    [products.length],
  );

  const localX = (e: PointerEvent<HTMLDivElement>) => e.clientX - e.currentTarget.getBoundingClientRect().left;

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = pointer.current;
    if (e.pointerType !== "mouse" && !p.dragging) return;
    const x = localX(e);
    if (p.dragging && Math.abs(x - p.startX) > 8) p.moved = true;
    p.x = x;
    p.hovering = true;
    lastInteract.current = performance.now();
    if (openRef.current === null) update(x);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    const p = pointer.current;
    p.dragging = true;
    p.moved = false;
    p.startX = localX(e);
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const p = pointer.current;
    if (!p.dragging) return;
    const dx = localX(e) - p.startX;
    if (openRef.current !== null && Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    p.dragging = false;
    p.hovering = false;
    p.x = null;
    lastInteract.current = performance.now();
    if (openRef.current === null) update(null);
  };

  const onPointerLeave = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    pointer.current.hovering = false;
    pointer.current.x = null;
    lastInteract.current = performance.now();
    if (openRef.current === null) update(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (open === null) return;
    if (e.key === "Escape") setOpen(null);
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
    else return;
    e.preventDefault();
  };

  const focusBar = (i: number) => {
    if (openRef.current !== null) return;
    const { w0, gap, start } = layout();
    lastInteract.current = performance.now();
    update(start + i * (w0 + gap) + w0 / 2);
  };

  const toggle = (i: number) => {
    if (pointer.current.moved) {
      pointer.current.moved = false;
      return;
    }
    lastInteract.current = performance.now();
    setOpen((o) => (o === i ? null : i));
  };

  const current = open !== null ? products[open] : null;

  return (
    <div>
      <ProductCategoryNavigation
        active={filter}
        onSelect={(id) => {
          setOpen(null);
          setFilter(id);
        }}
        className="px-5 sm:px-8"
      />

      <div
        ref={stageRef}
        role="group"
        aria-label="Product reel"
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
        className="relative mx-5 mt-10 h-[340px] touch-pan-y select-none sm:mx-8 sm:h-[400px] lg:h-[440px]"
      >
        <div className="absolute inset-0 flex items-center justify-center gap-1 sm:gap-2.5">
          {products.map((product, i) => (
            <ReelBar
              key={product.slug}
              product={product}
              index={i}
              register={register}
              reduce={reduce}
              isOpen={open === i}
              anyOpen={open !== null}
              onToggle={toggle}
              onFocusBar={focusBar}
            />
          ))}
        </div>
      </div>

      {/* Caption for the open product, or a hint while browsing */}
      <div className="mx-auto mt-6 flex min-h-[120px] max-w-xl flex-col items-center px-5 text-center" aria-live="polite">
        {current ? (
          <motion.div key={current.slug} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-brand">
              {getCategory(current.category).label} · {String((open ?? 0) + 1).padStart(2, "0")} / {String(products.length).padStart(2, "0")}
            </p>
            <h3 className="mt-2 text-2xl font-medium tracking-[-0.02em] text-fg sm:text-3xl">{current.name}</h3>
            <p className="mt-1.5 text-sm text-fg-muted">
              {current.summary} <span className="text-fg">{formatPrice(current.price)}</span>
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button type="button" onClick={() => step(-1)} aria-label="Previous product" className="grid size-10 place-items-center rounded-full border border-line-strong text-fg hover:bg-[var(--inset)]">
                <ArrowLeft className="size-4" aria-hidden />
              </button>
              <Link
                href={`/products/${current.slug}`}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-ink-950 transition-colors hover:bg-[var(--brand-hover)]"
              >
                View product <ArrowUpRight className="size-4" aria-hidden />
              </Link>
              <button type="button" onClick={() => step(1)} aria-label="Next product" className="grid size-10 place-items-center rounded-full border border-line-strong text-fg hover:bg-[var(--inset)]">
                <ArrowRight className="size-4" aria-hidden />
              </button>
              <button type="button" onClick={() => setOpen(null)} aria-label="Close product" className="grid size-10 place-items-center rounded-full text-fg-muted hover:text-fg">
                <X className="size-4" aria-hidden />
              </button>
            </div>
          </motion.div>
        ) : (
          <p className="pt-6 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-fg-dim">
            {products.length} products · hover or drag across the reel · tap one to open it
          </p>
        )}
      </div>
    </div>
  );
}

type ReelBarProps = {
  product: Product;
  index: number;
  register: (i: number, handle: BarHandle | null) => void;
  reduce: boolean;
  isOpen: boolean;
  anyOpen: boolean;
  onToggle: (i: number) => void;
  onFocusBar: (i: number) => void;
};

function ReelBar({ product, index, register, reduce, isOpen, anyOpen, onToggle, onFocusBar }: ReelBarProps) {
  const tw = useMotionValue(reel.barWidth);
  const th = useMotionValue(220);
  const label = useMotionValue(0);
  // Slightly under-damped so bars overshoot a touch and settle, like the reference's elasticity.
  const spring = reduce ? { stiffness: 2000, damping: 200 } : { stiffness: 320, damping: 21, mass: 0.9 };
  const width = useSpring(tw, spring);
  const height = useSpring(th, spring);
  const labelOpacity = useSpring(label, { stiffness: 400, damping: 40 });

  useEffect(() => {
    register(index, { tw, th, label });
    return () => register(index, null);
  }, [index, register, tw, th, label]);

  const dimmed = anyOpen && !isOpen;

  return (
    <div className="relative shrink-0">
      <motion.span
        aria-hidden
        style={{ opacity: anyOpen ? 0 : labelOpacity }}
        className="pointer-events-none absolute bottom-[calc(100%+12px)] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-line bg-ink-850 px-3 py-1 text-xs font-medium text-fg shadow-[0_8px_20px_-10px_var(--shadow)]"
      >
        {product.name}
      </motion.span>
      <motion.button
        type="button"
        onClick={() => onToggle(index)}
        onFocus={() => onFocusBar(index)}
        aria-label={isOpen ? `Close ${product.name}` : `Open ${product.name}`}
        aria-pressed={isOpen}
        style={{ width, height, backgroundImage: tints[product.category] }}
        className={`relative block overflow-hidden rounded-[12px] shadow-[0_18px_30px_-18px_var(--shadow)] transition-[filter,opacity] duration-300 ${
          dimmed ? "opacity-50 blur-[2px] hover:opacity-100 hover:blur-0" : ""
        }`}
      >
        {/* Narrow slice at rest; the full, uncropped product once open */}
        <ProductArt
          category={product.category}
          variant={product.variant}
          fit="cover"
          className={`absolute inset-0 size-full transition-opacity duration-500 ${isOpen ? "opacity-0" : "opacity-100"}`}
        />
        <ProductArt
          category={product.category}
          variant={product.variant}
          className={`absolute inset-0 size-full p-[8%] transition-opacity duration-500 ${isOpen ? "opacity-100" : "opacity-0"}`}
        />
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/50" />
      </motion.button>
    </div>
  );
}
