"use client";

import { useRef, useState } from "react";
import type { Product, ProductCategoryId } from "@/data/products";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductCategoryNavigation } from "@/components/products/ProductCategoryNavigation";

/**
 * Simplified helix for touch screens and reduced motion: a swipeable row
 * where cards alternate between two intertwining strands.
 */
export function HelixMobile({ products }: { products: Product[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState<ProductCategoryId>(products[0].category);

  const jump = (id: ProductCategoryId) => {
    setActive(id);
    const index = products.findIndex((p) => p.category === id);
    const el = trackRef.current?.children[index] as HTMLElement | undefined;
    if (!el || !trackRef.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    trackRef.current.scrollTo({ left: el.offsetLeft - 20, behavior: reduce ? "auto" : "smooth" });
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + 40;
    let best = 0;
    Array.from(track.children).forEach((c, i) => {
      if ((c as HTMLElement).offsetLeft <= center) best = i;
    });
    const cat = products[best].category;
    if (cat !== active) setActive(cat);
  };

  const width = products.length * 196 + 40;

  return (
    <div className="pt-10">
      <ProductCategoryNavigation active={active} onSelect={jump} className="px-5 sm:px-8" />
      <div className="relative mt-8">
        <ul
          ref={trackRef}
          onScroll={onScroll}
          className="relative flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-16 pt-10 [scrollbar-width:none] sm:px-8"
        >
          {/* Two strands drawn behind the cards */}
          <li aria-hidden className="pointer-events-none absolute left-0 top-1/2 -z-0 h-40 -translate-y-1/2" style={{ width }}>
            <svg width={width} height="160" viewBox={`0 0 ${width} 160`} fill="none">
              {[0, 1].map((s) => (
                <path
                  key={s}
                  d={Array.from({ length: Math.ceil(width / 8) + 1 }, (_, k) => {
                    const x = k * 8;
                    const y = 80 + Math.sin((x / 392) * Math.PI * 2 + s * Math.PI) * 56;
                    return `${k === 0 ? "M" : "L"}${x} ${y.toFixed(1)}`;
                  }).join(" ")}
                  stroke={s ? "var(--line-strong)" : "var(--brand)"}
                  strokeWidth="1.5"
                />
              ))}
            </svg>
          </li>
          {products.map((product, i) => (
            <li key={product.slug} className={`relative w-[180px] shrink-0 snap-start ${i % 2 ? "translate-y-8" : "-translate-y-8"}`}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
