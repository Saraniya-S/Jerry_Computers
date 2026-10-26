import { ArrowRight, ArrowUpRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Accent } from "@/components/ui/SectionHeading";
import { HeroIntro, HeroIntroItem } from "./hero/HeroIntro";
import { HeroVideo } from "./hero/HeroVideo";

const pillars = ["Sales", "Repairs", "Installation", "Support"];

export function HeroSection() {
  return (
    <section id="home" aria-labelledby="hero-title" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ink-950 lg:min-h-[max(92svh,680px)]">
      {/* Looping background video + pause control */}
      <HeroVideo />

      {/* Contrast layers for the text column */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950/85 via-ink-950/70 to-ink-950/95 md:w-[62%] md:bg-gradient-to-r md:from-ink-950/95 md:via-ink-950/70 md:to-transparent" />
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-ink-950/90 via-ink-950/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-ink-950" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1320px] flex-1 flex-col justify-between px-5 pb-10 pt-32 sm:px-8 lg:pb-14 lg:pt-40">
        <HeroIntro className="max-w-xl lg:max-w-[min(45vw,600px)]">
          <HeroIntroItem>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-900/60 py-1 pl-1.5 pr-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-fg-muted backdrop-blur">
              <span className="rounded-full bg-brand/15 px-2 py-0.5 text-brand">New</span>
              Hardware &amp; service, one counter
            </p>
          </HeroIntroItem>
          <HeroIntroItem>
            <h1 id="hero-title" className="mt-7 text-balance text-[3.1rem] font-medium leading-[0.98] tracking-[-0.045em] text-fg sm:text-7xl lg:text-[5.4rem]">
              Technology that <Accent>works</Accent> for you.
            </h1>
          </HeroIntroItem>
          <HeroIntroItem>
            <p className="mt-6 max-w-md text-pretty text-base leading-relaxed text-fg-muted sm:text-lg">
              Premium computer hardware, expert repairs and reliable support — from laptops and custom PCs to CCTV, printers and UPS.
            </p>
          </HeroIntroItem>
        </HeroIntro>

        <HeroIntro className="mt-16 flex max-w-xl flex-col gap-8 lg:max-w-[45vw]" delay={0.5}>
          <HeroIntroItem className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <ButtonLink href="#products" size="lg">
              Explore Products <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/services/request" variant="ghost" className="text-[0.95rem]">
              Book a Service <ArrowUpRight className="size-4" aria-hidden />
            </ButtonLink>
          </HeroIntroItem>
          <HeroIntroItem>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[0.7rem] uppercase tracking-[0.16em]" aria-label="What we do">
              {pillars.map((p, i) => (
                <li key={p} className="flex items-center gap-2">
                  <span className="text-brand/80">0{i + 1}</span>
                  <span className="text-fg-muted">{p}</span>
                </li>
              ))}
            </ul>
          </HeroIntroItem>
        </HeroIntro>
      </div>
    </section>
  );
}
