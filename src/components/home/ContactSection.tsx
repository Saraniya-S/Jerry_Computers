import Link from "next/link";
import { ArrowUpRight, Clock, Mail, MapPin, MessageSquare, Phone, Wrench, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { telHref } from "@/config/site";
import { Accented } from "@/components/ui/Accented";
import { getSettings } from "@/lib/server/settings";
import { shopContact } from "@/lib/settings";
import { Eyebrow } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";

const pending = <span className="text-fg-dim">To be confirmed</span>;

export async function ContactSection() {
  const [shop, home] = await Promise.all([getSettings("shop"), getSettings("home")]);
  const c = shopContact(shop);
  const generalHref = c.email ? `mailto:${c.email}` : c.phone ? telHref(c.phone) : null;
  const serviceHref = "/services/request";

  return (
    <section id="contact" aria-labelledby="contact-title" className="relative overflow-hidden border-t border-line bg-ink-950 py-24 sm:py-32">
      <div aria-hidden className="pointer-events-none absolute -left-40 top-20 h-[420px] w-[620px] rounded-full bg-[radial-gradient(closest-side,rgb(184_220_181/0.45),transparent)]" />
      <div className="relative mx-auto grid max-w-[1320px] gap-14 px-5 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <Reveal>
          <Eyebrow>Contact</Eyebrow>
          <h2 id="contact-title" className="mt-5 max-w-xl text-balance text-4xl font-medium leading-[1.02] tracking-[-0.035em] text-fg sm:text-6xl">
            <Accented text={home.contactTitle} />
          </h2>
          <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-fg-muted sm:text-lg">
            {home.contactBody}
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <EnquiryCard
              icon={MessageSquare}
              title="General enquiries"
              body="Products, availability, quotes and custom builds."
              href={generalHref}
              cta={c.email ? "Email us" : c.phone ? "Call us" : "Contact details coming soon"}
            />
            <EnquiryCard icon={Wrench} title="Service enquiries" body="Repairs, installation and maintenance requests." href={serviceHref} cta="Request a service" />
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <dl className="divide-y divide-line rounded-3xl border border-line bg-ink-900/60">
            <Detail icon={MapPin} label="Shop location">
              {c.address ? <span className="whitespace-pre-line">{c.address}</span> : pending}
              {c.mapUrl && (
                <a href={c.mapUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-brand hover:underline">
                  Open in maps <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
              )}
            </Detail>
            <Detail icon={Phone} label="Phone">
              {c.phone ? (
                <a href={telHref(c.phone)} className="hover:text-brand">
                  {c.phone}
                </a>
              ) : (
                pending
              )}
            </Detail>
            <Detail icon={Mail} label="Email">
              {c.email ? (
                <a href={`mailto:${c.email}`} className="hover:text-brand">
                  {c.email}
                </a>
              ) : (
                pending
              )}
            </Detail>
            <Detail icon={Clock} label="Business hours">
              {c.hours.length ? (
                <ul className="space-y-1">
                  {c.hours.map((h) => (
                    <li key={h.days} className="flex justify-between gap-6">
                      <span className="text-fg-muted">{h.days}</span>
                      <span>{h.hours}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                pending
              )}
            </Detail>
          </dl>
        </Reveal>
      </div>
    </section>
  );
}

function Detail({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 p-6 sm:p-7">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-ink-850 text-fg-muted">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-fg-dim">{label}</dt>
        <dd className="mt-1.5 flex flex-col text-[0.98rem] text-fg">{children}</dd>
      </div>
    </div>
  );
}

function EnquiryCard({ icon: Icon, title, body, href, cta }: { icon: LucideIcon; title: string; body: string; href: string | null; cta: string }) {
  const inner = (
    <>
      <Icon className="size-5 text-brand" aria-hidden />
      <p className="mt-6 text-lg font-medium tracking-tight text-fg">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{body}</p>
      <p className={`mt-6 inline-flex items-center gap-1.5 text-sm font-medium ${href ? "text-fg group-hover:text-brand" : "text-fg-dim"}`}>
        {cta} {href && <ArrowUpRight className="size-4" aria-hidden />}
      </p>
    </>
  );
  const cls = "group block rounded-2xl border border-line bg-ink-900/60 p-6 transition-colors";
  if (!href) return <div className={cls}>{inner}</div>;
  return (
    <Link href={href} className={`${cls} hover:border-line-strong`}>
      {inner}
    </Link>
  );
}
