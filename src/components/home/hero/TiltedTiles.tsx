"use client";

import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";

/** Settings after ReactBits' Tilted Tiles (columns, tilt, plane size, stagger…). */
const tiles = {
  columns: 16,
  /** Tiles per column before the loop repeats; raised at runtime so one copy always covers the column. */
  perColumn: 9,
  duration: 25,
  rotateX: 40,
  rotateY: 16,
  rotateZ: -20,
  perspective: 1600,
  /** Plane size relative to the container, with a pixel floor so phones still get decent tiles. */
  planeWidth: "max(280%, 1500px)",
  planeHeight: "max(260%, 1400px)",
  offsetX: -40,
  stagger: 0.2,
  gap: 8,
  fadeTop: 22,
  parallaxStrength: 8,
};

/**
 * A tilted wall of product-photo columns scrolling past, used behind the hero.
 * Columns loop with CSS transforms (GPU-composited), alternate direction, pause
 * while off-screen, and stay still under prefers-reduced-motion. The pointer
 * steers the tilt a little on devices with a mouse.
 */
export function TiltedTiles({ images, heroId }: { images: string[]; heroId: string }) {
  const reduce = useReducedMotion() ?? false;
  const wrapRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(true);
  const [perColumn, setPerColumn] = useState(tiles.perColumn);

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 60, damping: 18 });
  const sy = useSpring(py, { stiffness: 60, damping: 18 });
  const rotateX = useTransform(sy, (v) => tiles.rotateX - v * tiles.parallaxStrength);
  const rotateY = useTransform(sx, (v) => tiles.rotateY + v * tiles.parallaxStrength);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setRunning(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    const plane = planeRef.current;
    const ro = new ResizeObserver(() => {
      if (!plane) return;
      const tile = (plane.offsetWidth - tiles.gap * (tiles.columns - 1)) / tiles.columns + tiles.gap;
      setPerColumn(Math.max(tiles.perColumn, Math.ceil(plane.offsetHeight / tile) + 1));
    });
    if (plane) ro.observe(plane);
    return () => {
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const hero = document.getElementById(heroId);
    if (!hero || reduce) return;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = hero.getBoundingClientRect();
      px.set((e.clientX - r.left) / r.width - 0.5);
      py.set((e.clientY - r.top) / r.height - 0.5);
    };
    const leave = () => {
      px.set(0);
      py.set(0);
    };
    hero.addEventListener("pointermove", move);
    hero.addEventListener("pointerleave", leave);
    return () => {
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", leave);
    };
  }, [heroId, reduce, px, py]);

  const columns = Array.from({ length: tiles.columns }, (_, c) =>
    // Spread the photos so neighbouring columns never start on the same picture.
    Array.from({ length: perColumn }, (_, k) => images[(c * 5 + k * 7) % images.length]),
  );

  const fade = `linear-gradient(to bottom, transparent 0%, #000 ${tiles.fadeTop}%, #000 100%)`;

  return (
    <div ref={wrapRef} aria-hidden className="absolute inset-0 overflow-hidden" style={{ perspective: tiles.perspective }}>
      <motion.div
        ref={planeRef}
        className="absolute left-1/2 top-1/2"
        style={{
          width: tiles.planeWidth,
          height: tiles.planeHeight,
          x: "-50%",
          y: "-50%",
          translateX: tiles.offsetX,
          rotateX,
          rotateY,
          rotateZ: tiles.rotateZ,
          maskImage: fade,
          WebkitMaskImage: fade,
        }}
      >
        <div className="flex h-full" style={{ gap: tiles.gap }}>
          {columns.map((col, c) => {
            const reverse = c % 2 === 1;
            return (
              <div key={c} className="relative h-full min-w-0 flex-1 overflow-hidden">
                <div
                  className="flex flex-col will-change-transform"
                  style={{
                    gap: tiles.gap,
                    // One trailing gap so -50% is exactly one copy (tile + gap) × perColumn.
                    paddingBottom: tiles.gap,
                    animation: reduce ? undefined : `tiles-${reverse ? "down" : "up"} ${tiles.duration}s linear infinite`,
                    animationDelay: `${-((c * tiles.stagger) % 1) * tiles.duration}s`,
                    animationPlayState: running ? "running" : "paused",
                  }}
                >
                  {/* Two copies of the column so the loop is seamless */}
                  {[...col, ...col].map((src, k) => (
                    <div key={k} className="relative aspect-square w-full shrink-0 overflow-hidden bg-ink-800">
                      <Image src={src} alt="" fill sizes="(max-width: 768px) 120px, 220px" className="object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
