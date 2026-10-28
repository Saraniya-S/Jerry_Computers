import { getCategory, productCategories, productUses, type Product, type ProductCategoryId, type ProductUse } from "@/data/products";

export const sortOptions = [
  { id: "featured", label: "Featured" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "name-asc", label: "Name: A to Z" },
  { id: "name-desc", label: "Name: Z to A" },
  { id: "category", label: "Category" },
] as const;
export type SortId = (typeof sortOptions)[number]["id"];

export type Filters = { q: string; categories: ProductCategoryId[]; uses: ProductUse[]; sort: SortId };

const categoryIds = new Set<string>(productCategories.map((c) => c.id));
const useIds = new Set<string>(productUses.map((u) => u.id));

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

/** Reads filters from the URL, ignoring anything unknown. */
export function parseFilters(params: URLSearchParams): Filters {
  const sort = params.get("sort");
  return {
    q: (params.get("q") ?? "").slice(0, 80),
    categories: list(params.get("category")).filter((c): c is ProductCategoryId => categoryIds.has(c)),
    uses: list(params.get("use")).filter((u): u is ProductUse => useIds.has(u)),
    sort: sortOptions.some((o) => o.id === sort) ? (sort as SortId) : "featured",
  };
}

export function toSearch(f: Filters) {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.categories.length) p.set("category", f.categories.join(","));
  if (f.uses.length) p.set("use", f.uses.join(","));
  if (f.sort !== "featured") p.set("sort", f.sort);
  const s = p.toString();
  return s ? `?${s.replaceAll("%2C", ",")}` : "";
}

const matchesQuery = (p: Product, q: string) =>
  !q || `${p.name} ${p.summary} ${getCategory(p.category).label}`.toLowerCase().includes(q.toLowerCase().trim());

/** Applies filters except the one named in `skip`, so each group's counts reflect the others. */
function filterBy(products: Product[], f: Filters, skip?: "categories" | "uses") {
  return products.filter(
    (p) =>
      matchesQuery(p, f.q) &&
      (skip === "categories" || !f.categories.length || f.categories.includes(p.category)) &&
      (skip === "uses" || !f.uses.length || p.uses.some((u) => f.uses.includes(u))),
  );
}

const categoryOrder = new Map(productCategories.map((c, i) => [c.id, i]));

// Unpriced products sort last whichever way prices are sorted.
const priceOf = (p: Product, dir: 1 | -1) => (p.pricePaise === null ? Infinity : p.pricePaise * dir);

export function applyFilters(products: Product[], f: Filters) {
  const out = filterBy(products, f);
  if (f.sort === "price-asc") out.sort((a, b) => priceOf(a, 1) - priceOf(b, 1));
  if (f.sort === "price-desc") out.sort((a, b) => priceOf(a, -1) - priceOf(b, -1));
  if (f.sort === "name-asc") out.sort((a, b) => a.name.localeCompare(b.name));
  if (f.sort === "name-desc") out.sort((a, b) => b.name.localeCompare(a.name));
  if (f.sort === "category") out.sort((a, b) => categoryOrder.get(a.category)! - categoryOrder.get(b.category)! || a.name.localeCompare(b.name));
  return out;
}

/** How many results each option would give, given the other active filters. */
export function facetCounts(products: Product[], f: Filters) {
  const byCategory = new Map<ProductCategoryId, number>();
  for (const p of filterBy(products, f, "categories")) byCategory.set(p.category, (byCategory.get(p.category) ?? 0) + 1);
  const byUse = new Map<ProductUse, number>();
  for (const p of filterBy(products, f, "uses")) for (const u of p.uses) byUse.set(u, (byUse.get(u) ?? 0) + 1);
  return { byCategory, byUse };
}

export const activeCount = (f: Filters) => f.categories.length + f.uses.length + (f.q.trim() ? 1 : 0);
