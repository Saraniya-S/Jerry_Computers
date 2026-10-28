import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { ProductAdminPanel } from "@/components/admin/ProductAdminPanel";
import { ProductForm } from "@/components/admin/ProductForm";
import { Badge, fullDateTimeFmt } from "@/components/admin/ui";
import { FormAlert } from "@/components/auth/ui";
import type { ProductCategoryId, ProductUse } from "@/data/products";
import { paiseToInput } from "@/lib/money";
import { productDeleteBlocker } from "@/lib/server/admin/catalogue";
import { productFormOptions } from "@/lib/server/admin/product-options";
import { db, schema } from "@/lib/server/db";
import { requirePermission } from "@/lib/server/permissions";

export const metadata: Metadata = { title: "Edit product" };

export default function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditProduct params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EditProduct({ params, searchParams }: Pick<PageProps<"/admin/products/[id]">, "params" | "searchParams">) {
  await requirePermission("catalogue.manage");
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  const [p] = /^[0-9a-f-]{36}$/i.test(id) ? await db.select().from(schema.products).where(eq(schema.products.id, id)) : [];
  if (!p) notFound();
  const [options, variants, deleteBlocker] = await Promise.all([
    productFormOptions(),
    db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, p.id)).orderBy(asc(schema.productVariants.sortOrder), asc(schema.productVariants.name)),
    productDeleteBlocker(p.id),
  ]);

  return (
    <>
      <PageHeader
        title={
          <>
            {p.name} {p.archivedAt && <Badge tone="muted">Archived</Badge>}
          </>
        }
        description={`${p.sku} · last updated ${fullDateTimeFmt.format(p.updatedAt)}`}
        actions={
          <>
            {p.isActive && (
              <Link href={`/products/${p.slug}`} target="_blank" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
                View in store <ExternalLink className="size-3.5" aria-hidden />
              </Link>
            )}
            <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
              <ArrowLeft className="size-4" aria-hidden /> All products
            </Link>
          </>
        }
      />
      {created === "1" && (
        <div className="px-5 pt-5 sm:px-7">
          <FormAlert tone="success">Product created.</FormAlert>
        </div>
      )}
      <ProductForm
        id={p.id}
        archived={Boolean(p.archivedAt)}
        options={options}
        initial={{
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          brandId: p.brandId ?? "",
          subcategoryId: p.subcategoryId ?? "",
          category: p.category as ProductCategoryId,
          summary: p.summary,
          description: p.description,
          uses: p.uses as ProductUse[],
          specs: p.specs,
          images: p.images,
          price: paiseToInput(p.pricePaise),
          mrp: paiseToInput(p.mrpPaise),
          gstRateBp: p.gstRateBp,
          stock: p.stock,
          lowStockThreshold: p.lowStockThreshold,
          isActive: p.isActive,
          isFeatured: p.isFeatured,
          artVariant: p.artVariant,
        }}
      />
      <ProductAdminPanel
        productId={p.id}
        name={p.name}
        archived={Boolean(p.archivedAt)}
        deleteBlocker={deleteBlocker}
        variants={variants.map((v) => ({ id: v.id, sku: v.sku, name: v.name, attributes: v.attributes, price: paiseToInput(v.pricePaise), stock: v.stock, isActive: v.isActive }))}
      />
    </>
  );
}
