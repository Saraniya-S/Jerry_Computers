import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { ShopForm, StoreForm } from "@/components/admin/SettingsForms";
import { paiseToInput } from "@/lib/money";
import { requireStaff } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Shop settings" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  await requireStaff(["admin"]);
  const [shop, store] = await Promise.all([getSettings("shop"), getSettings("store")]);
  return (
    <>
      <PageHeader title="Shop settings" description="Contact details, invoice details and checkout rules." />
      <ShopForm initial={shop} />
      <div className="border-t border-line" />
      <StoreForm initial={{ shipping: store.shippingPaise ? paiseToInput(store.shippingPaise) : "", freeAbove: store.freeShippingAbovePaise ? paiseToInput(store.freeShippingAbovePaise) : "", codEnabled: store.codEnabled }} />
    </>
  );
}
