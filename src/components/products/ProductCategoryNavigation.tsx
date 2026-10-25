"use client";

import { productCategories, type ProductCategoryId } from "@/data/products";

type Props = {
  active: ProductCategoryId;
  onSelect: (id: ProductCategoryId) => void;
  className?: string;
};

export function ProductCategoryNavigation({ active, onSelect, className = "" }: Props) {
  return (
    <div role="group" aria-label="Jump to category" className={`flex gap-1.5 overflow-x-auto [scrollbar-width:none] ${className}`}>
      {productCategories.map((c) => {
        const isActive = c.id === active;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(c.id)}
            className={`h-9 shrink-0 rounded-full border px-3.5 text-[0.8rem] transition-colors ${
              isActive ? "border-copper/60 bg-copper/10 text-fg" : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
