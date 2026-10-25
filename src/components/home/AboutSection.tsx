import { ArrowRight } from "lucide-react";
import { productCategories } from "@/data/products";
import { services } from "@/data/services";
import { ButtonLink } from "@/components/ui/Button";
import { Accent, Eyebrow } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { HubMap } from "./about/HubMap";

const pillars = [
  { k: "Buy", title: "Hardware that suits the job", body: "Laptops, desktops, custom builds, components, CCTV, printers, UPS and accessories." },
  { k: "Fix", title: "Repairs and diagnostics", body: "Fault-finding and repair for laptops, desktops, printers, CCTV and UPS equipment." },
  { k: "Maintain", title: "Support after the sale", body: "Installation, servicing and technical help for the equipment you rely on." },
];

export function AboutSection() {
  return (
    <section id="about" aria-labelledby="about-title" className="relative overflow-hidden border-t border-line bg-ink-950 py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1320px] items-center gap-16 px-5 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-10">
        <Reveal>
          <Eyebrow>About Jerry Computers</Eyebrow>
          <h2 id="about-title" className="mt-6 max-w-xl text-balance text-4xl font-medium leading-[1.04] tracking-[-0.035em] text-fg sm:text-5xl lg:text-[3.6rem]">
            Every device you run, looked after in <Accent>one</Accent> place.
          </h2>
          <p className="mt-6 max-w-lg text-pretty text-base leading-relaxed text-fg-muted sm:text-lg">
            Jerry Computers brings computer hardware and technical services together. Buy the right equipment, then come back to the same team for
            installation, repairs and maintenance — whether it&apos;s a laptop, a custom PC, a CCTV system, a printer or a UPS.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <ButtonLink href="#services">
              See our services <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <p className="inline-flex h-11 items-center gap-2.5 rounded-full border border-line px-4 text-sm text-fg-muted">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgb(52_211_153/0.8)]" />
              {productCategories.length} product categories · {services.length} service lines
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <HubMap />
        </Reveal>
      </div>

      <div className="mx-auto mt-24 max-w-[1320px] px-5 sm:px-8">
        <ol className="grid border-t border-line md:grid-cols-3">
          {pillars.map((p, i) => (
            <Reveal as="li" key={p.k} delay={i * 0.08} className="border-b border-line py-8 md:border-b-0 md:border-l md:px-8 md:first:border-l-0 md:first:pl-0">
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-copper">
                0{i + 1} — {p.k}
              </p>
              <h3 className="mt-4 text-xl font-medium tracking-tight text-fg">{p.title}</h3>
              <p className="mt-2 max-w-sm text-[0.95rem] leading-relaxed text-fg-muted">{p.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
