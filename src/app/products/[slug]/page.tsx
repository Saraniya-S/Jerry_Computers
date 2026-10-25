import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatPrice, getCategory, getProduct, products } from "@/data/products";
import { ProductArt } from "@/components/products/ProductArt";
import { PlaceholderPage } from "@/components/layout/PlaceholderPage";
import { ButtonLink } from "@/components/ui/Button";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: getProduct(slug)?.name ?? "Product" };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  return (
    <PlaceholderPage
      eyebrow={getCategory(product.category).label}
      title={product.name}
      intro={product.summary}
      notice="Demonstration product. Full specifications, availability and ordering will appear here once the catalogue is connected."
    >
      <div className="grid gap-10 md:grid-cols-2">
        <div className="aspect-[4/3] rounded-3xl border border-line bg-[radial-gradient(80%_80%_at_50%_30%,var(--art-a),var(--art-b))]">
          <ProductArt category={product.category} variant={product.variant} className="size-full p-6" title={product.name} />
        </div>
        <div>
          <p className="text-2xl text-fg">{formatPrice(product.price)}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/#contact">Enquire about this product</ButtonLink>
            <ButtonLink href="/products" variant="outline">
              All products
            </ButtonLink>
          </div>
        </div>
      </div>
    </PlaceholderPage>
  );
}
