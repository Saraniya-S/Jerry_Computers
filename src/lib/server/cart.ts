import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { canBuy, getCategory } from "@/data/products";
import { MAX_QUANTITY, type CartItem } from "@/lib/cart";
import { getCatalogue } from "./catalogue";
import { db, schema } from "./db";

export { MAX_QUANTITY };
export const MAX_LINES = 30;

/** The customer's cart with current product details. Lines for products no longer for sale are left out. */
export async function getCart(userId: string): Promise<CartItem[]> {
  const [rows, catalogue] = await Promise.all([
    db
      .select({ slug: schema.cartItems.productSlug, quantity: schema.cartItems.quantity })
      .from(schema.cartItems)
      .where(eq(schema.cartItems.userId, userId))
      .orderBy(asc(schema.cartItems.addedAt)),
    getCatalogue(),
  ]);
  const bySlug = new Map(catalogue.map((p) => [p.slug, p]));
  return rows.flatMap((r) => {
    const p = bySlug.get(r.slug);
    if (!p || !canBuy(p)) return [];
    return [
      {
        slug: p.slug,
        quantity: Math.min(r.quantity, p.stock, MAX_QUANTITY),
        name: p.name,
        category: p.category,
        categoryLabel: getCategory(p.category).label,
        variant: p.variant,
        image: p.images[0] ?? null,
        pricePaise: p.pricePaise!,
        stock: p.stock,
      },
    ];
  });
}

export class CartError extends Error {}

async function buyable(slug: string) {
  const p = (await getCatalogue()).find((x) => x.slug === slug);
  if (!p || p.pricePaise === null) throw new CartError("That product isn't available to buy online.");
  if (p.stock <= 0) throw new CartError("That product is out of stock.");
  return p;
}

export async function addToCart(userId: string, slug: string, quantity: number) {
  const p = await buyable(slug);
  const [existing] = await db
    .select({ quantity: schema.cartItems.quantity })
    .from(schema.cartItems)
    .where(and(eq(schema.cartItems.userId, userId), eq(schema.cartItems.productSlug, slug)));
  if (!existing) {
    const lines = await db.select({ slug: schema.cartItems.productSlug }).from(schema.cartItems).where(eq(schema.cartItems.userId, userId));
    if (lines.length >= MAX_LINES) throw new CartError(`Your cart can hold up to ${MAX_LINES} products.`);
  }
  const next = Math.min((existing?.quantity ?? 0) + quantity, MAX_QUANTITY, p.stock);
  await db
    .insert(schema.cartItems)
    .values({ userId, productSlug: slug, quantity: next })
    .onConflictDoUpdate({ target: [schema.cartItems.userId, schema.cartItems.productSlug], set: { quantity: next } });
}

export async function setQuantity(userId: string, slug: string, quantity: number) {
  if (quantity <= 0) return removeFromCart(userId, slug);
  const p = await buyable(slug);
  await db
    .update(schema.cartItems)
    .set({ quantity: Math.min(quantity, MAX_QUANTITY, p.stock) })
    .where(and(eq(schema.cartItems.userId, userId), eq(schema.cartItems.productSlug, slug)));
}

export async function removeFromCart(userId: string, slug: string) {
  await db.delete(schema.cartItems).where(and(eq(schema.cartItems.userId, userId), eq(schema.cartItems.productSlug, slug)));
}
