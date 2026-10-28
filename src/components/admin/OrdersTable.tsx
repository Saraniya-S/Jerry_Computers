import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/admin/ui";
import { PaymentBadge, StatusBadge } from "@/components/orders/OrderParts";
import { formatPaise, orderNumber, paymentLabel } from "@/lib/money";
import type { StaffOrder } from "@/lib/server/orders";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/**
 * Orders for staff: who ordered, what, payment, status and total. Shared by the admin and staff
 * areas; basePath decides where rows link to. nextAction adds a "to do" column.
 */
export function OrdersTable({ orders, basePath = "/admin/orders", nextAction }: { orders: StaffOrder[]; basePath?: string; nextAction?: (o: StaffOrder) => string | null }) {
  const cols = ["Order", "Customer", "Placed", "Items", "Payment", "Status", ...(nextAction ? ["Next"] : []), "Total", ""];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] whitespace-nowrap text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-fg-dim">
            {cols.map((c, i) => (
              <th key={i} scope="col" className="px-5 py-2.5 font-medium first:sm:pl-7">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {orders.map((o) => {
            const next = nextAction?.(o);
            return (
              <tr key={o.id} className="group relative hover:bg-ink-950">
                <td className="px-5 py-3.5 font-medium text-fg sm:pl-7">
                  <Link href={`${basePath}/${o.id}`} className="after:absolute after:inset-0 group-hover:text-brand">
                    {orderNumber(o.seq)}
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <span className="block text-fg">{o.customer.companyName ?? `${o.customer.firstName} ${o.customer.lastName}`.trim()}</span>
                  <span className="block text-xs text-fg-dim">{o.customer.phone ?? o.customer.email}</span>
                </td>
                <td className="px-5 py-3.5 text-fg-muted">
                  {dateFmt.format(o.createdAt)}
                  {o.updatedAt.getTime() - o.createdAt.getTime() > 60_000 && <span className="block text-xs text-fg-dim">updated {dateFmt.format(o.updatedAt)}</span>}
                </td>
                <td className="px-5 py-3.5 text-fg-muted">{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                <td className="px-5 py-3.5">
                  <span className="block text-xs text-fg-muted">{paymentLabel[o.paymentMethod]}</span>
                  <PaymentBadge status={o.paymentStatus} />
                </td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={o.status} />
                </td>
                {nextAction && <td className="px-5 py-3.5">{next ? <Badge tone="warn">{next}</Badge> : <span className="text-fg-dim">—</span>}</td>}
                <td className="px-5 py-3.5 tabular-nums text-fg">{formatPaise(o.totalPaise)}</td>
                <td className="px-5 py-3.5 text-right text-fg-dim group-hover:text-brand">
                  <ChevronRight className="ml-auto size-4" aria-hidden />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
