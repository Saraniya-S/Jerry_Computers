import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { emptyProduct, ProductForm } from "@/components/admin/ProductForm";
import { productFormOptions } from "@/lib/server/admin/product-options";
import { requirePermission } from "@/lib/server/permissions";

export const metadata: Metadata = { title: "Add product" };

export default function NewProductPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewProduct />
    </Suspense>
  );
}

async function NewProduct() {
  await requirePermission("catalogue.manage");
  const options = await productFormOptions();
  return (
    <>
      <PageHeader
        title="Add product"
        description="It goes live in the store as soon as it's created, unless you switch “Show in the store” off."
        actions={
          <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden /> All products
          </Link>
        }
      />
      <ProductForm id={null} initial={emptyProduct} options={options} />
    </>
  );
}
