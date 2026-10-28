"use client";

import Link from "next/link";
import { Banknote, Check, CreditCard, MapPin, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { placeOrderAction } from "@/app/checkout/actions";
import { FormAlert, SubmitButton } from "@/components/auth/ui";
import { ProductArt } from "@/components/products/ProductArt";
import { formatPrice } from "@/data/products";
import { cartTotal, type CartItem } from "@/lib/cart";
import { shippingFor, type StoreSettings } from "@/lib/settings";

type Address = { id: string; label: string; isDefault: boolean; recipientName: string; phone: string; summary: string };

const payments = [
  { id: "cod", label: "Cash on delivery", text: "Pay the courier when your order arrives.", icon: Banknote },
  { id: "online", label: "Online payment", text: "Pay by UPI or bank transfer; the shop shares the details.", icon: CreditCard },
] as const;

export function CheckoutForm({ items, addresses, store }: { items: CartItem[]; addresses: Address[]; store: StoreSettings }) {
  const [state, action] = useActionState(placeOrderAction, {});
  const [addressId, setAddressId] = useState(addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "");
  const [payment, setPayment] = useState<"cod" | "online">(store.codEnabled ? "cod" : "online");
  const count = items.reduce((n, i) => n + i.quantity, 0);
  const itemsTotal = cartTotal(items);
  const shipping = shippingFor(itemsTotal, store);

  return (
    <form action={action} className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
      <input type="hidden" name="addressId" value={addressId} />
      <input type="hidden" name="paymentMethod" value={payment} />

      <div className="grid content-start gap-8">
        <Section step={1} title="Delivery address">
          {addresses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong p-6 text-center">
              <MapPin className="mx-auto size-5 text-fg-dim" aria-hidden />
              <p className="mt-2 text-sm text-fg-muted">Add an address to deliver to.</p>
              <Link href="/account/addresses" className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-medium text-white">
                <Plus className="size-4" aria-hidden /> Add address
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Delivery address">
              {addresses.map((a) => (
                <Choice key={a.id} on={a.id === addressId} onSelect={() => setAddressId(a.id)}>
                  <span className="flex items-center gap-2 text-sm font-medium text-fg">
                    {a.label}
                    {a.isDefault && <span className="rounded bg-ink-900 px-1.5 py-0.5 text-[11px] font-normal text-fg-muted">Default</span>}
                  </span>
                  <span className="mt-1 block text-sm text-fg-muted">{a.recipientName}</span>
                  <span className="block text-sm leading-relaxed text-fg-muted">{a.summary}</span>
                  <span className="mt-1 block text-xs text-fg-dim">{a.phone}</span>
                </Choice>
              ))}
              <Link
                href="/account/addresses"
                className="flex min-h-24 items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong text-sm text-fg-muted hover:border-brand/40 hover:text-fg"
              >
                <Plus className="size-4" aria-hidden /> Manage addresses
              </Link>
            </div>
          )}
        </Section>

        <Section step={2} title="Payment">
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
            {payments.filter((p) => p.id !== "cod" || store.codEnabled).map((p) => (
              <Choice key={p.id} on={payment === p.id} onSelect={() => setPayment(p.id)}>
                <p.icon className="size-5 text-brand" aria-hidden />
                <span className="mt-2 block text-sm font-medium text-fg">{p.label}</span>
                <span className="mt-0.5 block text-sm text-fg-muted">{p.text}</span>
              </Choice>
            ))}
          </div>
        </Section>

        <Section step={3} title="Note for the shop" optional>
          <textarea
            name="note"
            rows={3}
            maxLength={500}
            placeholder="Preferred delivery time, configuration requests…"
            style={{ outline: "none" }}
            className="w-full rounded-xl border border-line-strong bg-ink-850 px-3.5 py-3 text-[0.95rem] text-fg placeholder:text-fg-dim focus:border-brand focus:ring-4 focus:ring-[var(--brand-glow)]"
          />
        </Section>
      </div>

      <aside className="h-fit rounded-2xl border border-line bg-ink-850 p-5 lg:sticky lg:top-6">
        <h2 className="font-medium text-fg">
          Order summary <span className="text-sm font-normal text-fg-dim">· {count} {count === 1 ? "item" : "items"}</span>
        </h2>
        <ul className="mt-4 divide-y divide-line">
          {items.map((i) => (
            <li key={i.slug} className="flex items-center gap-3 py-3">
              <span className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-line bg-[radial-gradient(80%_80%_at_50%_30%,var(--art-a),var(--art-b))]">
                {i.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- uploaded product images are served as-is
                  <img src={i.image} alt="" className="absolute inset-0 size-full object-contain p-1" />
                ) : (
                  <ProductArt category={i.category} variant={i.variant} className="absolute inset-0 size-full p-1" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-fg">{i.name}</span>
                <span className="block text-xs text-fg-dim">
                  {i.quantity} × {formatPrice(i.pricePaise)}
                </span>
              </span>
              <span className="text-sm font-medium tabular-nums text-fg">{formatPrice(i.pricePaise * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 grid gap-1.5 border-t border-line pt-3 text-sm">
          <div className="flex justify-between text-fg-muted">
            <dt>Items</dt>
            <dd className="tabular-nums text-fg">{formatPrice(itemsTotal)}</dd>
          </div>
          <div className="flex justify-between text-fg-muted">
            <dt>Delivery</dt>
            <dd className="tabular-nums text-fg">{shipping ? formatPrice(shipping) : "Free"}</dd>
          </div>
          <div className="mt-1 flex justify-between border-t border-line pt-2.5 text-base font-semibold text-fg">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatPrice(itemsTotal + shipping)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs leading-relaxed text-fg-dim">Inclusive of GST. Your GST invoice is emailed as a PDF once payment is received.</p>
        {state.error && (
          <div className="mt-4">
            <FormAlert>{state.error}</FormAlert>
          </div>
        )}
        {addresses.length > 0 ? (
          <SubmitButton pendingLabel="Placing order…">Place order</SubmitButton>
        ) : (
          <p className="mt-4 text-center text-sm text-fg-dim">Add a delivery address to place your order.</p>
        )}
      </aside>
    </form>
  );
}

function Section({ step, title, optional, children }: { step: number; title: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2.5 font-medium text-fg">
        <span className="grid size-6 place-items-center rounded-md bg-brand text-xs text-white">{step}</span>
        {title}
        {optional && <span className="text-xs font-normal text-fg-dim">Optional</span>}
      </h2>
      {children}
    </section>
  );
}

function Choice({ on, onSelect, children }: { on: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onSelect}
      className={`relative rounded-xl border p-4 text-left transition-[border-color,box-shadow,background-color] ${
        on ? "border-brand bg-brand/[0.03] ring-4 ring-[var(--brand-glow)]" : "border-line-strong bg-ink-850 hover:border-fg/30"
      }`}
    >
      {on && (
        <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-brand text-white">
          <Check className="size-3" strokeWidth={3} aria-hidden />
        </span>
      )}
      {children}
    </button>
  );
}
