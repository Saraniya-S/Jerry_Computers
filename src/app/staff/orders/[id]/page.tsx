import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/account/PageHeader";
import { OrderDetail } from "@/components/orders/staff/OrderDetail";
import { requirePermission } from "@/lib/server/permissions";

export const metadata: Metadata = { title: "Order" };

export default function StaffOrderPage({ params }: PageProps<"/staff/orders/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Order params={params} />
    </Suspense>
  );
}

async function Order({ params }: Pick<PageProps<"/staff/orders/[id]">, "params">) {
  const staff = await requirePermission("orders.view", "/staff/orders");
  return <OrderDetail id={(await params).id} staff={staff} basePath="/staff/orders" customerHref={(id) => `/staff/customers/${id}`} />;
}
