"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { getCategory, type Product } from "@/data/products";

/** Sidebar search over the product catalogue, with results in a dropdown. */
export function ProductSearch({ products }: { products: Pick<Product, "slug" | "name" | "category">[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return products
      .filter((p) => `${p.name} ${getCategory(p.category).label}`.toLowerCase().includes(term))
      .slice(0, 6);
  }, [q, products]);

  const show = open && q.trim().length > 0;

  return (
    <div className="relative">
      <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-ink-850 px-3 text-sm focus-within:border-brand focus-within:ring-4 focus-within:ring-[var(--brand-glow)]">
        <Search className="size-4 shrink-0 text-fg-dim" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (!show || !results.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % results.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + results.length) % results.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              listRef.current?.querySelectorAll("a")[active]?.click();
            }
          }}
          placeholder="Search products"
          aria-label="Search products"
          role="combobox"
          aria-expanded={show}
          aria-controls={listId}
          aria-autocomplete="list"
          style={{ outline: "none" }}
          className="min-w-0 flex-1 bg-transparent text-fg placeholder:text-fg-dim"
        />
      </label>
      {show && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-line bg-ink-850 p-1 shadow-[0_16px_40px_-16px_var(--shadow)]"
        >
          {results.length ? (
            results.map((p, i) => (
              <li key={p.slug} role="option" aria-selected={i === active}>
                <Link
                  href={`/products/${p.slug}`}
                  onMouseEnter={() => setActive(i)}
                  className={`block rounded-lg px-2.5 py-2 text-sm ${i === active ? "bg-ink-900" : ""}`}
                >
                  <span className="block truncate text-fg">{p.name}</span>
                  <span className="block text-xs text-fg-dim">{getCategory(p.category).label}</span>
                </Link>
              </li>
            ))
          ) : (
            <li className="px-2.5 py-2 text-sm text-fg-dim">No products match “{q.trim()}”.</li>
          )}
        </ul>
      )}
    </div>
  );
}
