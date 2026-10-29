import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, StickyNote } from "lucide-react";
import { PageHeader } from "@/components/account/PageHeader";
import { OrderActions } from "@/components/admin/OrderActions";
import { OrderNoteForm } from "@/components/admin/OrderNoteForm";
import { ShipmentPanel } from "@/components/admin/ShipmentPanel";
import { Badge, fullDateTimeFmt } from "@/components/admin/ui";
import { AddressBlock, InvoiceCard, OrderLines, PaymentBadge, StatusBadge } from "@/components/orders/OrderParts";
import { formatPaise, orderNumber, paymentLabel } from "@/lib/money";
import type { Staff } from "@/lib/server/auth";
import { allowedNext, canRecordPayment, getOrder, orderTimeline } from "@/lib/server/orders";
import { can } from "@/lib/server/permissions";

/**
 * One order with everything needed to process it. Used by /admin/orders/[id] and /staff/orders/[id];
 * every button calls a server action that re-checks permission and the allowed transition.
 */
export async function OrderDetail({ id, staff, basePath, customerHref }: { id: string; staff: Staff; basePath: string; customerHref?: (customerId: string) => string }) {
  const order = /^[0-9a-f-]{36}$/i.test(id) ? await getOrder(id) : null;
  if (!order) notFound();
  const timeline = await orderTimeline(order.id);
  const c = order.customer;
  const next = (can(staff.role, "orders.fulfil") ? allowedNext(order) : []) as ("confirmed" | "packed" | "shipped" | "delivered" | "cancelled")[];
  const waitingForPayment = order.paymentMethod === "online" && order.paymentStatus === "pending" && !["cancelled", "returned"].includes(order.status);
  const codNotYet = order.paymentMethod === "cod" && order.paymentStatus === "pending" && ["placed", "confirmed", "packed"].includes(order.status);

  return (
    <>
      <PageHeader
        title={
          <>
            {orderNumber(order.seq)} <StatusBadge status={order.status} /> <PaymentBadge status={order.paymentStatus} />
          </>
        }
        description={`Placed ${fullDateTimeFmt.format(order.createdAt)} · updated ${fullDateTimeFmt.format(order.updatedAt)} · ${paymentLabel[order.paymentMethod]}${order.paidAt ? ` · paid ${fullDateTimeFmt.format(order.paidAt)}` : ""}`}
        actions={
          <Link href={basePath} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
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
          {order.status === "returned" && (
            <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <h2 className="font-medium">Returned to the shop by the courier</h2>
              <p className="mt-0.5">Check the goods; an admin restocks them through Inventory.{order.paymentStatus === "refund_pending" && " The customer had paid: a refund is due."}</p>
            </section>
          )}
          {order.invoice && <InvoiceCard invoice={order.invoice} href={`${basePath}/${order.id}/invoice`} />}
          <OrderLines items={order.items} itemsTotal={order.itemsTotalPaise} shipping={order.shippingPaise} total={order.totalPaise} />
          <section className="overflow-hidden rounded-xl border border-line">
            <h2 className="border-b border-line bg-ink-950 px-4 py-3 text-sm font-medium text-fg">Payment history</h2>
            {order.payments.length ? (
              <ul className="divide-y divide-line text-sm">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="flex items-center gap-2 text-fg">
                        <Badge tone={p.status === "failed" ? "muted" : p.kind === "payment" ? "good" : "bad"}>
                          {p.kind === "payment" ? "Payment received" : p.status === "pending" ? "Refund processing" : p.status === "failed" ? "Refund failed" : "Refund sent"}
                        </Badge>
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
                No payment recorded.{" "}
                {order.paymentMethod === "online"
                  ? "Waiting for the customer to pay through Razorpay. It's recorded here automatically once Razorpay confirms the payment."
                  : codNotYet
                    ? "Cash is collected by the courier on delivery; record it after dispatch, once it has been collected."
                    : "Record the cash once the courier hands it over."}
              </p>
            )}
          </section>
          <section className="rounded-xl border border-line p-4 text-sm sm:p-5">
            <h2 className="mb-3 flex items-center gap-1.5 font-medium text-fg">
              <StickyNote className="size-4 text-brand" aria-hidden /> Timeline and internal notes
            </h2>
            <ol className="grid gap-3 border-l border-line pl-4">
              {timeline.map((t) => (
                <li key={t.id} className="relative">
                  <span className={`absolute -left-[1.3rem] top-1.5 size-2 rounded-full ${t.kind === "note" ? "bg-amber-500" : "bg-brand"}`} aria-hidden />
                  <p className={t.kind === "note" ? "whitespace-pre-line text-fg" : "text-fg"}>
                    {t.kind === "note" && <span className="mr-1.5 text-xs font-medium text-amber-700">Note</span>}
                    {t.text}
                  </p>
                  <p className="text-xs text-fg-dim">
                    {fullDateTimeFmt.format(t.at)}
                    {t.by && ` · ${t.by}`}
                  </p>
                </li>
              ))}
            </ol>
            {can(staff.role, "orders.fulfil") && (
              <div className="mt-4">
                <OrderNoteForm orderId={order.id} />
              </div>
            )}
          </section>
          {order.customerNote && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h2 className="mb-1 text-sm font-medium text-amber-900">Note from the customer</h2>
              <p className="text-sm text-amber-900/80">{order.customerNote}</p>
            </section>
          )}
        </div>

        <div className="grid content-start gap-4">
          <OrderActions
            orderId={order.id}
            status={order.status}
            next={next}
            paymentMethod={order.paymentMethod}
            canRecordPayment={can(staff.role, "payments.record") && canRecordPayment(order)}
            codWaitsForDispatch={can(staff.role, "payments.record") && codNotYet}
            refund={
              can(staff.role, "payments.refund") && order.paymentStatus === "refund_pending"
                ? {
                    mode: order.payments.some((p) => p.provider === "razorpay" && p.kind === "payment" && p.status === "succeeded") ? "gateway" : "manual",
                    pending: order.payments.some((p) => p.kind === "refund" && p.status === "pending"),
                  }
                : null
            }
            hasInvoice={Boolean(order.invoice)}
            invoiceHref={`${basePath}/${order.id}/invoice`}
            waitingForPayment={waitingForPayment}
          />
          <ShipmentPanel shipments={order.shipments} canEdit={can(staff.role, "orders.fulfil")} />
          <section className="rounded-xl border border-line p-4 text-sm">
            <h2 className="mb-2 font-medium text-fg">Customer</h2>
            {customerHref ? (
              <Link href={customerHref(c.id)} className="text-fg hover:text-brand">
                {`${c.firstName} ${c.lastName}`.trim()}
              </Link>
            ) : (
              <p className="text-fg">{`${c.firstName} ${c.lastName}`.trim()}</p>
            )}
            {c.companyName && <p className="text-fg-muted">{c.companyName}</p>}
            {c.gstin && <p className="text-fg-muted">GSTIN {c.gstin}</p>}
            <p className="text-fg-muted">{c.email}</p>
            {c.phone && (
              <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="text-fg-muted hover:text-brand">
                {c.phone}
              </a>
            )}
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
