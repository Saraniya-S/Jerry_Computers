"use server";

import { z } from "zod";
import type { CartItem } from "@/lib/cart";
import { addToCart, CartError, getCart, MAX_QUANTITY, removeFromCart, setQuantity } from "@/lib/server/cart";
import { getSessionUser } from "@/lib/server/session";

export type CartResult = { ok: true; lines: CartItem[] } | { ok: false; error: string; signedOut?: boolean };

const slug = z.string().min(1).max(80);
const qty = z.number().int().min(0).max(MAX_QUANTITY);

/** Cart mutations for the signed-in customer. Each returns the whole cart so the UI can replace its copy. */
async function withCustomer(run: (userId: string) => Promise<void>): Promise<CartResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in to use your cart.", signedOut: true };
  if (user.role !== "customer") return { ok: false, error: "The cart is for customer accounts." };
  try {
    await run(user.id);
  } catch (err) {
    if (err instanceof CartError) return { ok: false, error: err.message };
    throw err;
  }
  return { ok: true, lines: await getCart(user.id) };
}

export async function addToCartAction(productSlug: string, quantity = 1) {
  const s = slug.parse(productSlug);
  const q = qty.min(1).parse(quantity);
  return withCustomer((id) => addToCart(id, s, q));
}

export async function setCartQuantityAction(productSlug: string, quantity: number) {
  const s = slug.parse(productSlug);
  const q = qty.parse(quantity);
  return withCustomer((id) => setQuantity(id, s, q));
}

export async function removeFromCartAction(productSlug: string) {
  const s = slug.parse(productSlug);
  return withCustomer((id) => removeFromCart(id, s));
}
