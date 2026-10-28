import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PaymentBadge, StatusBadge } from "@/components/orders/OrderParts";
import { formatPaise, orderNumber, paymentLabel } from "@/lib/money";
import type { StaffOrder } from "@/lib/server/orders";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Orders for staff: who ordered, what, payment, status and invoice total. */
export function OrdersTable({ orders }: { orders: StaffOrder[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] whitespace-nowrap text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-fg-dim">
            {["Order", "Customer", "Placed", "Items", "Payment", "Status", "Total", ""].map((c) => (
              <th key={c} scope="col" className="px-5 py-2.5 font-medium first:sm:pl-7">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {orders.map((o) => (
            <tr key={o.id} className="group relative hover:bg-ink-950">
              <td className="px-5 py-3.5 font-medium text-fg sm:pl-7">
                <Link href={`/admin/orders/${o.id}`} className="after:absolute after:inset-0 group-hover:text-brand">
                  {orderNumber(o.seq)}
                </Link>
              </td>
              <td className="px-5 py-3.5">
                <span className="block text-fg">{o.customer.companyName ?? `${o.customer.firstName} ${o.customer.lastName}`.trim()}</span>
                <span className="block text-xs text-fg-dim">{o.customer.email}</span>
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
              <td className="px-5 py-3.5 text-right text-fg-dim group-hover:text-brand">
                <ChevronRight className="ml-auto size-4" aria-hidden />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
