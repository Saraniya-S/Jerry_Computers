import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { getServiceBySlug, getServices } from "@/lib/server/services";
import { PlaceholderPage } from "@/components/layout/PlaceholderPage";
import { ButtonLink } from "@/components/ui/Button";

export async function generateStaticParams() {
  return (await getServices()).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/services/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: (await getServiceBySlug(slug))?.title ?? "Service" };
}

export default async function ServicePage({ params }: PageProps<"/services/[slug]">) {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) notFound();

  return (
    <PlaceholderPage eyebrow={`Service ${service.index}`} title={service.title} intro={service.description}>
      <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-fg-dim">Typically includes</h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {service.includes.map((item) => (
          <li key={item} className="flex items-center gap-3 rounded-xl border border-line bg-ink-900/60 px-4 py-3.5 text-fg">
            <Check className="size-4 text-brand" aria-hidden /> {item}
          </li>
        ))}
      </ul>
      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href={`/services/request?service=${service.slug}`} variant="brand">
          Request this service
        </ButtonLink>
        <ButtonLink href="/#services" variant="outline">
          All services
        </ButtonLink>
      </div>
    </PlaceholderPage>
  );
}
