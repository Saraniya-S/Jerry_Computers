import Link from "next/link";
import { navLinks, policyLinks, site, telHref } from "@/config/site";
import { productCategories } from "@/data/products";
import { serviceRequestHref } from "@/data/services";
import { getServices } from "@/lib/server/services";
import { getSettings } from "@/lib/server/settings";
import { shopContact } from "@/lib/settings";
import { Logo } from "@/components/ui/Logo";

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
              <ul className="mt-6 flex gap-4">
                {c.social.map((s) => (
                  <li key={s.href}>
                    <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-sm text-fg-muted hover:text-fg">
                      {s.label}
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
            <ul className="mt-5 space-y-2.5 text-sm text-fg-muted">
              <li>{c.address ?? "Address to be confirmed"}</li>
              <li>{c.phone ? <a href={telHref(c.phone)} className="hover:text-fg">{c.phone}</a> : "Phone to be confirmed"}</li>
              <li>{c.email ? <a href={`mailto:${c.email}`} className="hover:text-fg">{c.email}</a> : "Email to be confirmed"}</li>
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
