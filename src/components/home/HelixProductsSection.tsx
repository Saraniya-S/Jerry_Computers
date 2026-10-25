import { ArrowUpRight } from "lucide-react";
import { getFeaturedProducts } from "@/data/products";
import { HelixShowcase } from "@/components/products/helix/HelixShowcase";
import { ButtonLink } from "@/components/ui/Button";
import { Accent, Eyebrow } from "@/components/ui/SectionHeading";

export function HelixProductsSection() {
  const products = getFeaturedProducts();
  return (
    <section id="products" aria-labelledby="products-title" className="relative border-t border-line bg-[radial-gradient(70%_50%_at_60%_55%,var(--helix-glow)_0%,var(--helix-base)_70%)]">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-5 pt-24 sm:px-8 sm:pt-32 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <Eyebrow>Products</Eyebrow>
          <h2 id="products-title" className="mt-5 text-balance text-4xl font-medium leading-[1.02] tracking-[-0.035em] text-fg sm:text-5xl lg:text-6xl">
            The whole range, <Accent>intertwined.</Accent>
          </h2>
          <p className="mt-5 max-w-lg text-pretty text-base leading-relaxed text-fg-muted sm:text-lg">
            Seven categories on two intertwining strands. Turn the helix, or jump straight to a category.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <ButtonLink href="/products" variant="outline">
            View all products <ArrowUpRight className="size-4" aria-hidden />
          </ButtonLink>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-fg-dim">Demonstration catalogue · prices on enquiry</p>
        </div>
      </div>

      <HelixShowcase products={products} />

      {/* Accessible, crawlable list of every product shown in the helix */}
      <ul className="sr-only">
        {products.map((p) => (
          <li key={p.slug}>
            <a href={`/products/${p.slug}`}>{p.name}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
