"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type OrbitItem = { src: string; alt: string; title?: string; subtitle?: string };
type View = "ring" | "arc";

type Props = {
  items: OrbitItem[];
  /** Cards around the wheel; rounded to whole passes through the items. */
  count?: number;
  defaultView?: View;
  /** Ring rotation in degrees per second. */
  spin?: number;
  autoplay?: boolean;
  /** Seconds between autoplay steps in the arc view. */
  interval?: number;
  /** Arc-view wheel size relative to the cards; larger flattens the arc. */
  arc?: number;
  /** Vertical position of the top card in the arc view, 0 (top) to 1 (bottom). */
  apex?: number;
  /** Card width / height. */
  aspect?: number;
  /** Space between neighbouring cards as a fraction of their spacing. */
  gap?: number;
  accentColor?: string;
  backgroundColor?: string;
  /** Content centred inside the ring; fades out in the arc view. */
  children?: ReactNode;
  className?: string;
};

const TAU = Math.PI * 2;
const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * A turning wheel of cards that sweeps into an arc, after ReactBits Pro "Orbit Reel".
 * Ring view spins slowly; clicking a card zooms into the arc with it on top, where the reel
 * autoplays with captions and controls. Escape or a click on the background zooms back out.
 * Drag to turn either view. Cards flip over in a wave when the view changes.
 */
export function OrbitReel({
  items,
  count = 16,
  defaultView = "arc",
  spin = 8,
  autoplay = true,
  interval = 3.5,
  arc = 1,
  apex = 0.44,
  aspect = 0.8,
  gap = 0.18,
  accentColor = "#372f63",
  backgroundColor = "transparent",
  children,
  className = "",
}: Props) {
  const reduce = useReducedMotion();
  const n = Math.max(items.length, Math.round(count / items.length) * items.length);
  const step = 360 / n;

  const rootRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const flipRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>(defaultView);
  const [active, setActive] = useState(0);

  // Animation state lives in a ref so the frame loop never re-renders React.
  const s = useRef({
    theta: 0,
    targetTheta: 0,
    t: defaultView === "arc" ? 1 : 0,
    hovering: false,
    drag: null as null | { x: number; y: number; theta: number; moved: boolean },
    lastStep: 0,
  });

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;
  // Arc-view card, and the wheel it rides on.
  const arcCardH = Math.min(h * 0.5, (w * 0.52) / aspect);
  const arcCardW = arcCardH * aspect;
  const arcRadius = (n * (arcCardW / (1 - gap)) * arc) / TAU;
  // Ring-view wheel and the card scale that fits it.
  const ringRadius = Math.min(w, h) * 0.36;
  const ringCardW = ((TAU * ringRadius) / n) * (1 - gap);
  const ringScale = ringCardW / arcCardW;

  const goTo = useCallback(
    (index: number) => {
      const st = s.current;
      const desired = -index * step;
      st.targetTheta = st.theta + (mod(desired - st.theta + 180, 360) - 180);
      st.lastStep = performance.now();
    },
    [step],
  );

  const flipWave = useCallback(
    (from: number) => {
      if (reduce) return;
      flipRefs.current.forEach((el, i) => {
        if (!el) return;
        const d = Math.min(mod(i - from, n), mod(from - i, n));
        el.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }, { transform: "rotateY(360deg)" }], {
          duration: 900,
          delay: d * 45,
          easing: "cubic-bezier(0.65, 0, 0.35, 1)",
        });
      });
    },
    [n, reduce],
  );

  const changeView = useCallback(
    (next: View, index?: number) => {
      if (next === "arc" && index !== undefined) goTo(index);
      setView(next);
      flipWave(index ?? mod(Math.round(-s.current.theta / step), n));
    },
    [goTo, flipWave, step, n],
  );

  // Frame loop: ease the view and angle, spin the ring, autoplay the arc, place the cards.
  useEffect(() => {
    if (!w || !h) return;
    let raf = 0;
    let last = performance.now();
    let lastFlip = last;
    const st = s.current;
    const targetT = view === "arc" ? 1 : 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = reduce ? 1 : 1 - Math.exp(-dt * 5);

      st.t += (targetT - st.t) * k;
      if (!st.drag) {
        if (view === "ring" && !st.hovering && !reduce) {
          st.theta += spin * dt;
          st.targetTheta = st.theta;
          if (now - lastFlip > 7000) {
            lastFlip = now;
            flipWave(mod(Math.round(-st.theta / step), n));
          }
        } else {
          if (view === "arc" && autoplay && !reduce && !st.hovering && now - st.lastStep > interval * 1000) {
            st.targetTheta -= step;
            st.lastStep = now;
          }
          st.theta += (st.targetTheta - st.theta) * (reduce ? 1 : 1 - Math.exp(-dt * 7));
        }
      }

      const t = st.t;
      const radius = ringRadius + (arcRadius - ringRadius) * t;
      const cx = w / 2;
      const cy = h / 2 + (apex * h + arcRadius - h / 2) * t;
      const scale = ringScale + (1 - ringScale) * t;
      const top = mod(Math.round(-st.theta / step), n);

      for (let i = 0; i < n; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        const a = st.theta + i * step;
        const r = (a * Math.PI) / 180;
        const x = cx + radius * Math.sin(r);
        const y = cy - radius * Math.cos(r);
        el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${a}deg) scale(${scale})`;
        const d = Math.min(mod(i - top, n), mod(top - i, n));
        el.style.zIndex = String(n - d);
        // In the arc, cards far down the wheel are off screen; skip their paint.
        el.style.visibility = t > 0.9 && d > 4 ? "hidden" : "visible";
      }

      setActive((prev) => (prev === top ? prev : top));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [w, h, view, n, step, spin, autoplay, interval, apex, arcRadius, ringRadius, ringScale, reduce, flipWave]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && view === "arc") changeView("ring");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, changeView]);

  // Drag: sideways along the arc, around the centre in the ring.
  const onPointerDown = (e: React.PointerEvent) => {
    s.current.drag = { x: e.clientX, y: e.clientY, theta: s.current.theta, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const st = s.current;
    const drag = st.drag;
    if (!drag || !rootRef.current) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.hypot(dx, e.clientY - drag.y) < 6) return;
    if (!drag.moved) rootRef.current.setPointerCapture(e.pointerId);
    drag.moved = true;
    const radius = view === "arc" ? arcRadius : ringRadius;
    st.theta = drag.theta + ((dx / radius) * 180) / Math.PI;
    st.targetTheta = st.theta;
  };
  const onPointerUp = () => {
    const st = s.current;
    if (st.drag?.moved && view === "arc") goTo(mod(Math.round(-st.theta / step), n));
    // Let the click handler see whether this was a drag, then clear it.
    setTimeout(() => (st.drag = null));
  };

  const onCardClick = (i: number) => {
    if (s.current.drag?.moved) return;
    if (view === "ring") changeView("arc", i);
    else goTo(i);
  };

  const item = items[active % items.length];
  const isArc = view === "arc";

  return (
    <div
      ref={rootRef}
      className={`relative h-full min-h-[420px] w-full touch-pan-y select-none overflow-hidden ${className}`}
      style={{ backgroundColor }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Orbit reel of our product categories. Click a card to bring it forward, drag to turn, press Escape to see the whole ring."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => {
        if (e.target === e.currentTarget && isArc && !s.current.drag?.moved) changeView("ring");
      }}
    >
      {w > 0 && (
        <div className="pointer-events-none absolute inset-0" style={{ perspective: 1400 }}>
          {Array.from({ length: n }, (_, i) => {
            const it = items[i % items.length];
            return (
              <button
                key={i}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                type="button"
                tabIndex={isArc && i === active ? 0 : -1}
                aria-label={it.title ?? it.alt}
                onClick={() => onCardClick(i)}
                onPointerEnter={() => (s.current.hovering = true)}
                onPointerLeave={() => (s.current.hovering = false)}
                className="pointer-events-auto absolute left-0 top-0 cursor-pointer [transform-style:preserve-3d] will-change-transform"
                style={{ width: arcCardW, height: arcCardW / aspect, marginLeft: -arcCardW / 2, marginTop: -arcCardW / aspect / 2 }}
              >
                <span
                  ref={(el) => {
                    flipRefs.current[i] = el;
                  }}
                  className="absolute inset-0 [transform-style:preserve-3d]"
                >
                  <span
                    className="absolute inset-0 overflow-hidden rounded-[7%/5.6%] bg-ink-800 [backface-visibility:hidden]"
                    style={{ boxShadow: "0 22px 44px -20px var(--shadow), 0 2px 6px -2px var(--shadow)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- transformed every frame; next/image adds nothing here */}
                    <img src={it.src} alt="" draggable={false} className="pointer-events-none size-full object-cover" />
                  </span>
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-[7%/5.6%] [backface-visibility:hidden] [transform:rotateY(180deg)]"
                    style={{
                      background: `linear-gradient(155deg, color-mix(in oklch, ${accentColor} 75%, white) 0%, ${accentColor} 50%, color-mix(in oklch, ${accentColor} 70%, black) 100%)`,
                    }}
                  />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {children && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-500"
          style={{ opacity: isArc ? 0 : 1 }}
          aria-hidden={isArc}
        >
          {children}
        </div>
      )}

      <div
        className="absolute inset-x-0 flex flex-col items-center px-6 text-center transition-opacity duration-500"
        style={{ top: apex * h + arcCardH / 2 + 28, opacity: isArc ? 1 : 0, pointerEvents: isArc ? "auto" : "none" }}
        aria-hidden={!isArc}
      >
        <div aria-live="polite">
          <p className="text-lg font-semibold tracking-[-0.01em] text-fg">{item.title}</p>
          <p className="mt-0.5 text-sm text-fg-muted">{item.subtitle}</p>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            className="grid size-9 place-items-center rounded-full border border-line bg-ink-850 text-fg transition-colors hover:bg-ink-900"
            aria-label="Previous"
            tabIndex={isArc ? 0 : -1}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="w-14 font-mono text-xs tabular-nums text-fg-muted">
            {String((active % items.length) + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            className="grid size-9 place-items-center rounded-full border border-line bg-ink-850 text-fg transition-colors hover:bg-ink-900"
            aria-label="Next"
            tabIndex={isArc ? 0 : -1}
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
