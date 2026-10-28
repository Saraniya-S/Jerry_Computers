"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LoaderCircle, Minus, Plus, ShoppingBag, ShoppingCart, Trash2, X } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ProductArt } from "@/components/products/ProductArt";
import { formatPrice } from "@/data/products";
import { cartCount, cartRemove, cartSetQuantity, cartTotal, closeCart, openCart, useSession } from "@/lib/client/session";

import { MAX_QUANTITY } from "@/lib/cart";

const noop = () => () => {};

/** Cart icon with a count badge; opens the cart drawer. Only shown to signed-in customers. */
export function CartButton({ className = "" }: { className?: string }) {
  const { viewer, cart, cartOpen } = useSession();
  const reduce = useReducedMotion();
  if (viewer?.role !== "customer") return null;
  const count = cartCount(cart);

  return (
    <>
      <button
        type="button"
        onClick={openCart}
        aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}
        aria-haspopup="dialog"
        aria-expanded={cartOpen}
        className={`relative grid size-9 place-items-center rounded-full text-fg-muted transition-colors hover:bg-ink-800 hover:text-fg ${className}`}
      >
        <ShoppingCart className="size-[18px]" aria-hidden />
        <AnimatePresence>
          {count > 0 && (
            <motion.span
              key={count}
              initial={reduce ? false : { scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 24 }}
              className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-ink-950"
            >
              {count > 99 ? "99+" : count}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      <CartDrawer />
    </>
  );
}

function CartDrawer() {
  const { cart, cartOpen, busy, error } = useSession();
  const reduce = useReducedMotion();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const panelRef = useRef<HTMLDivElement>(null);
  const count = cartCount(cart);

  useEffect(() => {
    if (!cartOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeCart();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [cartOpen]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {cartOpen && (
        <>
          <motion.div
            key="cart-scrim"
            className="fixed inset-0 z-[60] bg-[rgb(28_25_56/0.35)] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
          />
          <motion.div
            key="cart-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            className="fixed inset-y-0 right-0 z-[61] flex w-[min(420px,100vw)] flex-col bg-ink-850 shadow-2xl sm:inset-y-3 sm:right-3 sm:rounded-2xl sm:border sm:border-line"
            initial={reduce ? { opacity: 0 } : { x: "105%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "105%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 id="cart-title" className="flex items-center gap-2 text-base font-semibold text-fg">
                Your cart
                {count > 0 && <span className="rounded-md bg-ink-900 px-1.5 py-0.5 font-mono text-xs font-medium text-fg-muted">{count}</span>}
              </h2>
              <button type="button" onClick={closeCart} className="grid size-8 place-items-center rounded-lg text-fg-muted hover:bg-ink-900 hover:text-fg" aria-label="Close cart">
                <X className="size-4" aria-hidden />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
                <div className="grid size-14 place-items-center rounded-2xl border border-line bg-ink-950 text-fg-muted">
                  <ShoppingBag className="size-6" aria-hidden />
                </div>
                <p className="mt-4 font-medium text-fg">Your cart is empty</p>
                <p className="mt-1 text-sm text-fg-muted">Add laptops, components, CCTV and more from the shop.</p>
                <Link
                  href="/products"
                  onClick={closeCart}
                  className="mt-5 inline-flex h-10 items-center rounded-full bg-brand px-5 text-sm font-medium text-white hover:bg-[var(--brand-hover)]"
                >
                  Browse products
                </Link>
              </div>
            ) : (
              <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
                {cart.map((line) => {
                  const p = line;
                  const pending = busy === line.slug;
                  return (
                    <li key={line.slug} className="flex gap-3.5 py-4">
                      <Link
                        href={`/products/${p.slug}`}
                        onClick={closeCart}
                        className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-[radial-gradient(80%_80%_at_50%_30%,var(--art-a),var(--art-b))]"
                      >
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- uploaded product images are served as-is
                          <img src={p.image} alt="" className="size-full object-contain p-1.5" />
                        ) : (
                          <ProductArt category={p.category} variant={p.variant} className="size-full p-2" />
                        )}
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Link href={`/products/${p.slug}`} onClick={closeCart} className="truncate text-sm font-medium text-fg hover:text-brand">
                          {p.name}
                        </Link>
                        <p className="text-xs text-fg-dim">{p.categoryLabel}</p>
                        <p className="mt-1 text-sm font-medium tabular-nums text-fg">{formatPrice(p.pricePaise * line.quantity)}</p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="flex items-center rounded-full border border-line-strong">
                            <button
                              type="button"
                              onClick={() => cartSetQuantity(line.slug, line.quantity - 1)}
                              disabled={pending}
                              className="grid size-7 place-items-center rounded-full text-fg-muted hover:text-fg disabled:opacity-40"
                              aria-label={`Decrease ${p.name} quantity`}
                            >
                              <Minus className="size-3.5" aria-hidden />
                            </button>
                            <span className="w-7 text-center text-sm tabular-nums text-fg" aria-live="polite">
                              {pending ? <LoaderCircle className="mx-auto size-3.5 animate-spin text-fg-dim" aria-label="Updating" /> : line.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => cartSetQuantity(line.slug, line.quantity + 1)}
                              disabled={pending || line.quantity >= Math.min(MAX_QUANTITY, line.stock)}
                              className="grid size-7 place-items-center rounded-full text-fg-muted hover:text-fg disabled:opacity-40"
                              aria-label={`Increase ${p.name} quantity`}
                            >
                              <Plus className="size-3.5" aria-hidden />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => cartRemove(line.slug)}
                            disabled={pending}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-fg-dim hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                          >
                            <Trash2 className="size-3.5" aria-hidden /> Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {error && <p className="mx-5 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            {cart.length > 0 && (
              <div className="border-t border-line px-5 py-4">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-fg-muted">
                    Subtotal · {count} {count === 1 ? "item" : "items"}
                  </span>
                  <span className="text-base font-semibold tabular-nums text-fg">{formatPrice(cartTotal(cart))}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-fg-dim">Inclusive of GST. Pay online or cash on delivery; your GST invoice is emailed once payment is received.</p>
                <Link
                  href="/checkout"
                  onClick={closeCart}
                  className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-brand text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)]"
                >
                  Checkout
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
