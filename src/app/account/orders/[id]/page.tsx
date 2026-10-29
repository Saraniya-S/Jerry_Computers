import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck, Truck } from "lucide-react";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { AddressBlock, InvoiceCard, OrderLines, PaymentBadge, StatusBadge } from "@/components/orders/OrderParts";
import { PayNow } from "@/components/orders/PayNow";
import { formatPaise, orderNumber, paymentLabel } from "@/lib/money";
import { requireCustomer } from "@/lib/server/auth";
import { getCustomerOrder } from "@/lib/server/orders";

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

  return (
    <>
      <PageHeader
        title={
          <>
            {orderNumber(order.seq)} <StatusBadge status={order.status} /> <PaymentBadge status={order.paymentStatus} />
          </>
        }
        description={`Placed ${dateFmt.format(order.createdAt)} · ${paymentLabel[order.paymentMethod]}`}
        actions={
          <Link href="/account/orders" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden /> All orders
          </Link>
        }
      />
      <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[1fr_300px]">
        <div className="grid content-start gap-6">
          {placed === "1" && (
            <div className="flex items-start gap-3 rounded-xl border border-leaf-mid/25 bg-mint-soft px-4 py-3.5 text-sm text-leaf">
              <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">Order placed — thank you!</p>
                <p className="mt-0.5 text-leaf/80">
                  {order.paymentMethod === "online" && order.paymentStatus === "pending" ? "Complete the payment below to confirm it." : `We'll send updates to ${viewer.email}. Your GST invoice follows once payment is received.`}
                </p>
              </div>
            </div>
          )}
          {order.invoice ? (
            <InvoiceCard invoice={order.invoice} href={`/account/orders/${order.id}/invoice`} />
          ) : order.paymentMethod === "online" && order.paymentStatus === "pending" && order.status !== "cancelled" && order.status !== "returned" ? (
            <PayNow orderId={order.id} amountLabel={formatPaise(order.totalPaise)} autoStart={pay === "1"} />
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
