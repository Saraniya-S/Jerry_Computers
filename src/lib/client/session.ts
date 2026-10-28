"use client";

import { useEffect, useSyncExternalStore } from "react";
import { addToCartAction, removeFromCartAction, setCartQuantityAction, type CartResult } from "@/lib/actions/cart";
import type { CartItem } from "@/lib/cart";

/**
 * Who is signed in and what's in their cart, for chrome on pages that are otherwise static
 * (the homepage, product pages). Loaded from /api/session; cart edits go through server actions.
 */

export type SessionViewer = {
  role: "customer" | "engineer" | "ecommerce_staff" | "admin";
  firstName: string;
  lastName: string;
  email: string;
  home: string;
  onboarded: boolean;
};

type State = {
  status: "loading" | "ready";
  viewer: SessionViewer | null;
  cart: CartItem[];
  cartOpen: boolean;
  /** Slug of the line being changed, for spinners. */
  busy: string | null;
  error: string | null;
};

let state: State = { status: "loading", viewer: null, cart: [], cartOpen: false, busy: null, error: null };
const listeners = new Set<() => void>();
const serverState: State = state;

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

let inflight: Promise<void> | null = null;

/** Re-reads the session. Called whenever chrome mounts, so it's fresh after sign-in or sign-out navigations. */
export function refreshSession() {
  inflight ??= fetch("/api/session", { cache: "no-store", credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : { viewer: null, cart: [] }))
    .then((body: { viewer: SessionViewer | null; cart: CartItem[] }) => set({ status: "ready", viewer: body.viewer, cart: body.cart }))
    .catch(() => set({ status: "ready" }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useSession() {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => serverState,
  );
  useEffect(() => {
    refreshSession();
  }, []);
  return snapshot;
}

export const openCart = () => set({ cartOpen: true, error: null });
export const closeCart = () => set({ cartOpen: false });

async function mutate(slug: string, run: () => Promise<CartResult>) {
  set({ busy: slug, error: null });
  try {
    const res = await run();
    if (res.ok) set({ cart: res.lines, busy: null });
    else set({ busy: null, error: res.error, ...(res.signedOut ? { viewer: null, cart: [] } : {}) });
    return res;
  } catch {
    set({ busy: null, error: "Something went wrong. Please try again." });
    return null;
  }
}

export const cartAdd = (slug: string, quantity = 1) => mutate(slug, () => addToCartAction(slug, quantity));
export const cartSetQuantity = (slug: string, quantity: number) => mutate(slug, () => setCartQuantityAction(slug, quantity));
export const cartRemove = (slug: string) => mutate(slug, () => removeFromCartAction(slug));

export { cartCount, cartTotal } from "@/lib/cart";
