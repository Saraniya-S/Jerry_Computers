import type { Metadata } from "next";
import { and, asc, count, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { Boxes } from "lucide-react";
import { Suspense } from "react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { Badge, FilterBar, FilterSelect, oneOf, pageParam, Pagination, param, SearchInput, Table, td } from "@/components/admin/ui";
import { ProductImage } from "@/components/products/ProductImage";
import { formatPrice, getCategory, productCategories, type ProductCategoryId } from "@/data/products";
import { reservedByProduct } from "@/lib/server/admin/inventory";
import { toProduct } from "@/lib/server/catalogue";
import { db, schema } from "@/lib/server/db";
import { requirePermission } from "@/lib/server/permissions";

export const metadata: Metadata = { title: "Products & stock" };

const PAGE_SIZE = 25;

export default function StaffProductsPage({ searchParams }: PageProps<"/staff/products">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Products searchParams={searchParams} />
    </Suspense>
  );
}

/** Read-only product and stock lookup for answering customers and packing orders. */
async function Products({ searchParams }: Pick<PageProps<"/staff/products">, "searchParams">) {
  await requirePermission("catalogue.view", "/staff/products");
  const sp = await searchParams;
  const q = param(sp.q);
  const category = productCategories.some((c) => c.id === sp.category) ? (sp.category as ProductCategoryId) : undefined;
  const stock = oneOf(sp.stock, ["low", "out", "in"] as const);
  const page = pageParam(sp.page);
  const p = schema.products;
  const where: SQL[] = [isNull(p.archivedAt)];
  if (q) where.push(or(ilike(p.name, `%${q}%`), ilike(p.sku, `%${q}%`), ilike(p.brand, `%${q}%`), sql`exists (select 1 from ${schema.productVariants} v where v.product_id = ${p.id} and v.sku ilike ${`%${q}%`})`)!);
  if (category) where.push(eq(p.category, category));
  if (stock === "low") where.push(sql`${p.stock} <= ${p.lowStockThreshold}`);
  if (stock === "out") where.push(eq(p.stock, 0));
  if (stock === "in") where.push(sql`${p.stock} > 0`);
  const [rows, [{ n }]] = await Promise.all([
    db
      .select()
      .from(p)
      .where(and(...where))
      .orderBy(asc(p.name))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(p).where(and(...where)),
  ]);
  const reserved = await reservedByProduct(db, rows.map((r) => r.id));

  return (
    <>
      <PageHeader title="Products & stock" count={n} description="Look up prices and what's on the shelf. Available stock already excludes units in open orders. Prices, products and stock changes are managed by admins." />
      <FilterBar resetHref="/staff/products">
        <SearchInput value={q} placeholder="Name, SKU or brand" label="Search products" />
        <FilterSelect name="category" value={category ?? ""} label="Department" all="All departments" options={productCategories.map((c) => ({ value: c.id, label: c.label }))} />
        <FilterSelect name="stock" value={stock ?? ""} label="Stock" all="Any stock" options={[{ value: "in", label: "In stock" }, { value: "low", label: "Low stock" }, { value: "out", label: "Out of stock" }]} />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState icon={<Boxes className="size-5" aria-hidden />} title="No products match">
          Try another name or SKU. Barcode lookup isn&apos;t available because products don&apos;t store barcodes yet.
        </EmptyState>
      ) : (
        <>
          <Table columns={["Product", "SKU", "Department", "Price", "Available", "In open orders", "Status"]} minWidth={860}>
            {rows.map((r) => {
              const tone = r.stock === 0 ? "bad" : r.stock <= r.lowStockThreshold ? "warn" : "good";
              return (
                <tr key={r.id}>
                  <td className={td}>
                    <span className="flex items-center gap-3">
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-line bg-[radial-gradient(80%_80%_at_50%_30%,var(--art-a),var(--art-b))]">
                        <ProductImage product={toProduct(r)} padding="p-1" />
                      </span>
                      <span className="min-w-0">
                        <span className="block max-w-[18rem] truncate font-medium text-fg">{r.name}</span>
                        <span className="block text-xs text-fg-dim">{r.brand ?? "No brand"}</span>
                      </span>
                    </span>
                  </td>
                  <td className={`${td} font-mono text-xs text-fg-muted`}>{r.sku}</td>
                  <td className={`${td} text-fg-muted`}>{getCategory(r.category as ProductCategoryId)?.label ?? r.category}</td>
                  <td className={`${td} tabular-nums ${r.pricePaise === null ? "text-amber-700" : "text-fg"}`}>{r.pricePaise === null ? "On enquiry" : formatPrice(r.pricePaise)}</td>
                  <td className={`${td} font-semibold tabular-nums text-fg`}>{r.stock}</td>
                  <td className={`${td} tabular-nums text-fg-muted`}>{reserved.get(r.id) ?? 0}</td>
                  <td className={td}>
                    <span className="flex gap-1.5">
                      <Badge tone={tone}>{tone === "bad" ? "Out of stock" : tone === "warn" ? "Low" : "In stock"}</Badge>
                      {!r.isActive && <Badge tone="muted">Hidden from store</Badge>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={n} params={{ q, category, stock }} path="/staff/products" />
        </>
      )}
    </>
  );
}
