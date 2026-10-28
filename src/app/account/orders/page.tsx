import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import { Suspense } from "react";
import { outlineButton } from "@/components/account/buttons";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { PaymentBadge, StatusBadge } from "@/components/orders/OrderParts";
import { formatPaise, orderNumber, paymentLabel } from "@/lib/money";
import { requireCustomer } from "@/lib/server/auth";
import { listCustomerOrders } from "@/lib/server/orders";

export const metadata: Metadata = { title: "Orders" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function OrdersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Orders />
    </Suspense>
  );
}

async function Orders() {
  const viewer = await requireCustomer();
  const orders = await listCustomerOrders(viewer.id);
  return (
    <>
      <PageHeader title="Orders" count={orders.length} description="Online and cash-on-delivery orders, with invoices and courier tracking." />
      {orders.length === 0 ? (
        <EmptyState icon={<Package className="size-5" aria-hidden />} title="No orders yet" action={<Link href="/products" className={outlineButton}>Browse products</Link>}>
          Orders you place will be listed here with their invoice, payment and tracking details.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] whitespace-nowrap text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-fg-dim">
                {["Order", "Placed", "Items", "Payment", "Status", "Total", ""].map((c) => (
                  <th key={c} scope="col" className="px-5 py-2.5 font-medium first:sm:pl-7">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id} className="group hover:bg-ink-950">
                  <td className="px-5 py-3.5 font-medium text-fg sm:pl-7">
                    <Link href={`/account/orders/${o.id}`} className="after:absolute after:inset-0 hover:text-brand">
                      {orderNumber(o.seq)}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-fg-muted">{dateFmt.format(o.createdAt)}</td>
                  <td className="px-5 py-3.5 text-fg-muted">{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                  <td className="px-5 py-3.5">
                    <span className="block text-xs text-fg-muted">{paymentLabel[o.paymentMethod]}</span>
                    <PaymentBadge status={o.paymentStatus} />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-5 py-3.5 tabular-nums text-fg">{formatPaise(o.totalPaise)}</td>
                  <td className="relative px-5 py-3.5 text-right">
                    <Link href={`/account/orders/${o.id}`} aria-label={`View ${orderNumber(o.seq)}`} className="text-fg-dim group-hover:text-brand">
                      <ChevronRight className="ml-auto size-4" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
