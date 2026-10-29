import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileText, ShieldCheck, Truck, Wrench } from "lucide-react";
import { Suspense } from "react";
import { HomeFooter } from "@/components/home/HomeFooter";
import { Navbar } from "@/components/navigation/Navbar";
import { CatalogueCard } from "@/components/products/catalogue/CatalogueCard";
import { PriceTag } from "@/components/products/PriceTag";
import { ProductGallery } from "@/components/products/ProductGallery";
import { AddToCart } from "@/components/session/AddToCart";
import { getCategory } from "@/data/products";
import { getCatalogue, getProductBySlug } from "@/lib/server/catalogue";
import { getSettings } from "@/lib/server/settings";

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  return p ? { title: p.name, description: p.summary } : { title: "Product" };
}

export default function ProductPage({ params }: PageProps<"/products/[slug]">) {
  return (
    <>
      <Navbar />
      <main id="main" className="flex-1 bg-ink-950">
        <Suspense fallback={<ProductSkeleton />}>
          <Product params={params} />
        </Suspense>
      </main>
      <HomeFooter />
    </>
  );
}

async function Product({ params }: Pick<PageProps<"/products/[slug]">, "params">) {
  const { slug } = await params;
  const [product, catalogue, store] = await Promise.all([getProductBySlug(slug), getCatalogue(), getSettings("store")]);
  if (!product) notFound();
  const category = getCategory(product.category);
  const related = catalogue.filter((p) => p.category === product.category && p.slug !== product.slug).slice(0, 4);
  const priced = product.pricePaise !== null;

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-fg-muted">
        <Link href="/products" className="hover:text-fg">
          Products
        </Link>
        <ChevronRight className="size-3.5 text-fg-dim" aria-hidden />
        <Link href={`/products?category=${category.id}`} className="hover:text-fg">
          {category.label}
        </Link>
        <ChevronRight className="size-3.5 text-fg-dim" aria-hidden />
        <span aria-current="page" className="text-fg">
          {product.name}
        </span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <ProductGallery product={product} />

        <div className="lg:pt-4">
          <p className="text-sm font-medium text-brand">{product.brand ?? category.label}</p>
          <h1 className="mt-2 text-balance text-3xl font-medium tracking-[-0.03em] text-fg sm:text-4xl">{product.name}</h1>
          <p className="mt-3 text-lg leading-relaxed text-fg-muted">{product.summary}</p>

          <div className="mt-6 border-t border-line pt-6">
            <PriceTag product={product} size="lg" />
            {priced && <p className="mt-1 text-xs text-fg-dim">Inclusive of all taxes</p>}
            {priced && (
              <p className={`mt-3 text-sm font-medium ${product.stock > 5 ? "text-leaf-mid" : product.stock > 0 ? "text-amber-700" : "text-red-600"}`}>
                {product.stock > 5 ? "In stock" : product.stock > 0 ? `Only ${product.stock} left` : "Out of stock"}
              </p>
            )}
          </div>

          <div className="mt-6">
            {priced ? (
              <AddToCart slug={product.slug} stock={product.stock} />
            ) : (
              <Link href="/#contact" className="inline-flex h-12 items-center rounded-full bg-brand px-6 font-medium text-white hover:bg-[var(--brand-hover)]">
                Ask for a price
              </Link>
            )}
          </div>

          <ul className="mt-8 grid gap-3 rounded-2xl border border-line bg-ink-850 p-4 text-sm sm:grid-cols-2">
            <Assurance icon={<FileText className="size-4" aria-hidden />} title="GST invoice" text="Emailed as a PDF once paid" />
            <Assurance
              icon={<Truck className="size-4" aria-hidden />}
              title={store.codEnabled && product.codAvailable ? "Cash on delivery" : "Pay online"}
              text={store.codEnabled && product.codAvailable ? "Or pay online by UPI, card or net banking" : "UPI, card, net banking or wallet via Razorpay"}
            />
            <Assurance icon={<Wrench className="size-4" aria-hidden />} title="Service from us" text="Repairs and support at the same shop" />
            <Assurance icon={<ShieldCheck className="size-4" aria-hidden />} title="Genuine hardware" text="Sourced and checked by our team" />
          </ul>
        </div>
      </div>

      {(product.description || product.specs.length > 0) && (
        <div className="mt-16 grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          {product.description && (
            <section>
              <h2 className="text-xl font-medium tracking-[-0.02em] text-fg">About this product</h2>
              <div className="mt-4 space-y-3 whitespace-pre-line text-[0.95rem] leading-relaxed text-fg-muted">{product.description}</div>
            </section>
          )}
          {product.specs.length > 0 && (
            <section>
              <h2 className="text-xl font-medium tracking-[-0.02em] text-fg">Specifications</h2>
              <dl className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-ink-850 text-sm">
                {product.specs.map((s) => (
                  <div key={s.label} className="grid grid-cols-[40%_1fr] gap-4 px-4 py-3">
                    <dt className="text-fg-muted">{s.label}</dt>
                    <dd className="text-fg">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      )}

      {related.length > 0 && (
        <section className="mt-20">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-xl font-medium tracking-[-0.02em] text-fg">More {category.label.toLowerCase()}</h2>
            <Link href={`/products?category=${category.id}`} className="text-sm text-fg-muted hover:text-brand">
              View all
            </Link>
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4">
            {related.map((p) => (
              <li key={p.slug}>
                <CatalogueCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Assurance({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-mint-soft text-leaf">{icon}</span>
      <span>
        <span className="block font-medium text-fg">{title}</span>
        <span className="block text-xs text-fg-muted">{text}</span>
      </span>
    </li>
  );
}

function ProductSkeleton() {
  return (
    <div className="mx-auto max-w-[1320px] animate-pulse px-4 pb-24 pt-28 sm:px-6 sm:pt-32" aria-busy="true" aria-label="Loading product">
      <div className="h-4 w-60 rounded bg-ink-900" />
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="aspect-square rounded-3xl bg-ink-900" />
        <div className="space-y-4 pt-4">
          <div className="h-4 w-24 rounded bg-ink-900" />
          <div className="h-10 w-3/4 rounded bg-ink-900" />
          <div className="h-5 w-full rounded bg-ink-900" />
          <div className="h-10 w-40 rounded bg-ink-900" />
          <div className="h-12 w-60 rounded-full bg-ink-900" />
        </div>
      </div>
    </div>
  );
}
