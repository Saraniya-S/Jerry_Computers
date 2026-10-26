"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type Sleeve = { image: string; title: string; subtitle: string };

/** Seconds between automatic turns while the fan is idle and on screen. */
const INTERVAL = 3.2;

/**
 * A fan of square "sleeves" (after ReactBits' About 15): the active one sits
 * front and centre with a spinning PC fan sliding out from behind it, the rest
 * fan away to either side. It turns on its own while visible, pauses on hover
 * or focus, and stays put under prefers-reduced-motion.
 */
export function SleeveFan({ sleeves }: { sleeves: Sleeve[] }) {
  const reduce = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const [cw, setCw] = useState(300);
  const wrapRef = useRef<HTMLDivElement>(null);
  const n = sleeves.length;

  const go = useCallback((dir: 1 | -1) => setActive((a) => (a + dir + n) % n), [n]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    // Card size follows the available width: ~300px on desktop, smaller on phones.
    const ro = new ResizeObserver(() => setCw(Math.round(Math.min(320, Math.max(170, el.clientWidth * 0.26)))));
    ro.observe(el);
    return () => {
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    if (reduce || paused || !inView) return;
    const t = window.setInterval(() => go(1), INTERVAL * 1000);
    return () => window.clearInterval(t);
  }, [reduce, paused, inView, go]);

  const current = sleeves[active];

  return (
    <div
      ref={wrapRef}
      onPointerEnter={(e) => e.pointerType === "mouse" && setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        else if (e.key === "ArrowLeft") go(-1);
      }}
      className="relative"
    >
      <div className="relative mx-auto [perspective:1400px]" style={{ height: cw * 1.12 }}>
        {sleeves.map((s, i) => {
          // Signed distance from the active card, wrapped so the fan is symmetric.
          let d = i - active;
          if (d > n / 2) d -= n;
          if (d < -n / 2) d += n;
          const ad = Math.abs(d);
          const sign = Math.sign(d);
          const x = ad === 0 ? 0 : sign * (cw * 0.5 + (ad - 1) * cw * 0.2);
          return (
            <motion.button
              key={s.title}
              type="button"
              onClick={() => (d === 0 ? undefined : setActive(i))}
              aria-label={d === 0 ? `${s.title} (showing)` : `Show ${s.title}`}
              aria-current={d === 0 ? "true" : undefined}
              tabIndex={d === 0 || ad === 1 ? 0 : -1}
              initial={false}
              animate={{
                x,
                y: ad * cw * 0.03,
                scale: 1 - ad * 0.1,
                rotateY: -sign * Math.min(ad, 3) * 9,
                rotateZ: sign * Math.min(ad, 3) * 2.5,
                opacity: ad > 3 ? 0 : 1,
              }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 170, damping: 24 }}
              style={{ width: cw, height: cw, zIndex: 20 - ad * 2, marginLeft: -cw / 2 }}
              className={`absolute left-1/2 top-0 overflow-hidden rounded-[18px] shadow-[0_30px_50px_-28px_var(--shadow)] ring-1 ring-black/5 ${
                d === 0 ? "cursor-default" : "cursor-pointer"
              }`}
            >
              <Image src={s.image} alt="" fill sizes={`${cw}px`} className="object-cover" />
              {d !== 0 && <span aria-hidden className="absolute inset-0 bg-ink-950/15" />}
            </motion.button>
          );
        })}

        {/* The "record": a PC fan that slides out from behind the active sleeve and spins */}
        <motion.div
          key={active}
          aria-hidden
          initial={reduce ? false : { x: 0 }}
          animate={{ x: cw * 0.3 }}
          transition={{ type: "spring", stiffness: 120, damping: 20, delay: reduce ? 0 : 0.15 }}
          className="absolute left-1/2 top-[4%]"
          style={{ width: cw * 0.92, height: cw * 0.92, marginLeft: -cw * 0.46, zIndex: 19 }}
        >
          <SpinningFan spin={!reduce && inView} />
        </motion.div>
      </div>

      {/* Caption + controls */}
      <div className="mt-8 flex items-center justify-center gap-5">
        <button type="button" onClick={() => go(-1)} aria-label="Previous" className="grid size-10 place-items-center rounded-full border border-line-strong text-fg hover:bg-[var(--inset)]">
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <div className="min-w-[12rem] text-center" aria-live="polite">
          <p className="text-base font-medium text-fg">{current.title}</p>
          <p className="mt-0.5 text-sm text-fg-muted">{current.subtitle}</p>
        </div>
        <button type="button" onClick={() => go(1)} aria-label="Next" className="grid size-10 place-items-center rounded-full border border-line-strong text-fg hover:bg-[var(--inset)]">
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>

    </div>
  );
}

/** A dark 120 mm-style fan disc whose blades turn continuously. */
function SpinningFan({ spin }: { spin: boolean }) {
  const blades = Array.from({ length: 9 }, (_, i) => i * 40);
  return (
    <div className="relative size-full rounded-full bg-[radial-gradient(circle,#2a2550_0%,#15122b_62%,#0d0b1c_100%)] shadow-[0_20px_40px_-20px_var(--shadow)] ring-1 ring-black/20">
      <motion.svg
        viewBox="-50 -50 100 100"
        className="absolute inset-[6%]"
        animate={spin ? { rotate: 360 } : { rotate: 0 }}
        transition={spin ? { duration: 2.4, ease: "linear", repeat: Infinity } : { duration: 0 }}
      >
        <circle r="47" fill="none" stroke="#b8dcb5" strokeOpacity="0.35" strokeWidth="1" />
        {blades.map((a) => (
          <path key={a} transform={`rotate(${a})`} d="M0,-9 C14,-14 30,-30 34,-44 C22,-40 10,-30 4,-10 Z" fill="#3a3466" stroke="#5a4fa0" strokeWidth="0.6" />
        ))}
        <circle r="11" fill="#1c1838" stroke="#b8dcb5" strokeOpacity="0.6" strokeWidth="1" />
        <circle r="4" fill="#b8dcb5" />
      </motion.svg>
    </div>
  );
}
