import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/account/PageHeader";
import { OrderDetail } from "@/components/orders/staff/OrderDetail";
import { requireAdmin } from "@/lib/server/permissions";

export const metadata: Metadata = { title: "Order" };

export default function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Order params={params} />
    </Suspense>
  );
}

async function Order({ params }: Pick<PageProps<"/admin/orders/[id]">, "params">) {
  const staff = await requireAdmin();
  return <OrderDetail id={(await params).id} staff={staff} basePath="/admin/orders" />;
}
