import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";
import { Suspense } from "react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { DateRange, dateParam, FilterBar, FilterSelect, oneOf, pageParam, Pagination, param, SearchInput } from "@/components/admin/ui";
import { orderStatusLabel, paymentStatusLabel } from "@/lib/money";
import type { OrderStatus, PaymentStatus } from "@/lib/server/db/schema";
import { orderStats, searchOrders, type OrderFilter } from "@/lib/server/orders";
import { requirePermission } from "@/lib/server/permissions";

export const metadata: Metadata = { title: "Orders" };

const tabs: (OrderFilter | "all")[] = ["all", "unpaid", "placed", "packed", "shipped", "delivered", "cancelled"];
const tabLabel = (t: OrderFilter | "all") => (t === "all" ? "All" : t === "unpaid" ? "Payment pending" : orderStatusLabel[t]);
const paymentStatuses: PaymentStatus[] = ["pending", "paid", "refund_pending", "refunded"];
const sorts = { newest: "Newest first", oldest: "Oldest first", total_desc: "Total, high to low", total_asc: "Total, low to high" } as const;
const PAGE_SIZE = 25;

export default function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Orders searchParams={searchParams} />
    </Suspense>
  );
}

async function Orders({ searchParams }: Pick<PageProps<"/admin/orders">, "searchParams">) {
  await requirePermission("orders.view");
  const sp = await searchParams;
  const status = oneOf(sp.status, tabs.filter((t) => t !== "all") as OrderFilter[]);
  const f = {
    q: param(sp.q),
    paymentMethod: oneOf(sp.method, ["cod", "online"] as const),
    paymentStatus: oneOf(sp.paymentStatus, paymentStatuses),
    from: dateParam(sp.from),
    to: dateParam(sp.to),
    sort: oneOf(sp.sort, Object.keys(sorts) as (keyof typeof sorts)[]),
    page: pageParam(sp.page),
  };
  const [{ rows, total }, stats] = await Promise.all([searchOrders({ ...f, filter: status, pageSize: PAGE_SIZE }), orderStats()]);
  const all = Object.values(stats.status).reduce((a, b) => a + (b ?? 0), 0);
  const params = { status, q: f.q, method: f.paymentMethod, paymentStatus: f.paymentStatus, from: f.from, to: f.to, sort: f.sort };
  const keep = (extra: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(Object.entries({ ...params, ...extra }).filter((e): e is [string, string] => Boolean(e[1]))).toString();
    return qs ? `/admin/orders?${qs}` : "/admin/orders";
  };
  const filtered = Boolean(f.q || f.paymentMethod || f.paymentStatus || f.from || f.to);

  return (
    <>
      <PageHeader title="Orders" count={total} description="Record payments (which emails the invoice PDF), then pack, dispatch and deliver." />
      <nav aria-label="Filter by status" className="flex gap-1 overflow-x-auto border-b border-line px-3 sm:px-5">
        {tabs.map((t) => {
          const active = (t === "all" && !status) || t === status;
          const n = t === "all" ? all : t === "unpaid" ? stats.unpaid : (stats.status[t as OrderStatus] ?? 0);
          return (
            <Link
              key={t}
              href={keep({ status: t === "all" ? undefined : t })}
              aria-current={active ? "page" : undefined}
              className={`relative flex shrink-0 items-center gap-1.5 px-3 py-3 text-sm transition-colors ${active ? "font-medium text-fg" : "text-fg-muted hover:text-fg"}`}
            >
              {tabLabel(t)}
              <span className="rounded-md bg-ink-900 px-1.5 font-mono text-[11px] text-fg-dim">{n}</span>
              {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" />}
            </Link>
          );
        })}
      </nav>
      <FilterBar resetHref={status ? `/admin/orders?status=${status}` : "/admin/orders"}>
        {status && <input type="hidden" name="status" value={status} />}
        <SearchInput value={f.q} placeholder="Order no., name, email or phone" label="Search orders" />
        <FilterSelect name="method" value={f.paymentMethod ?? ""} label="Payment method" all="Any payment method" options={[{ value: "cod", label: "Cash on delivery" }, { value: "online", label: "Online payment" }]} />
        <FilterSelect name="paymentStatus" value={f.paymentStatus ?? ""} label="Payment status" all="Any payment status" options={paymentStatuses.map((s) => ({ value: s, label: paymentStatusLabel[s] }))} />
        <DateRange from={f.from} to={f.to} />
        <FilterSelect name="sort" value={f.sort ?? ""} label="Sort" all={sorts.newest} options={Object.entries(sorts).filter(([k]) => k !== "newest").map(([value, label]) => ({ value, label }))} />
      </FilterBar>
      {rows.length ? (
        <>
          <OrdersTable orders={rows} />
          <Pagination page={f.page} pageSize={PAGE_SIZE} total={total} params={params} path="/admin/orders" />
        </>
      ) : (
        <EmptyState icon={<Package className="size-5" aria-hidden />} title={filtered ? "No orders match these filters" : status ? `No orders: ${tabLabel(status).toLowerCase()}` : "No orders yet"}>
          {filtered ? "Try widening the dates or clearing a filter." : "Orders customers place from the store appear here."}
        </EmptyState>
      )}
    </>
  );
}
