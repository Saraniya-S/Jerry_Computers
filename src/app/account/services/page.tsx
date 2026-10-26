import type { Metadata } from "next";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { Suspense } from "react";
import { primaryButton } from "@/components/account/buttons";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { requireCustomer } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Service requests" };

const columns = ["Ticket", "Device", "Type", "Engineer", "Status", "Updated"];

export default function ServicesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Services />
    </Suspense>
  );
}

async function Services() {
  await requireCustomer();
  return (
    <>
      <PageHeader
        title="Service requests"
        count={0}
        description="Repairs at the shop and on-site engineer visits."
        actions={
          <Link href="/services/request" className={primaryButton}>
            <Wrench className="size-4" aria-hidden /> New request
          </Link>
        }
      />
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
      <EmptyState icon={<Wrench className="size-5" aria-hidden />} title="No service requests">
        Book a repair for a laptop, desktop, CCTV system, printer or UPS. You&apos;ll see the assigned engineer and progress here.
      </EmptyState>
    </>
  );
}
