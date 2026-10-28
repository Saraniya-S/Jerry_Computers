import type { Metadata } from "next";
import Link from "next/link";
import { Undo2 } from "lucide-react";
import { Suspense } from "react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { oneOf, pageParam, Pagination } from "@/components/admin/ui";
import { requirePermission } from "@/lib/server/permissions";
import { cancellationsAndReturns } from "@/lib/server/staff/dashboard";

export const metadata: Metadata = { title: "Cancellations & returns" };

const tabs = [
  ["", "All"],
  ["cancelled", "Cancelled"],
  ["returned", "Returned by courier"],
  ["refund_due", "Refund due"],
] as const;

export default function ReturnsPage({ searchParams }: PageProps<"/staff/returns">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Returns searchParams={searchParams} />
    </Suspense>
  );
}

async function Returns({ searchParams }: Pick<PageProps<"/staff/returns">, "searchParams">) {
  await requirePermission("orders.view", "/staff/returns");
  const sp = await searchParams;
  const kind = oneOf(sp.kind, ["cancelled", "returned", "refund_due"] as const);
  const page = pageParam(sp.page);
  const { rows, total, pageSize } = await cancellationsAndReturns({ kind, page });

  return (
    <>
      <PageHeader title="Cancellations & returns" count={total} description="Orders cancelled before dispatch and parcels the courier brought back, with their refund state." />
      <nav aria-label="Filter" className="flex gap-1 overflow-x-auto border-b border-line px-3 sm:px-5">
        {tabs.map(([k, label]) => (
          <Link key={k || "all"} href={k ? `/staff/returns?kind=${k}` : "/staff/returns"} aria-current={(kind ?? "") === k ? "page" : undefined} className={`relative shrink-0 px-3 py-3 text-sm ${(kind ?? "") === k ? "font-medium text-fg" : "text-fg-muted hover:text-fg"}`}>
            {label}
            {(kind ?? "") === k && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" />}
          </Link>
        ))}
      </nav>
      <div className="border-b border-line bg-ink-950 px-5 py-3 text-sm text-fg-muted sm:px-7">
        <p>
          To cancel an order, open it and use <span className="text-fg">Reject</span> or <span className="text-fg">Cancel order</span> (before dispatch). A parcel the courier returns is recorded from the order&apos;s shipment as <span className="text-fg">Returned to shop</span>.
        </p>
        <p className="mt-1">
          “Refund due” means money has to go back. Refunds are recorded by an admin only after they&apos;ve actually been sent; no payment gateway is connected to issue them automatically. Customers can&apos;t request returns or cancellations online yet.
        </p>
      </div>
      {rows.length ? (
        <>
          <OrdersTable orders={rows} basePath="/staff/orders" />
          <Pagination page={page} pageSize={pageSize} total={total} params={{ kind }} path="/staff/returns" />
        </>
      ) : (
        <EmptyState icon={<Undo2 className="size-5" aria-hidden />} title="Nothing here">
          Cancelled and returned orders appear here.
        </EmptyState>
      )}
    </>
  );
}
