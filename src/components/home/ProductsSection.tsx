import { ArrowUpRight } from "lucide-react";
import { getFeaturedProducts, productCategories, type ProductCategoryId } from "@/data/products";
import { ElasticReel, type ReelItem } from "@/components/products/reel/ElasticReel";
import { ButtonLink } from "@/components/ui/Button";
import { Accent, Eyebrow } from "@/components/ui/SectionHeading";

const tints: Record<ProductCategoryId, string> = {
  laptops: "linear-gradient(180deg,#ece9fb,#d9d3f3)",
  desktops: "linear-gradient(180deg,#e7f3e5,#cfe6cb)",
  components: "linear-gradient(180deg,#eef0f7,#d9deed)",
  cctv: "linear-gradient(180deg,#e9f1ec,#d2e3d8)",
  printers: "linear-gradient(180deg,#f2f1ec,#e1ded3)",
  ups: "linear-gradient(180deg,#e8edf7,#d3dbee)",
  accessories: "linear-gradient(180deg,#f0ebf6,#ddd3eb)",
};

export function ProductsSection() {
  const products = getFeaturedProducts();
  const categories: ReelItem[] = productCategories.map((c) => {
    const count = products.filter((p) => p.category === c.id).length;
    return {
      key: c.id,
      title: c.label,
      eyebrow: `${count} ${count === 1 ? "product" : "products"}`,
      description: c.blurb,
      href: `/products#${c.id}`,
      cta: `Browse ${c.label}`,
      art: { category: c.id, variant: 0 },
      tint: tints[c.id],
    };
  });
  return (
    <section id="products" aria-labelledby="products-title" className="relative border-t border-line bg-[radial-gradient(70%_50%_at_60%_55%,var(--products-glow)_0%,var(--products-base)_70%)]">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-5 pt-24 sm:px-8 sm:pt-32 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <Eyebrow>Products</Eyebrow>
          <h2 id="products-title" className="mt-5 text-balance text-4xl font-medium leading-[1.02] tracking-[-0.035em] text-fg sm:text-5xl lg:text-6xl">
            Shop by <Accent>category.</Accent>
          </h2>
          <p className="mt-5 max-w-lg text-pretty text-base leading-relaxed text-fg-muted sm:text-lg">
            Seven categories, from laptops to UPS units. Run along the reel, open a category, and jump straight to its products.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <ButtonLink href="/products" variant="outline">
            View all products <ArrowUpRight className="size-4" aria-hidden />
          </ButtonLink>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-fg-dim">Demonstration catalogue · prices on enquiry</p>
        </div>
      </div>

      <div className="mx-auto max-w-[1320px] pb-20 pt-12 sm:pb-28">
        <ElasticReel items={categories} label="Product categories" />
      </div>

      {/* Crawlable links to every category in the reel */}
      <ul className="sr-only">
        {categories.map((c) => (
          <li key={c.key}>
            <a href={c.href}>{c.title}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
