"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef, type ReactNode } from "react";
import { Accent, Eyebrow } from "@/components/ui/SectionHeading";
import { useRichMotion } from "@/lib/useMediaQuery";
import { BurstVisual, CoverageVisual, LanesVisual, UpdatesVisual } from "./why/WhyVisuals";

type Reason = { tag: string; title: string; body: string; chips: string[]; visual: ReactNode };

const reasons: Reason[] = [
  {
    tag: "One counter",
    title: "Products and repairs, under one roof.",
    body: "Buy the hardware and get it installed, serviced or repaired by the same team — no juggling separate shops and technicians.",
    chips: ["Sales", "Service", "Installation"],
    visual: <BurstVisual />,
  },
  {
    tag: "Requests",
    title: "Service requests, handled properly.",
    body: "Every job is logged as a service request and moves through clear stages, from intake and diagnosis to repair and testing.",
    chips: ["Intake", "Diagnosis", "Testing"],
    visual: <LanesVisual />,
  },
  {
    tag: "Coverage",
    title: "Seven categories, one team.",
    body: "Laptops, desktops, components, CCTV, printers, UPS and accessories — supported by people who work across all of them.",
    chips: ["Computing", "Security", "Power"],
    visual: <CoverageVisual />,
  },
  {
    tag: "Updates",
    title: "Know where things stand.",
    body: "Clear updates on your orders and service requests, plus dedicated technical assistance when you have questions.",
    chips: ["Orders", "Service status", "Assistance"],
    visual: <UpdatesVisual />,
  },
];

/** `copy` overrides each reason's title and body from Admin → Homepage; tags, chips and visuals stay as designed. */
export function WhyChooseUsSection({ copy }: { copy?: { title: string; body: string }[] }) {
  const items = reasons.map((r, i) => ({ ...r, ...(copy?.[i] ?? {}) }));
  const rich = useRichMotion();
  const listRef = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: listRef, offset: ["start start", "end end"] });

  return (
    <section id="why" aria-labelledby="why-title" className="relative border-t border-line bg-[linear-gradient(180deg,var(--why-a)_0%,var(--why-b)_40%,var(--why-c)_100%)] py-24 sm:py-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <Eyebrow>Why choose us</Eyebrow>
        <h2 id="why-title" className="mt-5 max-w-3xl text-balance text-4xl font-medium leading-[1.02] tracking-[-0.035em] text-fg sm:text-6xl lg:text-[4.2rem]">
          Buy it, fix it, keep it running — one <Accent>single</Accent> place.
        </h2>

        <ol ref={listRef} className="mt-14 space-y-6 sm:mt-20 md:space-y-0">
          {items.map((reason, i) => (
            <StackCard key={reason.tag} reason={reason} index={i} total={items.length} progress={scrollYProgress} rich={rich} />
          ))}
        </ol>

        <WordReveal
          className="mt-28 max-w-4xl sm:mt-36"
          text="Technology keeps getting more capable — and more complicated. Buying it, fixing it and keeping it running"
          accent="shouldn't be."
          rich={rich}
        />
      </div>
    </section>
  );
}

function StackCard({ reason, index, total, progress, rich }: { reason: Reason; index: number; total: number; progress: MotionValue<number>; rich: boolean }) {
  const target = 1 - (total - 1 - index) * 0.045;
  const scale = useTransform(progress, [index / total, 1], [1, target]);

  return (
    <li className={rich ? `sticky ${index === total - 1 ? "" : "h-[78vh] min-h-[520px]"}` : ""} style={rich ? { top: `calc(var(--nav-h) + 24px + ${index * 18}px)` } : undefined}>
      <motion.article
        style={rich ? { scale, transformOrigin: "top center" } : undefined}
        className="relative grid overflow-hidden rounded-[28px] border border-[var(--card-edge)] bg-[linear-gradient(135deg,var(--stack-a)_0%,var(--stack-b)_45%,var(--stack-c)_100%)] p-3 shadow-[0_-20px_60px_-20px_var(--shadow),inset_0_1px_0_var(--highlight)] md:h-[460px] md:grid-cols-[0.95fr_1.05fr]"
      >
        <div className="flex flex-col p-5 sm:p-8">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-brand">
            0{index + 1} / {reason.tag}
          </p>
          <h3 className="mt-5 max-w-sm text-balance text-3xl font-medium leading-[1.08] tracking-[-0.03em] text-fg sm:text-[2.4rem]">{reason.title}</h3>
          <p className="mt-4 max-w-sm text-[0.95rem] leading-relaxed text-fg-muted">{reason.body}</p>
          <ul className="mt-8 flex flex-wrap gap-2 md:mt-auto">
            {reason.chips.map((c) => (
              <li key={c} className="rounded-md border border-line-strong bg-[var(--inset)] px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-fg-muted">
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div data-surface="dark" className="relative min-h-[260px] overflow-hidden rounded-[20px] border border-white/[0.08] bg-ink-950">{reason.visual}</div>
      </motion.article>
    </li>
  );
}

function WordReveal({ text, accent, className, rich }: { text: string; accent: string; className?: string; rich: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 45%"] });
  const words = [...text.split(" ").map((w) => ({ w, accent: false })), ...accent.split(" ").map((w) => ({ w, accent: true }))];

  return (
    <p ref={ref} className={`text-balance text-3xl font-medium leading-[1.15] tracking-[-0.03em] sm:text-5xl ${className}`}>
      {words.map(({ w, accent: isAccent }, i) => (
        <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} rich={rich} accent={isAccent}>
          {w}
        </Word>
      ))}
    </p>
  );
}

function Word({ children, progress, range, rich, accent }: { children: string; progress: MotionValue<number>; range: [number, number]; rich: boolean; accent: boolean }) {
  const opacity = useTransform(progress, range, [0.18, 1]);
  return (
    <>
      <motion.span style={rich ? { opacity } : undefined} className={accent ? "font-serif font-normal italic text-fg" : "text-fg"}>
        {children}
      </motion.span>{" "}
    </>
  );
}
