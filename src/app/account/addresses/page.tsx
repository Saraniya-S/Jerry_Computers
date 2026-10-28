import type { Metadata } from "next";
import { Suspense } from "react";
import { AddressBook } from "@/components/account/AddressBook";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { requireCustomer } from "@/lib/server/auth";
import { listAddresses, MAX_ADDRESSES } from "@/lib/server/customer";

export const metadata: Metadata = { title: "Addresses" };

export default function AddressesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Addresses />
    </Suspense>
  );
}

async function Addresses() {
  const viewer = await requireCustomer();
  const rows = await listAddresses(viewer.id);
  return (
    <>
      <PageHeader title="Addresses" count={rows.length} description="Where we deliver orders and send engineers." />
      <AddressBook
        max={MAX_ADDRESSES}
        defaultName={`${viewer.firstName} ${viewer.lastName}`.trim()}
        defaultPhone={viewer.phone ?? ""}
        addresses={rows.map((a) => ({
          id: a.id,
          isDefault: a.isDefault,
          label: a.label,
          recipientName: a.recipientName,
          phone: a.phone,
          phoneDisplay: a.phone,
          line1: a.line1,
          line2: a.line2 ?? "",
          landmark: a.landmark ?? "",
          city: a.city,
          state: a.state,
          postalCode: a.postalCode,
        }))}
      />
    </>
  );
}
