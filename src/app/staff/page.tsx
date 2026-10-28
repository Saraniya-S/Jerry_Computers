import type { Metadata } from "next";
import Link from "next/link";
import { Ban, Boxes, CircleCheck, ClipboardCheck, Inbox, Package, PackageCheck, Truck, Undo2, Wallet } from "lucide-react";
import { Suspense } from "react";
import { outlineButton } from "@/components/account/buttons";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { Kpi, Panel } from "@/components/admin/ui";
import { orderStatusLabel } from "@/lib/money";
import { lowStockProducts } from "@/lib/server/admin/reports";
import { requirePermission } from "@/lib/server/permissions";
import { nextActionLabel, ordersNeedingAction, recentlyUpdatedOrders, STATUS_ORDER, staffMetrics } from "@/lib/server/staff/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

const statusBar: Record<string, string> = {
  placed: "bg-amber-400",
  confirmed: "bg-fg-dim",
  packed: "bg-brand",
  shipped: "bg-sky-500",
  delivered: "bg-leaf",
  returned: "bg-red-400",
  cancelled: "bg-ink-700",
};

export default function StaffDashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const me = await requirePermission("staffPortal.view", "/staff");
  const [m, todo, updated, low] = await Promise.all([staffMetrics(), ordersNeedingAction(8), recentlyUpdatedOrders(6), lowStockProducts(6)]);
  const s = m.status;
  const max = Math.max(1, ...STATUS_ORDER.map((k) => s[k] ?? 0));

  return (
    <>
      <PageHeader
        title={`Hello, ${me.firstName}`}
        description="Confirm new orders, pack, dispatch, and keep payments and tracking up to date."
        actions={
          <Link href="/staff/orders?status=placed" className={outlineButton}>
            <Inbox className="size-4" aria-hidden /> New orders
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 p-5 sm:p-7 lg:grid-cols-5">
        <Kpi icon={<Package className="size-4" aria-hidden />} label="All orders" value={m.total} href="/staff/orders" />
        <Kpi icon={<Inbox className="size-4" aria-hidden />} label="New, to confirm" value={s.placed ?? 0} href="/staff/orders?status=placed" tone={s.placed ? "warn" : undefined} />
        <Kpi icon={<ClipboardCheck className="size-4" aria-hidden />} label="Confirmed, to pack" value={s.confirmed ?? 0} href="/staff/orders?status=confirmed" />
        <Kpi icon={<PackageCheck className="size-4" aria-hidden />} label="Packed, ready to ship" value={s.packed ?? 0} href="/staff/orders?status=packed" />
        <Kpi icon={<Truck className="size-4" aria-hidden />} label="Shipped" value={s.shipped ?? 0} href="/staff/orders?status=shipped" />
        <Kpi icon={<CircleCheck className="size-4" aria-hidden />} label="Delivered" value={s.delivered ?? 0} href="/staff/orders?status=delivered" />
        <Kpi icon={<Ban className="size-4" aria-hidden />} label="Cancelled / returned" value={(s.cancelled ?? 0) + (s.returned ?? 0)} hint={m.refundDue ? `${m.refundDue} refund due` : undefined} href="/staff/returns" />
        <Kpi icon={<Wallet className="size-4" aria-hidden />} label="Online payments to verify" value={m.onlineToVerify} href="/staff/orders?method=online&paymentStatus=pending" tone={m.onlineToVerify ? "warn" : undefined} />
        <Kpi icon={<Wallet className="size-4" aria-hidden />} label="COD to collect" value={m.codToCollect} hint="dispatched, unpaid" href="/staff/orders?method=cod&paymentStatus=pending" />
        <Kpi icon={<Boxes className="size-4" aria-hidden />} label="Low stock" value={m.lowStock} href="/staff/products?stock=low" tone={m.lowStock ? "warn" : undefined} />
      </div>

      <div className="grid gap-4 px-5 pb-7 sm:px-7 xl:grid-cols-[1.6fr_1fr]">
        <div className="grid content-start gap-4">
          <Panel title="Needs action" count={todo.length} href="/staff/orders?sort=oldest">
            {todo.length ? (
              <OrdersTable orders={todo} basePath="/staff/orders" nextAction={nextActionLabel} />
            ) : (
              <EmptyState icon={<CircleCheck className="size-5" aria-hidden />} title="All caught up">
                New orders, orders to pack or dispatch, and online payments to verify show up here.
              </EmptyState>
            )}
          </Panel>
          <Panel title="Recently updated" href="/staff/orders?sort=updated">
            {updated.length ? <OrdersTable orders={updated} basePath="/staff/orders" /> : <p className="px-5 py-4 text-sm text-fg-muted">No orders yet.</p>}
          </Panel>
        </div>
        <div className="grid content-start gap-4">
          <Panel title="Orders by status">
            <ul className="grid gap-2.5 px-4 py-4 text-sm sm:px-5">
              {STATUS_ORDER.map((k) => (
                <li key={k}>
                  <Link href={`/staff/orders?status=${k}`} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 hover:text-brand">
                    <span className="text-fg-muted">{orderStatusLabel[k]}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-ink-900" aria-hidden>
                      <span className={`block h-full rounded-full ${statusBar[k]}`} style={{ width: `${((s[k] ?? 0) / max) * 100}%` }} />
                    </span>
                    <span className="text-right tabular-nums text-fg">{s[k] ?? 0}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Low stock" count={m.lowStock} href="/staff/products?stock=low">
            {low.length ? (
              <ul className="divide-y divide-line text-sm">
                {low.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                    <span className="min-w-0 truncate text-fg">
                      {p.name} <span className="font-mono text-xs text-fg-dim">{p.sku}</span>
                    </span>
                    <span className={`shrink-0 tabular-nums ${p.stock === 0 ? "text-red-600" : "text-amber-700"}`}>{p.stock} left</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-fg-muted">Every live product is above its low-stock level.</p>
            )}
            <p className="border-t border-line px-4 py-2.5 text-xs text-fg-dim sm:px-5">Restocking is done by an admin in Inventory.</p>
          </Panel>
          <Link href="/staff/returns" className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm text-fg hover:border-brand/30">
            <Undo2 className="size-4 text-brand" aria-hidden /> Cancellations, returns and refunds due
          </Link>
        </div>
      </div>
    </>
  );
}
