import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { Boxes, Plus } from "lucide-react";
import { Suspense } from "react";
import { primaryButton } from "@/components/account/buttons";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { Badge, FilterBar, FilterSelect, oneOf, pageParam, Pagination, param, SearchInput, Table, td } from "@/components/admin/ui";
import { ProductImage } from "@/components/products/ProductImage";
import { formatPrice, getCategory, productCategories, type ProductCategoryId } from "@/data/products";
import { toProduct } from "@/lib/server/catalogue";
import { db, schema } from "@/lib/server/db";
import { requirePermission } from "@/lib/server/permissions";

export const metadata: Metadata = { title: "Products" };

const statuses = ["live", "hidden", "archived"] as const;
const stockFilters = ["low", "out"] as const;
const sorts = { name: "Name A–Z", newest: "Newest first", price_desc: "Price, high to low", price_asc: "Price, low to high", stock_asc: "Stock, lowest first" } as const;
const PAGE_SIZE = 25;

export default function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Products searchParams={searchParams} />
    </Suspense>
  );
}

async function Products({ searchParams }: Pick<PageProps<"/admin/products">, "searchParams">) {
  await requirePermission("catalogue.manage");
  const sp = await searchParams;
  const q = param(sp.q);
  const category = productCategories.some((c) => c.id === sp.category) ? (sp.category as ProductCategoryId) : undefined;
  const brandId = /^[0-9a-f-]{36}$/i.test(param(sp.brand)) ? param(sp.brand) : "";
  const status = oneOf(sp.status, statuses);
  const stock = oneOf(sp.stock, stockFilters);
  const sort = oneOf(sp.sort, Object.keys(sorts) as (keyof typeof sorts)[]) ?? "name";
  const page = pageParam(sp.page);

  const p = schema.products;
  const where: SQL[] = [status === "archived" ? isNotNull(p.archivedAt) : isNull(p.archivedAt)];
  if (q) where.push(or(ilike(p.name, `%${q}%`), ilike(p.sku, `%${q}%`), ilike(p.slug, `%${q}%`), ilike(p.brand, `%${q}%`))!);
  if (category) where.push(eq(p.category, category));
  if (brandId) where.push(eq(p.brandId, brandId));
  if (status === "live") where.push(eq(p.isActive, true));
  if (status === "hidden") where.push(eq(p.isActive, false));
  if (stock === "low") where.push(sql`${p.stock} <= ${p.lowStockThreshold}`);
  if (stock === "out") where.push(eq(p.stock, 0));
  const order = {
    name: [asc(p.name)],
    newest: [desc(p.createdAt)],
    price_desc: [sql`${p.pricePaise} desc nulls last`, asc(p.name)],
    price_asc: [sql`${p.pricePaise} asc nulls last`, asc(p.name)],
    stock_asc: [asc(p.stock), asc(p.name)],
  }[sort];

  const [rows, [{ n }], brands, [{ unpriced }]] = await Promise.all([
    db
      .select({ row: p, variants: sql<number>`(select count(*)::int from ${schema.productVariants} v where v.product_id = ${p.id})`, subcategory: schema.categories.name })
      .from(p)
      .leftJoin(schema.categories, eq(schema.categories.id, p.subcategoryId))
      .where(and(...where))
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(p).where(and(...where)),
    db.select({ id: schema.brands.id, name: schema.brands.name }).from(schema.brands).orderBy(asc(schema.brands.name)),
    db
      .select({ unpriced: count() })
      .from(p)
      .where(and(isNull(p.pricePaise), isNull(p.archivedAt))),
  ]);

  const params = { q, category, brand: brandId, status, stock, sort: sort === "name" ? undefined : sort };
  return (
    <>
      <PageHeader
        title="Products"
        count={n}
        description="Prices, SKUs, variants, photos and what shows in the store. Stock changes go through Inventory."
        actions={
          <Link href="/admin/products/new" className={primaryButton}>
            <Plus className="size-4" aria-hidden /> Add product
          </Link>
        }
      />
      <FilterBar resetHref="/admin/products">
        <SearchInput value={q} placeholder="Name, SKU or brand" label="Search products" />
        <FilterSelect name="category" value={category ?? ""} label="Department" all="All departments" options={productCategories.map((c) => ({ value: c.id, label: c.label }))} />
        <FilterSelect name="brand" value={brandId} label="Brand" all="All brands" options={brands.map((b) => ({ value: b.id, label: b.name }))} />
        <FilterSelect name="status" value={status ?? ""} label="Status" all="Live and hidden" options={[{ value: "live", label: "Live" }, { value: "hidden", label: "Hidden" }, { value: "archived", label: "Archived" }]} />
        <FilterSelect name="stock" value={stock ?? ""} label="Stock" all="Any stock" options={[{ value: "low", label: "Low stock" }, { value: "out", label: "Out of stock" }]} />
        <FilterSelect name="sort" value={sort === "name" ? "" : sort} label="Sort" all={sorts.name} options={Object.entries(sorts).filter(([k]) => k !== "name").map(([value, label]) => ({ value, label }))} />
      </FilterBar>
      {unpriced > 0 && status !== "archived" && (
        <p className="mx-5 mt-4 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:mx-7">
          {unpriced} {unpriced === 1 ? "product has" : "products have"} no price yet, so customers see “Price on enquiry” and can&apos;t add {unpriced === 1 ? "it" : "them"} to the cart.
        </p>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={<Boxes className="size-5" aria-hidden />} title="No products match">
          Try another search or filter, or add a product.
        </EmptyState>
      ) : (
        <>
          <Table columns={["Product", "SKU", "Department", "Price", "Stock", "Status"]} minWidth={860}>
            {rows.map(({ row, variants, subcategory }) => {
              const prod = toProduct(row);
              return (
                <tr key={row.id} className="group relative hover:bg-ink-950">
                  <td className={td}>
                    <Link href={`/admin/products/${row.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-line bg-[radial-gradient(80%_80%_at_50%_30%,var(--art-a),var(--art-b))]">
                        <ProductImage product={prod} padding="p-1" />
                      </span>
                      <span className="min-w-0">
                        <span className="block max-w-[18rem] truncate font-medium text-fg group-hover:text-brand">{row.name}</span>
                        <span className="block text-xs text-fg-dim">
                          {row.brand ?? "No brand"}
                          {variants > 0 && ` · ${variants} variant${variants === 1 ? "" : "s"}`}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className={`${td} font-mono text-xs text-fg-muted`}>{row.sku}</td>
                  <td className={`${td} text-fg-muted`}>
                    {getCategory(row.category as ProductCategoryId)?.label ?? row.category}
                    {subcategory && <span className="block text-xs text-fg-dim">{subcategory}</span>}
                  </td>
                  <td className={`${td} tabular-nums ${row.pricePaise === null ? "text-amber-700" : "text-fg"}`}>{row.pricePaise === null ? "Not set" : formatPrice(row.pricePaise)}</td>
                  <td className={`${td} tabular-nums ${row.stock === 0 ? "text-red-600" : row.stock <= row.lowStockThreshold ? "text-amber-700" : "text-fg"}`}>{row.stock}</td>
                  <td className={td}>
                    <span className="flex gap-1.5">
                      {row.archivedAt ? <Badge tone="muted">Archived</Badge> : row.isActive ? <Badge tone="good">Live</Badge> : <Badge tone="muted">Hidden</Badge>}
                      {row.isFeatured && <Badge tone="brand">Featured</Badge>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={n} params={params} path="/admin/products" />
        </>
      )}
    </>
  );
}
