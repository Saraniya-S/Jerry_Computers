import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { OrderActions } from "@/components/admin/OrderActions";
import { ShipmentPanel } from "@/components/admin/ShipmentPanel";
import { Badge, fullDateTimeFmt } from "@/components/admin/ui";
import { AddressBlock, InvoiceCard, OrderLines, PaymentBadge, StatusBadge } from "@/components/orders/OrderParts";
import { formatPaise, orderNumber, paymentLabel } from "@/lib/money";
import { allowedNext, getOrder } from "@/lib/server/orders";
import { can, requirePermission } from "@/lib/server/permissions";

export const metadata: Metadata = { title: "Order" };

export default function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Order params={params} />
    </Suspense>
  );
}

async function Order({ params }: Pick<PageProps<"/admin/orders/[id]">, "params">) {
  const staff = await requirePermission("orders.view");
  const { id } = await params;
  const order = /^[0-9a-f-]{36}$/i.test(id) ? await getOrder(id) : null;
  if (!order) notFound();
  const c = order.customer;
  const next = (can(staff.role, "orders.fulfil") ? allowedNext(order) : []) as ("packed" | "shipped" | "delivered" | "cancelled")[];
  const waitingForPayment = order.paymentMethod === "online" && order.paymentStatus === "pending" && order.status !== "cancelled";

  return (
    <>
      <PageHeader
        title={
          <>
            {orderNumber(order.seq)} <StatusBadge status={order.status} /> <PaymentBadge status={order.paymentStatus} />
          </>
        }
        description={`Placed ${fullDateTimeFmt.format(order.createdAt)} · ${paymentLabel[order.paymentMethod]}${order.paidAt ? ` · paid ${fullDateTimeFmt.format(order.paidAt)}` : ""}`}
        actions={
          <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden /> All orders
          </Link>
        }
      />
      <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-6">
          {order.status === "cancelled" && (
            <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <h2 className="font-medium">Cancelled{order.cancelledAt && ` ${fullDateTimeFmt.format(order.cancelledAt)}`}</h2>
              {order.cancelReason && <p className="mt-0.5">{order.cancelReason}</p>}
              {order.paymentStatus === "refund_pending" && <p className="mt-1 font-medium">The customer had paid: a refund is due.</p>}
            </section>
          )}
          {order.invoice && <InvoiceCard invoice={order.invoice} href={`/admin/orders/${order.id}/invoice`} />}
          <OrderLines items={order.items} itemsTotal={order.itemsTotalPaise} shipping={order.shippingPaise} total={order.totalPaise} />
          <section className="overflow-hidden rounded-xl border border-line">
            <h2 className="border-b border-line bg-ink-950 px-4 py-3 text-sm font-medium text-fg">Payment history</h2>
            {order.payments.length ? (
              <ul className="divide-y divide-line text-sm">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="flex items-center gap-2 text-fg">
                        <Badge tone={p.kind === "payment" ? "good" : "bad"}>{p.kind === "payment" ? "Payment received" : "Refund sent"}</Badge>
                        {paymentLabel[p.method]}
                        {p.provider !== "manual" && <span className="text-xs text-fg-dim">via {p.provider}</span>}
                      </p>
                      <p className="mt-1 text-xs text-fg-dim">
                        {fullDateTimeFmt.format(p.createdAt)} · recorded by {p.by ?? "—"}
                        {p.reference && (
                          <>
                            {" "}
                            · ref <span className="font-mono text-fg-muted">{p.reference}</span>
                          </>
                        )}
                      </p>
                      {p.note && <p className="mt-0.5 text-xs text-fg-dim">{p.note}</p>}
                    </div>
                    <span className={`tabular-nums font-medium ${p.kind === "refund" ? "text-red-700" : "text-fg"}`}>
                      {p.kind === "refund" ? "−" : ""}
                      {formatPaise(p.amountPaise)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-fg-muted">
                No payment recorded. {order.paymentMethod === "online" ? "An online payment counts only once staff confirm it against the bank or UPI statement." : "Record the cash once the courier hands it over."}
              </p>
            )}
          </section>
          {order.customerNote && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h2 className="mb-1 text-sm font-medium text-amber-900">Customer note</h2>
              <p className="text-sm text-amber-900/80">{order.customerNote}</p>
            </section>
          )}
        </div>

        <div className="grid content-start gap-4">
          <OrderActions
            orderId={order.id}
            next={next}
            paymentMethod={order.paymentMethod}
            canRecordPayment={can(staff.role, "payments.record") && order.paymentStatus === "pending" && order.status !== "cancelled"}
            canRecordRefund={can(staff.role, "payments.refund") && order.paymentStatus === "refund_pending"}
            hasInvoice={Boolean(order.invoice)}
            waitingForPayment={waitingForPayment}
          />
          <ShipmentPanel shipments={order.shipments} />
          <section className="rounded-xl border border-line p-4 text-sm">
            <h2 className="mb-2 font-medium text-fg">Customer</h2>
            <p className="text-fg">{`${c.firstName} ${c.lastName}`.trim()}</p>
            {c.companyName && <p className="text-fg-muted">{c.companyName}</p>}
            {c.gstin && <p className="text-fg-muted">GSTIN {c.gstin}</p>}
            <p className="text-fg-muted">{c.email}</p>
            {c.phone && <p className="text-fg-muted">{c.phone}</p>}
          </section>
          <section className="rounded-xl border border-line p-4">
            <h2 className="mb-2 text-sm font-medium text-fg">Ship to</h2>
            <AddressBlock a={order.shippingAddress} />
          </section>
        </div>
      </div>
    </>
  );
}
