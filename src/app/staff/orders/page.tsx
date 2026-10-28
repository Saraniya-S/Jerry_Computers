import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/account/PageHeader";
import { OrdersIndex } from "@/components/orders/staff/OrdersIndex";
import { requirePermission } from "@/lib/server/permissions";

export const metadata: Metadata = { title: "Orders" };

export default function StaffOrdersPage({ searchParams }: PageProps<"/staff/orders">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Orders searchParams={searchParams} />
    </Suspense>
  );
}

async function Orders({ searchParams }: Pick<PageProps<"/staff/orders">, "searchParams">) {
  await requirePermission("orders.view", "/staff/orders");
  return <OrdersIndex sp={await searchParams} basePath="/staff/orders" description="Confirm new orders, pack and dispatch them, and record payments once they've been verified or collected." />;
}
