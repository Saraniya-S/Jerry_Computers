import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { formatPhone, navLinks, policyLinks, site, telHref } from "@/config/site";
import { productCategories } from "@/data/products";
import { serviceRequestHref } from "@/data/services";
import { getServices } from "@/lib/server/services";
import { getSettings } from "@/lib/server/settings";
import { shopContact } from "@/lib/settings";
import { Logo } from "@/components/ui/Logo";
import { SocialIcon } from "@/components/ui/SocialIcon";

export async function HomeFooter() {
  const [services, shop] = await Promise.all([getServices(), getSettings("shop")]);
  const c = shopContact(shop);
  const columns = [
    { title: "Navigate", links: navLinks.map((l) => ({ label: l.label, href: l.href })) },
    { title: "Products", links: productCategories.map((p) => ({ label: p.label, href: `/products?category=${p.id}` })) },
    { title: "Services", links: services.map((s) => ({ label: s.title.replace(/ and .*/, ""), href: serviceRequestHref(s.slug) })) },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-line bg-ink-950">
      <div className="mx-auto max-w-[1320px] px-5 pb-10 pt-20 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_repeat(3,1fr)_1.1fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-fg-muted">{site.description}</p>
            {c.social.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-2.5">
                {c.social.map((s) => (
                  <li key={s.href}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      title={s.label}
                      className="grid size-10 place-items-center rounded-full border border-line bg-ink-900/60 text-fg-muted transition-colors hover:border-brand/40 hover:bg-brand/[0.06] hover:text-brand"
                    >
                      <SocialIcon href={s.href} label={s.label} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-fg-dim">{col.title}</p>
              <ul className="mt-5 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-fg-muted transition-colors hover:text-fg">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-fg-dim">Contact</p>
            <ul className="mt-5 space-y-3.5 text-sm text-fg-muted">
              <ContactRow icon={MapPin} label="Address">
                {c.address ? (
                  c.mapUrl ? (
                    <a href={c.mapUrl} target="_blank" rel="noopener noreferrer" className="whitespace-pre-line hover:text-fg">
                      {c.address}
                    </a>
                  ) : (
                    <span className="whitespace-pre-line">{c.address}</span>
                  )
                ) : (
                  "Address to be confirmed"
                )}
              </ContactRow>
              <ContactRow icon={Phone} label="Phone">
                {c.phones.length
                  ? c.phones.map((p) => (
                      <a key={p} href={telHref(p)} className="block w-fit tabular-nums hover:text-fg">
                        {formatPhone(p)}
                      </a>
                    ))
                  : (c.phone ?? "Phone to be confirmed")}
              </ContactRow>
              <ContactRow icon={Mail} label="Email">
                {c.email ? (
                  <a href={`mailto:${c.email}`} className="break-all hover:text-fg">
                    {c.email}
                  </a>
                ) : (
                  "Email to be confirmed"
                )}
              </ContactRow>
            </ul>
          </div>
        </div>

        {/* Oversized wordmark */}
        <p aria-hidden className="mt-20 select-none bg-gradient-to-b from-[var(--wordmark)] to-transparent bg-clip-text text-center text-[22vw] font-semibold leading-[0.8] tracking-[-0.06em] text-transparent lg:text-[17rem]">
          Jerry
        </p>

        <div className="mt-6 flex flex-col gap-4 border-t border-line pt-6 text-xs text-fg-dim md:flex-row md:items-center md:justify-between">
          <p>
            © <CurrentYear /> {site.name}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {policyLinks.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="hover:text-fg">
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

async function CurrentYear() {
  "use cache";
  return new Date().getFullYear();
}

function ContactRow({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
      <span className="sr-only">{label}: </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}
