"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";

/**
 * Looping hero background video. Starts muted and inline, pauses while
 * off-screen or in a background tab, stays on the poster under
 * prefers-reduced-motion, and offers a pause control (WCAG 2.2.2).
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [userPaused, setUserPaused] = useState(false);
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [playing, setPlaying] = useState(false);

  const paused = userPaused || reducedMotion;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!paused && inView && tabVisible) {
      el.play().catch(() => {
        // Autoplay can be refused (e.g. low-power mode); the poster stays visible.
      });
    } else {
      el.pause();
    }
  }, [paused, inView, tabVisible]);

  return (
    <>
      <div className="absolute inset-0 -z-20">
        <video
          ref={ref}
          className="absolute inset-0 size-full object-cover object-[72%_center] md:object-[60%_center] lg:object-center"
          poster="/hero/hero-poster.webp"
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          tabIndex={-1}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        >
          <source src="/hero/hero-720.mp4" type="video/mp4" media="(max-width: 900px)" />
          <source src="/hero/hero-1080.mp4" type="video/mp4" />
        </video>
      </div>

      {!reducedMotion && (
        <button
          type="button"
          onClick={() => setUserPaused(playing)}
          aria-label={playing ? "Pause background video" : "Play background video"}
          className="absolute bottom-5 right-5 z-20 grid size-9 place-items-center rounded-full border border-line-strong bg-ink-950/60 text-fg-muted backdrop-blur transition-colors hover:text-fg sm:bottom-8 sm:right-8"
        >
          {playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
        </button>
      )}
    </>
  );
}
