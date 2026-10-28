"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getCategory, productCategories, productUses, type Product, type ProductCategoryId, type ProductUse } from "@/data/products";
import { CatalogueCard } from "./CatalogueCard";
import { activeCount, applyFilters, facetCounts, parseFilters, sortOptions, toSearch, type Filters, type SortId } from "./filters";

/**
 * Product catalogue after ReactBits Pro "Filtering 1": a title row with the result count and
 * sort, filter groups in a left sidebar (a sheet on small screens), and an animated grid.
 * Filters live in the URL so they can be linked to and survive reloads.
 */
export function Catalogue({ products }: { products: Product[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const reduce = useReducedMotion();
  const fromUrl = useMemo(() => parseFilters(new URLSearchParams(params.toString())), [params]);

  // The search box filters as you type; the URL catches up after a pause.
  const [query, setQuery] = useState(fromUrl.q);
  // The q this page last wrote, so its own URL updates don't overwrite newer typing.
  const [lastWritten, setLastWritten] = useState(fromUrl.q);
  const [prevUrlQ, setPrevUrlQ] = useState(fromUrl.q);
  if (fromUrl.q !== prevUrlQ) {
    setPrevUrlQ(fromUrl.q);
    if (fromUrl.q !== lastWritten) setQuery(fromUrl.q);
  }
  const filters: Filters = { ...fromUrl, q: query };

  const [sheetOpen, setSheetOpen] = useState(false);

  const write = (next: Filters) => {
    setLastWritten(next.q);
    router.replace(`${pathname}${toSearch(next)}`, { scroll: false });
  };

  useEffect(() => {
    if (query === fromUrl.q) return;
    const id = setTimeout(() => write({ ...fromUrl, q: query }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed query should schedule a write
  }, [query]);

  // Old links used /products#cctv; turn the hash into a category filter.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    // Next syncs useSearchParams with native history updates, and this avoids racing its initial URL handling.
    if (productCategories.some((c) => c.id === hash)) window.history.replaceState(null, "", `${pathname}?category=${hash}`);
  }, [pathname]);

  const results = applyFilters(products, filters);
  const counts = facetCounts(products, filters);
  const active = activeCount(filters);

  const toggleCategory = (id: ProductCategoryId) =>
    write({ ...filters, categories: filters.categories.includes(id) ? filters.categories.filter((c) => c !== id) : [...filters.categories, id] });
  const toggleUse = (id: ProductUse) => write({ ...filters, uses: filters.uses.includes(id) ? filters.uses.filter((u) => u !== id) : [...filters.uses, id] });
  const clearAll = () => {
    setQuery("");
    write({ q: "", categories: [], uses: [], sort: filters.sort });
  };

  const title = filters.categories.length === 1 ? getCategory(filters.categories[0]).label : "All products";

  const panel = (
    <FilterPanel
      filters={filters}
      counts={counts}
      query={query}
      onQuery={setQuery}
      onCategory={toggleCategory}
      onUse={toggleUse}
      onClear={active ? clearAll : undefined}
    />
  );

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-[-0.03em] text-fg sm:text-4xl">{title}</h1>
          <p className="mt-1.5 text-sm text-fg-muted" aria-live="polite">
            <Count value={results.length} /> of {products.length} products
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-ink-850 px-3.5 text-sm text-fg hover:bg-ink-900 lg:hidden"
            aria-expanded={sheetOpen}
          >
            <SlidersHorizontal className="size-4" aria-hidden /> Filters
            {active > 0 && <span className="grid size-5 place-items-center rounded-full bg-brand text-[11px] font-semibold text-white">{active}</span>}
          </button>
          <label className="relative">
            <span className="sr-only">Sort products</span>
            <select
              value={filters.sort}
              onChange={(e) => write({ ...filters, sort: e.target.value as SortId })}
              style={{ outline: "none" }}
              className="h-10 w-44 appearance-none rounded-xl border border-line-strong bg-ink-850 pl-3.5 pr-9 text-sm text-fg transition-[border-color,box-shadow] focus:border-brand focus:ring-4 focus:ring-[var(--brand-glow)] sm:w-48"
            >
              {sortOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-dim" aria-hidden />
          </label>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[256px_1fr] lg:gap-10">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-28">{panel}</div>
        </aside>

        <section aria-label="Products">
          {active > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {filters.q.trim() && <Chip label={`“${filters.q.trim()}”`} onRemove={() => setQuery("")} />}
              {filters.categories.map((c) => (
                <Chip key={c} label={getCategory(c).label} onRemove={() => toggleCategory(c)} />
              ))}
              {filters.uses.map((u) => (
                <Chip key={u} label={productUses.find((x) => x.id === u)!.label} onRemove={() => toggleUse(u)} />
              ))}
              <button type="button" onClick={clearAll} className="px-1.5 text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">
                Clear all
              </button>
            </div>
          )}

          {results.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-20 text-center">
              <div className="grid size-12 place-items-center rounded-2xl border border-line bg-ink-850 text-fg-muted">
                <SearchX className="size-5" aria-hidden />
              </div>
              <p className="mt-4 font-medium text-fg">No products match these filters</p>
              <p className="mt-1 max-w-sm text-sm text-fg-muted">Try removing a filter or searching for something broader.</p>
              <button type="button" onClick={clearAll} className="mt-5 inline-flex h-10 items-center rounded-full bg-brand px-5 text-sm font-medium text-white hover:bg-[var(--brand-hover)]">
                Clear filters
              </button>
            </div>
          ) : (
            <motion.ul layout={!reduce} className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 xl:grid-cols-4">
              <AnimatePresence mode="popLayout" initial={false}>
                {results.map((p) => (
                  <motion.li
                    key={p.slug}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <CatalogueCard product={p} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
          )}

          <p className="mt-12 rounded-xl border border-line bg-ink-900 px-4 py-3 text-xs leading-relaxed text-fg-muted">
            Prices include GST. For products without a price, contact the shop and we&apos;ll quote.
          </p>
        </section>
      </div>

      <FilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} resultCount={results.length}>
        {panel}
      </FilterSheet>
    </div>
  );
}

type PanelProps = {
  filters: Filters;
  counts: ReturnType<typeof facetCounts>;
  query: string;
  onQuery: (q: string) => void;
  onCategory: (id: ProductCategoryId) => void;
  onUse: (id: ProductUse) => void;
  onClear?: () => void;
};

function FilterPanel({ filters, counts, query, onQuery, onCategory, onUse, onClear }: PanelProps) {
  return (
    <div className="grid gap-8">
      <label className="flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-ink-850 px-3 text-sm transition-[border-color,box-shadow] focus-within:border-brand focus-within:ring-4 focus-within:ring-[var(--brand-glow)]">
        <Search className="size-4 shrink-0 text-fg-dim" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search products"
          aria-label="Search products"
          style={{ outline: "none" }}
          className="min-w-0 flex-1 bg-transparent text-fg placeholder:text-fg-dim"
        />
      </label>

      <FilterGroup title="Category">
        <ul className="-mx-2 grid gap-0.5">
          {productCategories.map((c) => {
            const on = filters.categories.includes(c.id);
            const n = counts.byCategory.get(c.id) ?? 0;
            return (
              <li key={c.id}>
                <label className={`flex h-8 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm transition-colors hover:bg-ink-900 ${!n && !on ? "opacity-45" : ""}`}>
                  <input type="checkbox" checked={on} onChange={() => onCategory(c.id)} disabled={!n && !on} className="peer sr-only" />
                  <span
                    className={`grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 ${
                      on ? "border-brand bg-brand text-white" : "border-line-strong bg-ink-850"
                    }`}
                    aria-hidden
                  >
                    {on && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className={`flex-1 truncate ${on ? "text-fg" : "text-fg-muted"}`}>{c.label}</span>
                  <span className="font-mono text-xs tabular-nums text-fg-dim">{n}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </FilterGroup>

      <FilterGroup title="Good for">
        <div className="flex flex-wrap gap-2">
          {productUses.map((u) => {
            const on = filters.uses.includes(u.id);
            const n = counts.byUse.get(u.id) ?? 0;
            return (
              <button
                key={u.id}
                type="button"
                aria-pressed={on}
                disabled={!n && !on}
                onClick={() => onUse(u.id)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors disabled:opacity-45 ${
                  on ? "border-brand bg-brand text-white" : "border-line-strong bg-ink-850 text-fg-muted hover:border-fg/30 hover:text-fg"
                }`}
              >
                {u.label}
                <span className={`font-mono text-[11px] tabular-nums ${on ? "text-white/75" : "text-fg-dim"}`}>{n}</span>
              </button>
            );
          })}
        </div>
      </FilterGroup>

      {onClear && (
        <button type="button" onClick={onClear} className="justify-self-start text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">
          Clear all filters
        </button>
      )}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-medium text-fg">{title}</h2>
      {children}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-full border border-line-strong bg-ink-850 pl-3 pr-1 text-sm text-fg">
      {label}
      <button type="button" onClick={onRemove} className="grid size-6 place-items-center rounded-full text-fg-dim hover:bg-ink-900 hover:text-fg" aria-label={`Remove ${label}`}>
        <X className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}

/** Result count that rolls to its new value. */
function Count({ value }: { value: number }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative inline-flex overflow-hidden align-bottom tabular-nums">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={reduce ? false : { y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: "-100%", opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="font-medium text-fg"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function FilterSheet({ open, onClose, resultCount, children }: { open: boolean; onClose: () => void; resultCount: number; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="fixed inset-0 z-[60] bg-[rgb(28_25_56/0.35)] backdrop-blur-[2px] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            className="fixed inset-y-0 left-0 z-[61] flex w-[min(340px,90vw)] flex-col bg-ink-950 shadow-2xl lg:hidden"
            initial={reduce ? { opacity: 0 } : { x: "-100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "-100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-base font-semibold text-fg">Filters</h2>
              <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-fg-muted hover:bg-ink-900 hover:text-fg" aria-label="Close filters">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
            <div className="border-t border-line p-4">
              <button type="button" onClick={onClose} className="h-11 w-full rounded-full bg-brand text-sm font-medium text-white hover:bg-[var(--brand-hover)]">
                Show {resultCount} {resultCount === 1 ? "product" : "products"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
