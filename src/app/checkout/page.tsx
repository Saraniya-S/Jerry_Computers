import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/orders/CheckoutForm";
import { LogoMark } from "@/components/ui/Logo";
import { requireCustomer } from "@/lib/server/auth";
import { getCart } from "@/lib/server/cart";
import { listAddresses } from "@/lib/server/customer";
import { razorpayEnabled } from "@/lib/server/env";
import { getSettings } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-ink-950">
      <header className="border-b border-line bg-ink-850/80">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-fg" aria-label="Jerry Computers — home">
            <LogoMark className="size-8" /> <span className="hidden sm:inline">Jerry Computers</span>
          </Link>
          <Link href="/products" className="text-sm text-fg-muted hover:text-fg">
            Continue shopping
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-medium tracking-[-0.03em] text-fg">Checkout</h1>
        <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-2xl bg-ink-900" aria-busy="true" />}>
          <Checkout />
        </Suspense>
      </main>
    </div>
  );
}

async function Checkout() {
  const viewer = await requireCustomer();
  const [cart, addresses, store] = await Promise.all([getCart(viewer.id), listAddresses(viewer.id), getSettings("store")]);
  if (!cart.length) redirect("/products");
  return (
    <CheckoutForm
      items={cart}
      store={store}
      onlineAvailable={razorpayEnabled}
      addresses={addresses.map((a) => ({
        id: a.id,
        label: a.label,
        isDefault: a.isDefault,
        recipientName: a.recipientName,
        phone: a.phone,
        summary: [a.line1, a.line2, a.city, `${a.state} ${a.postalCode}`].filter(Boolean).join(", "),
      }))}
    />
  );
}
