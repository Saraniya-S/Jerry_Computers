import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Service } from "@/data/services";
import { ServiceVisual } from "./ServiceVisual";

/** `compact` trims vertical space so the orbiting grid fits laptop-height windows without shrinking. */
export function ServiceCard({ service, compact = false }: { service: Service; compact?: boolean }) {
  return (
    <article className={`group relative flex h-full flex-col rounded-2xl border border-[var(--card-edge)] bg-[linear-gradient(180deg,var(--card-top)_0%,var(--card-bottom)_100%)] shadow-[0_30px_60px_-30px_var(--shadow),inset_0_1px_0_var(--highlight)] transition-colors hover:border-brand/40 ${compact ? "p-4" : "p-5"}`}>
      <p className="flex items-center justify-between font-mono text-[0.65rem] uppercase tracking-[0.16em] text-fg-dim">
        <span>{service.label}</span>
        <span>{service.index}</span>
      </p>
      <div className={`flex items-center ${compact ? "mt-3 h-[88px]" : "mt-4 h-[104px]"} overflow-hidden rounded-xl border border-line bg-[var(--inset)] px-3.5`}>
        <div className="w-full">
          <ServiceVisual id={service.id} />
        </div>
      </div>
      <h3 className={`${compact ? "mt-3.5" : "mt-5"} text-[1.05rem] font-medium leading-snug tracking-tight text-fg`}>{service.title}</h3>
      <p className={`mt-1.5 flex-1 text-sm leading-relaxed text-fg-muted ${compact ? "line-clamp-2" : ""}`}>{service.description}</p>
      <Link
        href={`/services/${service.slug}`}
        className={`${compact ? "mt-3" : "mt-5"} inline-flex items-center gap-1.5 self-start text-sm font-medium text-fg transition-colors after:absolute after:inset-0 after:rounded-2xl hover:text-brand`}
      >
        View service <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </article>
  );
}
