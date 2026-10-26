import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";
import { Suspense } from "react";
import { outlineButton } from "@/components/account/buttons";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { requireCustomer } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Orders" };

const columns = ["Order", "Placed", "Items", "Payment", "Status", "Tracking"];

export default function OrdersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Orders />
    </Suspense>
  );
}

async function Orders() {
  await requireCustomer();
  return (
    <>
      <PageHeader title="Orders" count={0} description="Online and cash-on-delivery orders, with courier tracking once shipped." />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-fg-dim">
              {columns.map((c) => (
                <th key={c} scope="col" className="px-5 py-2.5 font-medium first:sm:pl-7">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>
      <EmptyState icon={<Package className="size-5" aria-hidden />} title="No orders yet" action={<Link href="/products" className={outlineButton}>Browse products</Link>}>
        Orders you place will be listed here with payment status, courier name and tracking number.
      </EmptyState>
    </>
  );
}
