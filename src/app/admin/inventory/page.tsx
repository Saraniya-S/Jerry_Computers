import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { History, Warehouse } from "lucide-react";
import { Suspense } from "react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { StockAdjuster } from "@/components/admin/StockAdjuster";
import { Badge, FilterBar, FilterSelect, fullDateTimeFmt, oneOf, pageParam, Pagination, param, personName, SearchInput, Table, td } from "@/components/admin/ui";
import { orderNumber } from "@/lib/money";
import { listMovements, reservedByProduct } from "@/lib/server/admin/inventory";
import { db, schema } from "@/lib/server/db";
import type { InventoryReason } from "@/lib/server/db/schema";
import { requirePermission } from "@/lib/server/permissions";

export const metadata: Metadata = { title: "Inventory" };

const reasonLabel: Record<InventoryReason, string> = {
  opening_balance: "Opening balance",
  restock: "Restock",
  correction: "Correction",
  damaged: "Damaged / written off",
  customer_return: "Customer return",
  order_placed: "Order placed",
  order_cancelled: "Order cancelled",
};
const PAGE_SIZE = 25;

export default function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Inventory searchParams={searchParams} />
    </Suspense>
  );
}

async function Inventory({ searchParams }: Pick<PageProps<"/admin/inventory">, "searchParams">) {
  await requirePermission("inventory.adjust");
  const sp = await searchParams;
  const view = sp.view === "history" ? "history" : "levels";
  const productId = /^[0-9a-f-]{36}$/i.test(param(sp.product)) ? param(sp.product) : undefined;

  const tabs = (
    <nav aria-label="Inventory views" className="flex gap-1 border-b border-line px-3 sm:px-5">
      {(
        [
          ["levels", "Stock levels", `/admin/inventory${productId ? `?product=${productId}` : ""}`],
          ["history", "Movement history", `/admin/inventory?view=history${productId ? `&product=${productId}` : ""}`],
        ] as const
      ).map(([key, label, href]) => (
        <Link key={key} href={href} aria-current={view === key ? "page" : undefined} className={`relative px-3 py-3 text-sm ${view === key ? "font-medium text-fg" : "text-fg-muted hover:text-fg"}`}>
          {label}
          {view === key && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" />}
        </Link>
      ))}
    </nav>
  );

  return view === "history" ? <MovementHistory sp={sp} productId={productId} tabs={tabs} /> : <StockLevels sp={sp} productId={productId} tabs={tabs} />;
}

type SP = Awaited<PageProps<"/admin/inventory">["searchParams"]>;

async function StockLevels({ sp, productId, tabs }: { sp: SP; productId?: string; tabs: React.ReactNode }) {
  const q = param(sp.q);
  const stock = oneOf(sp.stock, ["low", "out"] as const);
  const page = pageParam(sp.page);
  const p = schema.products;
  const where: SQL[] = [isNull(p.archivedAt)];
  if (productId) where.push(eq(p.id, productId));
  if (q) where.push(or(ilike(p.name, `%${q}%`), ilike(p.sku, `%${q}%`), sql`exists (select 1 from ${schema.productVariants} v where v.product_id = ${p.id} and v.sku ilike ${`%${q}%`})`)!);
  if (stock === "low") where.push(sql`${p.stock} <= ${p.lowStockThreshold}`);
  if (stock === "out") where.push(eq(p.stock, 0));

  const [rows, [{ n }]] = await Promise.all([
    db
      .select({ id: p.id, name: p.name, sku: p.sku, stock: p.stock, threshold: p.lowStockThreshold, isActive: p.isActive })
      .from(p)
      .where(and(...where))
      .orderBy(asc(sql`${p.stock} > ${p.lowStockThreshold}`), asc(p.name))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(p).where(and(...where)),
  ]);
  const ids = rows.map((r) => r.id);
  const [reserved, variants] = await Promise.all([
    reservedByProduct(db, ids),
    ids.length ? db.select().from(schema.productVariants).where(inArray(schema.productVariants.productId, ids)).orderBy(asc(schema.productVariants.name)) : [],
  ]);

  return (
    <>
      <PageHeader title="Inventory" count={n} description="Available is what can still be sold. Reserved is in placed or packed orders and has already left the available count." />
      {tabs}
      <FilterBar resetHref="/admin/inventory">
        <SearchInput value={q} placeholder="Product or SKU" label="Search stock" />
        <FilterSelect name="stock" value={stock ?? ""} label="Stock" all="All stock levels" options={[{ value: "low", label: "Low stock" }, { value: "out", label: "Out of stock" }]} />
        {productId && <input type="hidden" name="product" value={productId} />}
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState icon={<Warehouse className="size-5" aria-hidden />} title="No products match">
          Try another search.
        </EmptyState>
      ) : (
        <>
          <Table columns={["Product", "Available", "Reserved", "On hand", "Low at", "Status", { label: "", className: "text-right" }]} minWidth={860}>
            {rows.flatMap((r) => {
              const res = reserved.get(r.id) ?? 0;
              const tone = r.stock === 0 ? "bad" : r.stock <= r.threshold ? "warn" : "good";
              return [
                <tr key={r.id}>
                  <td className={td}>
                    <Link href={`/admin/products/${r.id}`} className="font-medium text-fg hover:text-brand">
                      {r.name}
                    </Link>
                    <span className="block font-mono text-xs text-fg-dim">{r.sku}</span>
                  </td>
                  <td className={`${td} font-semibold tabular-nums text-fg`}>{r.stock}</td>
                  <td className={`${td} tabular-nums text-fg-muted`}>{res}</td>
                  <td className={`${td} tabular-nums text-fg-muted`}>{r.stock + res}</td>
                  <td className={`${td} tabular-nums text-fg-dim`}>{r.threshold}</td>
                  <td className={td}>
                    <Badge tone={tone}>{tone === "bad" ? "Out of stock" : tone === "warn" ? "Low" : "In stock"}</Badge>
                    {!r.isActive && <span className="ml-1.5 text-xs text-fg-dim">hidden</span>}
                  </td>
                  <td className={`${td} text-right`}>
                    <StockAdjuster productId={r.id} variantId={null} label={r.name} current={r.stock} />
                  </td>
                </tr>,
                ...variants
                  .filter((v) => v.productId === r.id)
                  .map((v) => (
                    <tr key={v.id} className="bg-ink-950/50">
                      <td className={`${td} pl-10 sm:pl-12`}>
                        <span className="text-fg">{v.name}</span>
                        <span className="block font-mono text-xs text-fg-dim">{v.sku}</span>
                      </td>
                      <td className={`${td} tabular-nums text-fg`}>{v.stock}</td>
                      <td className={`${td} text-fg-dim`}>—</td>
                      <td className={`${td} tabular-nums text-fg-muted`}>{v.stock}</td>
                      <td className={`${td} text-fg-dim`}>—</td>
                      <td className={td}>{!v.isActive && <Badge tone="muted">Off</Badge>}</td>
                      <td className={`${td} text-right`}>
                        <StockAdjuster productId={r.id} variantId={v.id} label={`${r.name} (${v.name})`} current={v.stock} />
                      </td>
                    </tr>
                  )),
              ];
            })}
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={n} params={{ q, stock, product: productId }} path="/admin/inventory" />
        </>
      )}
    </>
  );
}

async function MovementHistory({ sp, productId, tabs }: { sp: SP; productId?: string; tabs: React.ReactNode }) {
  const reason = oneOf(sp.reason, Object.keys(reasonLabel) as InventoryReason[]);
  const page = pageParam(sp.page);
  const { rows, total } = await listMovements({ productId, reason, page, pageSize: PAGE_SIZE });
  return (
    <>
      <PageHeader title="Inventory" count={total} description="Every stock change: who made it, why, and the count afterwards." />
      {tabs}
      <FilterBar resetHref={`/admin/inventory?view=history${productId ? `&product=${productId}` : ""}`}>
        <input type="hidden" name="view" value="history" />
        {productId && <input type="hidden" name="product" value={productId} />}
        <FilterSelect name="reason" value={reason ?? ""} label="Reason" all="All reasons" options={Object.entries(reasonLabel).map(([value, label]) => ({ value, label }))} />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState icon={<History className="size-5" aria-hidden />} title="No movements">
          Stock changes appear here as they happen.
        </EmptyState>
      ) : (
        <>
          <Table columns={["When", "Product", "Change", "After", "Reason", "By"]} minWidth={860}>
            {rows.map(({ m, productName, productSku, variantName, actorFirst, actorLast, actorRole, orderSeq }) => (
              <tr key={m.id}>
                <td className={`${td} text-fg-muted`}>{fullDateTimeFmt.format(m.createdAt)}</td>
                <td className={td}>
                  <Link href={`/admin/inventory?view=history&product=${m.productId}`} className="text-fg hover:text-brand">
                    {productName}
                    {variantName && ` (${variantName})`}
                  </Link>
                  <span className="block font-mono text-xs text-fg-dim">{productSku}</span>
                </td>
                <td className={`${td} font-medium tabular-nums ${m.delta > 0 ? "text-leaf" : m.delta < 0 ? "text-red-600" : "text-fg-muted"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                <td className={`${td} tabular-nums text-fg`}>{m.stockAfter}</td>
                <td className={`${td} whitespace-normal`}>
                  <span className="text-fg">{reasonLabel[m.reason]}</span>
                  {orderSeq && m.orderId && (
                    <Link href={`/admin/orders/${m.orderId}`} className="ml-1.5 text-xs text-brand hover:underline">
                      {orderNumber(orderSeq)}
                    </Link>
                  )}
                  {m.note && <span className="block max-w-xs text-xs text-fg-dim">{m.note}</span>}
                </td>
                <td className={`${td} text-fg-muted`}>
                  {personName(actorFirst, actorLast) || "—"}
                  {actorRole === "customer" && <span className="block text-xs text-fg-dim">customer</span>}
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} params={{ view: "history", product: productId, reason }} path="/admin/inventory" />
        </>
      )}
    </>
  );
}
