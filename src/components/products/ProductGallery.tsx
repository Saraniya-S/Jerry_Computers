"use client";

import { useState } from "react";
import type { Product } from "@/data/products";
import { ProductImage } from "./ProductImage";

/** Main image with a thumbnail strip when there's more than one photo. */
export function ProductGallery({ product }: { product: Pick<Product, "images" | "category" | "variant" | "name"> }) {
  const [index, setIndex] = useState(0);
  const many = product.images.length > 1;
  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-[radial-gradient(80%_80%_at_50%_30%,var(--art-a),var(--art-b))]">
        <ProductImage product={product} index={index} padding="p-8" />
      </div>
      {many && (
        <div className="mt-3 flex gap-2 overflow-x-auto" role="tablist" aria-label="Product photos">
          {product.images.map((src, i) => (
            <button
              key={src}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Photo ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`relative size-20 shrink-0 overflow-hidden rounded-xl border bg-ink-850 transition-[border-color,box-shadow] ${
                i === index ? "border-brand ring-4 ring-[var(--brand-glow)]" : "border-line hover:border-fg/30"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- uploaded product images */}
              <img src={src} alt="" className="size-full object-contain p-1.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
