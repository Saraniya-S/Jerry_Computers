import Link from "next/link";
import { ArrowLeftRight, Boxes, ClipboardList, ClipboardPlus, HardHat, IndianRupee, Package, ScrollText, Users, Wallet, Warehouse } from "lucide-react";
import { Suspense } from "react";
import { outlineButton, primaryButton } from "@/components/account/buttons";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { ServiceStatusBadge } from "@/components/admin/ServiceBadges";
import { Badge, dateTimeFmt, Kpi, Panel, personName, Table, td } from "@/components/admin/ui";
import { formatPaise } from "@/lib/money";
import { dashboardMetrics, lowStockProducts, recentServiceRequests } from "@/lib/server/admin/reports";
import { listAudit } from "@/lib/server/admin/users";
import { listOrders } from "@/lib/server/orders";
import { requirePermission } from "@/lib/server/permissions";
import { deviceTypeLabel, serviceNumber } from "@/lib/service-desk";

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const staff = await requirePermission("dashboard.view");
  const [m, recent, jobs, low, activity] = await Promise.all([dashboardMetrics(), listOrders({ limit: 6 }), recentServiceRequests(6), lowStockProducts(6), listAudit({ pageSize: 8 })]);

  return (
    <>
      <PageHeader
        title={`Hello, ${staff.firstName}`}
        description="Today across the store and the service desk."
        actions={
          <>
            <Link href="/admin/products/new" className={outlineButton}>
              <Boxes className="size-4" aria-hidden /> Add product
            </Link>
            <Link href="/admin/service-requests/new" className={primaryButton}>
              <ClipboardPlus className="size-4" aria-hidden /> New service request
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 p-5 sm:p-7 lg:grid-cols-4 2xl:grid-cols-8">
        <Kpi icon={<Package className="size-4" aria-hidden />} label="Orders" value={m.totalOrders} hint={`${m.orders.cancelled ?? 0} cancelled`} href="/admin/orders" />
        <Kpi icon={<Package className="size-4" aria-hidden />} label="To pack or ship" value={m.pendingOrders} href="/admin/orders?status=placed" tone={m.pendingOrders ? "warn" : undefined} />
        <Kpi
          icon={<IndianRupee className="size-4" aria-hidden />}
          label="Collected this month"
          value={formatPaise(m.money.collected)}
          hint={m.money.refunded ? `${formatPaise(m.money.refunded)} refunded` : `${m.money.payments} payment${m.money.payments === 1 ? "" : "s"}`}
          href="/admin/reports"
        />
        <Kpi icon={<Wallet className="size-4" aria-hidden />} label="Awaiting payment" value={m.unpaid.n} hint={formatPaise(m.unpaid.value)} href="/admin/orders?paymentStatus=pending" />
        <Kpi icon={<Boxes className="size-4" aria-hidden />} label="Products live" value={m.products.live} hint={`${m.products.total} in catalogue`} href="/admin/products" />
        <Kpi icon={<Warehouse className="size-4" aria-hidden />} label="Low stock" value={m.products.low} href="/admin/inventory?stock=low" tone={m.products.low ? "warn" : undefined} />
        <Kpi icon={<Users className="size-4" aria-hidden />} label="Active customers" value={m.customers.active} hint={`${m.customers.ordered90} ordered in 90 days`} href="/admin/customers" />
        <Kpi icon={<ClipboardList className="size-4" aria-hidden />} label="Open service jobs" value={m.openServices} hint={m.unassignedServices ? `${m.unassignedServices} unassigned` : undefined} href="/admin/service-requests?status=active" tone={m.unassignedServices ? "warn" : undefined} />
      </div>

      <div className="grid gap-3 px-5 sm:px-7 lg:grid-cols-2">
        <Link href="/admin/engineers" className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm transition-colors hover:border-brand/30">
          <HardHat className="size-4 text-brand" aria-hidden />
          <span className="text-fg">
            <span className="font-semibold tabular-nums">{m.engineers.available}</span> of {m.engineers.total} engineers available for new jobs
          </span>
        </Link>
        <Link
          href="/admin/transfers"
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${m.pendingTransfers ? "border-amber-200 bg-amber-50 text-amber-900" : "border-line text-fg hover:border-brand/30"}`}
        >
          <ArrowLeftRight className="size-4" aria-hidden />
          <span>
            <span className="font-semibold tabular-nums">{m.pendingTransfers}</span> engineer transfer request{m.pendingTransfers === 1 ? "" : "s"} waiting for approval
          </span>
        </Link>
      </div>

      <div className="grid gap-4 p-5 sm:p-7 xl:grid-cols-[1.6fr_1fr]">
        <div className="grid content-start gap-4">
          <Panel title="Recent orders" href="/admin/orders">
            {recent.length ? (
              <OrdersTable orders={recent} />
            ) : (
              <EmptyState icon={<Package className="size-5" aria-hidden />} title="No orders yet">
                Orders customers place from the store will show up here.
              </EmptyState>
            )}
          </Panel>
          <Panel title="Recent service requests" href="/admin/service-requests">
            {jobs.length ? (
              <Table columns={["Ticket", "Customer", "Device", "Engineer", "Status", "Created"]} minWidth={680}>
                {jobs.map(({ r, engineerName }) => (
                  <tr key={r.id} className="group relative hover:bg-ink-950">
                    <td className={`${td} font-medium`}>
                      <Link href={`/admin/service-requests/${r.id}`} className="after:absolute after:inset-0 group-hover:text-brand">
                        {serviceNumber(r.seq)}
                      </Link>
                    </td>
                    <td className={`${td} text-fg`}>{r.contactName}</td>
                    <td className={`${td} text-fg-muted`}>{deviceTypeLabel[r.deviceType]}</td>
                    <td className={`${td} text-fg-muted`}>{engineerName ?? <Badge tone="warn">Unassigned</Badge>}</td>
                    <td className={td}>
                      <ServiceStatusBadge status={r.status} />
                    </td>
                    <td className={`${td} text-fg-muted`}>{dateTimeFmt.format(r.createdAt)}</td>
                  </tr>
                ))}
              </Table>
            ) : (
              <EmptyState icon={<ClipboardList className="size-5" aria-hidden />} title="No service requests yet" action={<Link href="/admin/service-requests/new" className={outlineButton}>Create one</Link>}>
                Walk-in and phone jobs you log appear here, already assigned to an engineer.
              </EmptyState>
            )}
          </Panel>
        </div>

        <div className="grid content-start gap-4">
          <Panel title="Low stock" href="/admin/inventory?stock=low" count={m.products.low}>
            {low.length ? (
              <ul className="divide-y divide-line text-sm">
                {low.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                    <Link href={`/admin/inventory?q=${encodeURIComponent(p.sku)}`} className="min-w-0 truncate text-fg hover:text-brand">
                      {p.name}
                      <span className="ml-1.5 font-mono text-xs text-fg-dim">{p.sku}</span>
                    </Link>
                    <span className={`shrink-0 tabular-nums ${p.stock === 0 ? "text-red-600" : "text-amber-700"}`}>
                      {p.stock} <span className="text-xs text-fg-dim">/ {p.threshold}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-fg-muted">Every live product is above its low-stock level.</p>
            )}
          </Panel>
          <Panel title="Service desk" href="/admin/service-requests">
            <dl className="grid grid-cols-2 gap-px bg-line text-sm">
              {(
                [
                  ["Unassigned", m.services.open],
                  ["Assigned, not accepted", m.services.assigned],
                  ["Accepted", m.services.accepted],
                  ["In progress", m.services.in_progress],
                  ["Awaiting parts", m.services.awaiting_parts],
                  ["Awaiting customer", m.services.awaiting_customer],
                  ["Handed back", m.services.unable_to_complete],
                  ["Completed", m.services.completed],
                  ["Cancelled", m.services.cancelled],
                ] as const
              ).map(([label, n]) => (
                <div key={label} className="bg-ink-850 px-4 py-3">
                  <dt className="text-xs text-fg-muted">{label}</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums text-fg">{n ?? 0}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title="Recent activity" href="/admin/activity">
            {activity.rows.length ? (
              <ul className="divide-y divide-line text-sm">
                {activity.rows.map(({ log, actorFirst, actorLast }) => (
                  <li key={log.id} className="px-4 py-2.5 sm:px-5">
                    <p className="text-fg">{log.summary}</p>
                    <p className="mt-0.5 text-xs text-fg-dim">
                      {personName(actorFirst, actorLast) || "System"} · {dateTimeFmt.format(log.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<ScrollText className="size-5" aria-hidden />} title="Nothing logged yet">
                Changes to products, stock, orders, staff and service jobs are recorded here.
              </EmptyState>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
