import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { formatPaise, invoiceNumber, orderStatusLabel, paymentStatusLabel } from "@/lib/money";
import type { AddressSnapshot, Invoice, OrderStatus, PaymentStatus } from "@/lib/server/db/schema";

/** Order pieces shared by the customer and admin areas. */

const statusStyle: Record<OrderStatus, string> = {
  placed: "bg-amber-100 text-amber-800",
  confirmed: "bg-ink-900 text-fg-muted",
  packed: "bg-brand/10 text-brand",
  shipped: "bg-sky-100 text-sky-800",
  delivered: "bg-mint-soft text-leaf",
  returned: "bg-red-50 text-red-700",
  cancelled: "bg-ink-900 text-fg-dim line-through",
};

const paymentStyle: Record<PaymentStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  paid: "bg-mint-soft text-leaf",
  refund_pending: "bg-red-50 text-red-700",
  refunded: "bg-ink-900 text-fg-muted",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[status]}`}>{orderStatusLabel[status]}</span>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentStyle[status]}`}>{paymentStatusLabel[status]}</span>;
}

export function AddressBlock({ a }: { a: AddressSnapshot }) {
  return (
    <address className="text-sm not-italic leading-relaxed text-fg-muted">
      <span className="font-medium text-fg">{a.recipientName}</span>
      <br />
      {a.line1}
      {a.line2 && <>, {a.line2}</>}
      <br />
      {a.landmark && (
        <>
          Near {a.landmark}
          <br />
        </>
      )}
      {a.city}, {a.state} {a.postalCode}
      <br />
      {a.phone}
    </address>
  );
}

type Item = { productSlug: string; productName: string; categoryLabel: string; quantity: number; unitPricePaise: number };

/** Items with prices and the order total. */
export function OrderLines({ items, itemsTotal, shipping, total, productHref = (slug: string) => `/products/${slug}` }: { items: Item[]; itemsTotal: number; shipping: number; total: number; productHref?: (slug: string) => string }) {
  return (
    <section className="overflow-hidden rounded-xl border border-line">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-line bg-ink-950 text-xs text-fg-dim">
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Item</th>
              <th scope="col" className="px-3 py-2.5 text-center font-medium">Qty</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Price</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((i) => (
              <tr key={i.productSlug}>
                <td className="px-4 py-3">
                  <Link href={productHref(i.productSlug)} className="text-fg hover:text-brand">
                    {i.productName}
                  </Link>
                  <span className="block text-xs text-fg-dim">{i.categoryLabel}</span>
                </td>
                <td className="px-3 py-3 text-center tabular-nums">{i.quantity}</td>
                <td className="px-3 py-3 text-right tabular-nums text-fg-muted">{formatPaise(i.unitPricePaise)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-fg">{formatPaise(i.unitPricePaise * i.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="grid gap-1.5 border-t border-line px-4 py-4 text-sm">
        <div className="flex justify-between text-fg-muted">
          <dt>Items (incl. GST)</dt>
          <dd className="tabular-nums text-fg">{formatPaise(itemsTotal)}</dd>
        </div>
        <div className="flex justify-between text-fg-muted">
          <dt>Delivery</dt>
          <dd className="tabular-nums text-fg">{shipping ? formatPaise(shipping) : "Free"}</dd>
        </div>
        <div className="mt-1 flex justify-between border-t border-line pt-2.5 text-base font-semibold text-fg">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatPaise(total)}</dd>
        </div>
      </dl>
    </section>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Link card for a paid order's PDF invoice. */
export function InvoiceCard({ invoice, href }: { invoice: Invoice; href: string }) {
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink-950 p-4">
      <span className="grid size-10 place-items-center rounded-lg bg-ink-850 text-brand shadow-[0_1px_2px_var(--line)]">
        <FileText className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">Tax invoice {invoiceNumber(invoice.seq)}</p>
        <p className="text-xs text-fg-dim">
          Issued {dateFmt.format(invoice.sentAt)} · GST {formatPaise(invoice.gstPaise)} · Total {formatPaise(invoice.totalPaise)}
        </p>
      </div>
      <a href={href} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-ink-850 px-4 text-sm text-fg hover:bg-ink-900">
        <Download className="size-4" aria-hidden /> PDF
      </a>
    </section>
  );
}
