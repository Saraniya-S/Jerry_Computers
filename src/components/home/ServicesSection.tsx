"use client";

import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { services, type Service } from "@/data/services";
import { ServiceCard } from "@/components/services/ServiceCard";
import { ButtonLink } from "@/components/ui/Button";
import { Accent, Eyebrow } from "@/components/ui/SectionHeading";
import { LogoMark } from "@/components/ui/Logo";
import { useRichMotion } from "@/lib/useMediaQuery";

/** Scroll range over which the orbit folds into the grid. */
const ASSEMBLE: [number, number] = [0.32, 0.72];
/** Seconds per full orbit while idle. */
const ORBIT_PERIOD = 46;

type Stage = { w: number; h: number; visible: boolean };

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export function ServicesSection() {
  const rich = useRichMotion(1024, 820);
  const ref = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLUListElement>(null);
  const stage = useRef<Stage>({ w: 0, h: 0, visible: false });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });

  const markScale = useTransform(progress, [0, ASSEMBLE[1]], [1, 0.4]);
  const markOpacity = useTransform(progress, [ASSEMBLE[0] - 0.05, ASSEMBLE[1] - 0.12], [1, 0]);
  const markSpin = useMotionValue(0);
  const titleA = useTransform(progress, [0.46, 0.58], [1, 0]);
  const titleB = useTransform(progress, [0.52, 0.66], [0, 1]);
  const titleBy = useTransform(progress, [0.52, 0.66], [16, 0]);

  // Track the stage size and whether the section is on screen (the orbit idles otherwise).
  useEffect(() => {
    const el = stageRef.current;
    if (!rich || !el) return;
    const ro = new ResizeObserver(() => {
      stage.current.w = el.offsetWidth;
      stage.current.h = el.offsetHeight;
    });
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => (stage.current.visible = e.isIntersecting));
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, [rich]);

  useAnimationFrame((t) => {
    if (rich && stage.current.visible) markSpin.set(Math.sin(t / 2600) * 22);
  });

  return (
    <section id="services" aria-labelledby="services-title" className="relative border-t border-line bg-ink-900">
      <div ref={ref} className={rich ? "h-[280vh]" : ""}>
        <div className={`${rich ? "sticky top-0 flex h-[100svh] min-h-[720px] flex-col overflow-hidden" : "py-24"} grain`}>
          {/* Soft studio light behind the mark, as in the reference */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_55%_at_50%_52%,var(--spot),transparent_72%)]" />

          <div className={`relative z-20 mx-auto w-full max-w-[1320px] px-5 text-center sm:px-8 ${rich ? "pt-24" : ""}`}>
            <Eyebrow className="justify-center">Services</Eyebrow>
            <div className="relative mt-5">
              <motion.h2
                id="services-title"
                style={rich ? { opacity: titleA } : undefined}
                className="text-balance text-4xl font-medium tracking-[-0.035em] text-fg sm:text-5xl lg:text-6xl"
              >
                Every service, under <Accent>one</Accent> roof.
              </motion.h2>
              {rich && (
                <motion.p
                  aria-hidden
                  style={{ opacity: titleB, y: titleBy }}
                  className="absolute inset-x-0 top-0 text-balance text-4xl font-medium tracking-[-0.035em] text-fg sm:text-5xl lg:text-6xl"
                >
                  Pick what you <Accent>need.</Accent>
                </motion.p>
              )}
            </div>
            {!rich && (
              <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-fg-muted sm:text-lg">
                Repairs, installation and maintenance for the equipment we sell — and the equipment you already own.
              </p>
            )}
          </div>

          <div className={`relative mx-auto w-full max-w-[1080px] px-5 sm:px-8 ${rich ? "mt-6 flex flex-1 items-center pb-8" : "mt-14"}`}>
            {rich && (
              <motion.div
                aria-hidden
                style={{ scale: markScale, opacity: markOpacity }}
                className="pointer-events-none absolute left-1/2 top-1/2 z-[5] -translate-1/2 [perspective:600px]"
              >
                <div className="absolute inset-[-130%] rounded-full bg-[radial-gradient(closest-side,var(--mark-glow),rgb(233_162_95/0.14)_45%,transparent)]" />
                <motion.div style={{ rotateY: markSpin }}>
                  <LogoMark className="relative size-36 text-[var(--mark)] drop-shadow-[0_0_44px_var(--mark-glow)]" />
                </motion.div>
              </motion.div>
            )}

            <ul ref={stageRef} className="relative grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service, i) => (
                <OrbitItem key={service.id} service={service} index={i} count={services.length} progress={progress} stage={stage} enabled={rich} />
              ))}
            </ul>
          </div>

          {!rich && (
            <div className="mt-10 flex justify-center px-5">
              <ButtonLink href="/services/request" variant="outline">
                Request a service <ArrowUpRight className="size-4" aria-hidden />
              </ButtonLink>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

type OrbitItemProps = {
  service: Service;
  index: number;
  count: number;
  progress: MotionValue<number>;
  stage: RefObject<Stage>;
  enabled: boolean;
};

/**
 * One service card. While the section is at its start the card travels on a
 * tilted elliptical orbit around the mark (upright, nearer cards larger and
 * on top); scrolling folds the orbit into the card's own grid slot.
 */
function OrbitItem({ service, index, count, progress, stage, enabled }: OrbitItemProps) {
  const li = useRef<HTMLLIElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const opacity = useMotionValue(1);
  const zIndex = useMotionValue(10);
  const [interactive, setInteractive] = useState(true);
  const clock = useRef(0);

  useAnimationFrame((_, delta) => {
    const s = stage.current;
    const el = li.current;
    if (!enabled || !el || !s.visible || !s.w) return;

    const p = progress.get();
    const a = smooth(clamp01((p - ASSEMBLE[0] + index * 0.01) / (ASSEMBLE[1] - ASSEMBLE[0])));
    // Idle drift slows to a stop as the grid forms; scroll also turns the ring.
    clock.current += (delta / 1000) * (1 - a);
    const theta = (index / count) * Math.PI * 2 - Math.PI / 2 + (clock.current / ORBIT_PERIOD) * Math.PI * 2 + p * Math.PI * 0.9;

    const rx = Math.min(s.w * 0.4, 440);
    const ry = Math.min(s.h * 0.42, 230);
    const ox = Math.cos(theta) * rx;
    const oy = Math.sin(theta) * ry;
    const depth = (Math.sin(theta) + 1) / 2; // 0 = back (top), 1 = front (bottom)

    const slotX = el.offsetLeft + el.offsetWidth / 2 - s.w / 2;
    const slotY = el.offsetTop + el.offsetHeight / 2 - s.h / 2;

    x.set((ox - slotX) * (1 - a));
    y.set((oy - slotY) * (1 - a));
    scale.set(0.58 + depth * 0.2 + (1 - (0.58 + depth * 0.2)) * a);
    opacity.set(0.55 + depth * 0.45 + (1 - (0.55 + depth * 0.45)) * a);
    zIndex.set(a > 0.9 ? 10 : depth > 0.45 ? 10 + Math.round(depth * 10) : Math.round(depth * 4));

    const canClick = a > 0.85;
    if (canClick !== interactive) setInteractive(canClick);
  });

  return (
    <motion.li
      ref={li}
      style={enabled ? { x, y, scale, opacity, zIndex } : undefined}
      className={enabled && !interactive ? "pointer-events-none" : undefined}
    >
      <ServiceCard service={service} />
    </motion.li>
  );
}
