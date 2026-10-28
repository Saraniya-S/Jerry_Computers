import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/account/PageHeader";
import { OrdersIndex } from "@/components/orders/staff/OrdersIndex";
import { requireAdmin } from "@/lib/server/permissions";

export const metadata: Metadata = { title: "Orders" };

export default function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Orders searchParams={searchParams} />
    </Suspense>
  );
}

async function Orders({ searchParams }: Pick<PageProps<"/admin/orders">, "searchParams">) {
  await requireAdmin();
  return <OrdersIndex sp={await searchParams} basePath="/admin/orders" description="Confirm, pack and dispatch orders, and record payments (which emails the invoice PDF)." />;
}
