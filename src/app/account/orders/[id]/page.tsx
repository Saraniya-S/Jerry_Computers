import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleAlert, CircleCheck, Truck } from "lucide-react";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { AddressBlock, InvoiceCard, OrderLines, PaymentBadge, StatusBadge } from "@/components/orders/OrderParts";
import { PayNow } from "@/components/orders/PayNow";
import { formatPaise, orderNumber, paymentLabel } from "@/lib/money";
import { requireCustomer } from "@/lib/server/auth";
import { CHECKOUT_HOLD_MINUTES, getCustomerOrder } from "@/lib/server/orders";

export const metadata: Metadata = { title: "Order" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function OrderPage({ params, searchParams }: PageProps<"/account/orders/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Order params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Order({ params, searchParams }: Pick<PageProps<"/account/orders/[id]">, "params" | "searchParams">) {
  const viewer = await requireCustomer();
  const [{ id }, { placed, pay }] = await Promise.all([params, searchParams]);
  const order = /^[0-9a-f-]{36}$/i.test(id) ? await getCustomerOrder(viewer.id, id) : null;
  if (!order) notFound();
  // An online checkout that hasn't been paid isn't an order yet (and one that ran out of time never will be).
  const checkout = !order.placedAt;
  const expired = checkout && order.status === "cancelled";

  return (
    <>
      <PageHeader
        title={
          <>
            {orderNumber(order.seq)}{" "}
            {checkout ? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">{expired ? "Not placed" : "Awaiting payment"}</span>
            ) : (
              <>
                <StatusBadge status={order.status} /> <PaymentBadge status={order.paymentStatus} />
              </>
            )}
          </>
        }
        description={`${checkout ? "Checkout started" : "Placed"} ${dateFmt.format(order.placedAt ?? order.createdAt)} · ${paymentLabel[order.paymentMethod]}`}
        actions={
          <Link href="/account/orders" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden /> All orders
          </Link>
        }
      />
      <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[1fr_300px]">
        <div className="grid content-start gap-6">
          {checkout && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-800">
              <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">{expired ? "No order was placed" : "Your order isn't placed yet"}</p>
                <p className="mt-0.5 text-amber-800/80">
                  {order.paymentStatus === "refund_pending"
                    ? "The payment arrived after this checkout ran out of time. The shop will refund it to you."
                    : expired
                      ? "The payment wasn't completed in time, so the items were released. Your cart is saved: check out again to order them."
                      : `Complete the payment below to place it. We hold these items for ${CHECKOUT_HOLD_MINUTES} minutes from checkout.`}
                </p>
              </div>
            </div>
          )}
          {placed === "1" && !checkout && (
            <div className="flex items-start gap-3 rounded-xl border border-leaf-mid/25 bg-mint-soft px-4 py-3.5 text-sm text-leaf">
              <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">Order placed — thank you!</p>
                <p className="mt-0.5 text-leaf/80">
                  {order.paymentMethod === "online" ? `Payment received. We'll send updates to ${viewer.email}.` : `We'll send updates to ${viewer.email}. Your GST invoice follows once payment is received.`}
                </p>
              </div>
            </div>
          )}
          {order.invoice ? (
            <InvoiceCard invoice={order.invoice} href={`/account/orders/${order.id}/invoice`} />
          ) : order.paymentMethod === "online" && order.paymentStatus === "pending" && order.status !== "cancelled" && order.status !== "returned" ? (
            <PayNow orderId={order.id} amountLabel={formatPaise(order.totalPaise)} autoStart={pay === "1"} checkout={checkout} />
          ) : (
            order.status !== "cancelled" &&
            order.paymentMethod === "cod" && (
              <div className="rounded-xl border border-line bg-ink-950 px-4 py-3 text-sm text-fg-muted">Pay the courier on delivery. Your GST invoice is emailed as a PDF once payment is received.</div>
            )
          )}
          <OrderLines items={order.items} itemsTotal={order.itemsTotalPaise} shipping={order.shippingPaise} total={order.totalPaise} />
        </div>
        <div className="grid content-start gap-4">
          <section className="rounded-xl border border-line p-4">
            <h2 className="mb-2 text-sm font-medium text-fg">Delivering to</h2>
            <AddressBlock a={order.shippingAddress} />
          </section>
          {order.trackingNumber && (
            <section className="rounded-xl border border-line p-4">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-fg">
                <Truck className="size-4 text-brand" aria-hidden /> Shipment
              </h2>
              <p className="text-sm text-fg-muted">{order.courierName}</p>
              <p className="font-mono text-sm text-fg">{order.trackingNumber}</p>
            </section>
          )}
          {order.customerNote && (
            <section className="rounded-xl border border-line p-4">
              <h2 className="mb-1 text-sm font-medium text-fg">Your note</h2>
              <p className="text-sm text-fg-muted">{order.customerNote}</p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
