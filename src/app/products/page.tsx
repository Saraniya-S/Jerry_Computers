import type { Metadata } from "next";
import { productCategories, products } from "@/data/products";
import { ProductCard } from "@/components/products/ProductCard";
import { PlaceholderPage } from "@/components/layout/PlaceholderPage";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <PlaceholderPage
      eyebrow="Products"
      title="All products"
      intro="Browse every category we stock."
      notice="This is a demonstration catalogue used while the product database is being connected. Items, names and imagery are placeholders, and prices are available on enquiry."
    >
      <div className="space-y-16">
        {productCategories.map((c) => (
          <section key={c.id} id={c.id} aria-labelledby={`cat-${c.id}`} className="scroll-mt-28">
            <h2 id={`cat-${c.id}`} className="text-2xl font-medium tracking-tight text-fg">
              {c.label}
            </h2>
            <p className="mt-1 text-sm text-fg-muted">{c.blurb}</p>
            <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products
                .filter((p) => p.category === c.id)
                .map((p) => (
                  <li key={p.slug}>
                    <ProductCard product={p} />
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </PlaceholderPage>
  );
}
