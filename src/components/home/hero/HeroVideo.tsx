"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useSiteTheme, type SiteTheme } from "@/lib/theme";

const sources: Record<SiteTheme, { poster: string; small: string; large: string }> = {
  dark: { poster: "/hero/hero-poster.webp", small: "/hero/hero-720.mp4", large: "/hero/hero-1080.mp4" },
  light: { poster: "/hero/hero-light-poster.webp", small: "/hero/hero-light-720.mp4", large: "/hero/hero-light-1080.mp4" },
};

/**
 * Looping hero background video, one per theme. Both are in the markup and
 * CSS (`.theme-dark-only` / `.theme-light-only`) shows the right one from the
 * first paint; only the visible one plays. Pauses while off-screen or in a
 * background tab, stays on the poster under prefers-reduced-motion, and offers
 * a pause control (WCAG 2.2.2).
 */
export function HeroVideo() {
  const theme = useSiteTheme();
  const refs = useRef<Record<SiteTheme, HTMLVideoElement | null>>({ dark: null, light: null });
  const wrapRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [userPaused, setUserPaused] = useState(false);
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [playing, setPlaying] = useState(false);

  const paused = userPaused || reducedMotion;

  useEffect(() => {
    const el = wrapRef.current;
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
    const active = refs.current[theme];
    const idle = refs.current[theme === "dark" ? "light" : "dark"];
    idle?.pause();
    if (!active) return;
    if (!paused && inView && tabVisible) {
      active.play().catch(() => {
        // Autoplay can be refused (e.g. low-power mode); the poster stays visible.
      });
    } else {
      active.pause();
    }
  }, [theme, paused, inView, tabVisible]);

  return (
    <>
      <div ref={wrapRef} className="absolute inset-0 -z-20">
        {(["dark", "light"] as const).map((t) => (
          <video
            key={t}
            ref={(el) => {
              refs.current[t] = el;
            }}
            className={`theme-${t}-only absolute inset-0 size-full object-cover object-[72%_center] md:object-[60%_center] lg:object-center`}
            poster={sources[t].poster}
            muted
            loop
            playsInline
            preload={t === theme ? "metadata" : "none"}
            aria-hidden
            tabIndex={-1}
            onPlay={() => t === theme && setPlaying(true)}
            onPause={() => t === theme && setPlaying(false)}
          >
            <source src={sources[t].small} type="video/mp4" media="(max-width: 900px)" />
            <source src={sources[t].large} type="video/mp4" />
          </video>
        ))}
      </div>

      {!reducedMotion && (
        <button
          type="button"
          onClick={() => setUserPaused(playing)}
          aria-label={playing ? "Pause background video" : "Play background video"}
          className="absolute bottom-5 right-5 z-20 grid size-9 place-items-center rounded-full border border-line-strong bg-ink-950/50 text-fg-muted backdrop-blur transition-colors hover:text-fg sm:bottom-8 sm:right-8"
        >
          {playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
        </button>
      )}
    </>
  );
}
