import { productCategories } from "@/data/products";
import { services } from "@/data/services";
import { Accent, Eyebrow } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { showcase } from "@/data/showcase";
import { SleeveFan } from "./about/SleeveFan";

const stats = [
  { value: String(productCategories.length), label: "Product categories" },
  { value: String(services.length), label: "Service lines" },
  { value: "1", label: "Counter for it all" },
];

export function AboutSection() {
  return (
    <section id="about" aria-labelledby="about-title" className="relative overflow-hidden border-t border-line bg-ink-950 py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-5 sm:px-8 lg:grid-cols-[1.2fr_1fr] lg:items-end lg:gap-16">
        <Reveal>
          <Eyebrow>About Jerry Computers</Eyebrow>
          <h2 id="about-title" className="mt-6 max-w-2xl text-balance text-4xl font-medium leading-[1.02] tracking-[-0.035em] text-fg sm:text-5xl lg:text-[4rem]">
            Hardware and help, in <Accent>one</Accent> place.
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="max-w-md text-pretty text-base leading-relaxed text-fg-muted sm:text-lg">
            We sell computer hardware and look after it — installation, repairs and maintenance from the same team, whether it&apos;s a laptop, a custom PC,
            CCTV, a printer or a UPS.
          </p>
          <dl className="mt-7 flex gap-10">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="text-3xl font-medium tracking-tight text-fg">{s.value}</dd>
                <dd aria-hidden className="mt-1 text-xs text-fg-muted">
                  {s.label}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>

      <Reveal delay={0.15} className="mx-auto mt-16 max-w-[1320px] px-5 sm:mt-20 sm:px-8">
        <SleeveFan sleeves={showcase} />
      </Reveal>
    </section>
  );
}
