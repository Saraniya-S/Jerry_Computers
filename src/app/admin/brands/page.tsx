import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { BrandManager } from "@/components/admin/BrandManager";
import { listBrands } from "@/lib/server/admin/catalogue";
import { requirePermission } from "@/lib/server/permissions";

export const metadata: Metadata = { title: "Brands" };

export default function BrandsPage({ searchParams }: PageProps<"/admin/brands">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Brands searchParams={searchParams} />
    </Suspense>
  );
}

async function Brands({ searchParams }: Pick<PageProps<"/admin/brands">, "searchParams">) {
  await requirePermission("catalogue.manage");
  const { q: raw } = await searchParams;
  const q = typeof raw === "string" ? raw.trim().slice(0, 60) : "";
  const rows = await listBrands(q);
  return (
    <>
      <PageHeader title="Brands" count={rows.length} description="Manufacturers you sell. Choose a brand on each product; renaming one updates its products." />
      <BrandManager brands={rows.map((r) => ({ ...r.b, products: r.products }))} query={q} />
    </>
  );
}
