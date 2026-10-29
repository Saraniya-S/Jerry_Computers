import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import type { Product, ProductCategoryId, ProductUse } from "@/data/products";
import { db, schema } from "./db";
import type { ProductRow } from "./db/schema";

/** Cache tag for everything that shows products; admin edits call updateTag(CATALOGUE_TAG). */
export const CATALOGUE_TAG = "catalogue";

export function toProduct(r: ProductRow): Product {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    brand: r.brand,
    category: r.category as ProductCategoryId,
    summary: r.summary,
    description: r.description,
    uses: r.uses as ProductUse[],
    specs: r.specs,
    images: r.images,
    variant: Math.min(2, Math.max(0, r.artVariant)) as 0 | 1 | 2,
    pricePaise: r.pricePaise,
    mrpPaise: r.mrpPaise,
    gstRateBp: r.gstRateBp,
    stock: r.stock,
    isFeatured: r.isFeatured,
    codAvailable: r.codAvailable,
  };
}

/** Every active product, in display order. Cached and shared by all store pages. */
export async function getCatalogue(): Promise<Product[]> {
  "use cache";
  cacheTag(CATALOGUE_TAG);
  cacheLife("hours");
  const rows = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.isActive, true))
    .orderBy(desc(schema.products.isFeatured), asc(schema.products.sortOrder), asc(schema.products.name));
  return rows.map(toProduct);
}

export async function getProductBySlug(slug: string) {
  return (await getCatalogue()).find((p) => p.slug === slug) ?? null;
}
