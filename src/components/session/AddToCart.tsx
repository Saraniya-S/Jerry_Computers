"use client";

import Link from "next/link";
import { Check, LoaderCircle, Minus, Plus, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { cartAdd, openCart, useSession } from "@/lib/client/session";

import { MAX_QUANTITY } from "@/lib/cart";

/** Quantity and Add to cart for a product page. Guests are asked to sign in; staff accounts see nothing. */
export function AddToCart({ slug, stock }: { slug: string; stock: number }) {
  const { status, viewer, cart, busy, error } = useSession();
  const [qty, setQty] = useState(1);
  const inCart = cart.find((l) => l.slug === slug)?.quantity ?? 0;
  const pending = busy === slug;
  const max = Math.min(MAX_QUANTITY, stock);

  if (status === "loading") return <div className="h-12 w-60 animate-pulse rounded-full bg-ink-900" aria-hidden />;
  if (!viewer) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/products/${slug}`)}`}
        className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 font-medium text-white transition-colors hover:bg-[var(--brand-hover)]"
      >
        <ShoppingCart className="size-4" aria-hidden /> Sign in to add to cart
      </Link>
    );
  }
  if (viewer.role !== "customer") return null;
  if (stock <= 0) {
    return <p className="inline-flex h-12 items-center rounded-full border border-line-strong px-6 font-medium text-fg-muted">Out of stock</p>;
  }

  async function add() {
    const res = await cartAdd(slug, qty);
    if (res?.ok) {
      setQty(1);
      openCart();
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-12 items-center rounded-full border border-line-strong bg-ink-850">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            className="grid size-11 place-items-center rounded-full text-fg-muted hover:text-fg disabled:opacity-40"
            aria-label="Decrease quantity"
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <span className="w-8 text-center tabular-nums text-fg" aria-live="polite" aria-label={`Quantity ${qty}`}>
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(max - inCart, q + 1))}
            disabled={qty >= max - inCart}
            className="grid size-11 place-items-center rounded-full text-fg-muted hover:text-fg disabled:opacity-40"
            aria-label="Increase quantity"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={pending || inCart >= max}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 font-medium text-white transition-[background-color,transform] hover:bg-[var(--brand-hover)] active:scale-[0.98] disabled:opacity-70"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <ShoppingCart className="size-4" aria-hidden />}
          {pending ? "Adding…" : "Add to cart"}
        </button>
      </div>
      {inCart > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-leaf-mid">
          <Check className="size-4" aria-hidden /> {inCart} in your cart ·{" "}
          <button type="button" onClick={openCart} className="font-medium underline underline-offset-2">
            View cart
          </button>
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
