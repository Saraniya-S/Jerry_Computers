import Link from "next/link";
import { getCategory, type Product } from "@/data/products";
import { PriceTag } from "../PriceTag";
import { ProductImage } from "../ProductImage";

/** Grid card for the catalogue: square image, then name, category and price. */
export function CatalogueCard({ product }: { product: Product }) {
  const soldOut = product.pricePaise !== null && product.stock <= 0;
  return (
    <Link href={`/products/${product.slug}`} className="group block rounded-2xl p-1.5 transition-colors hover:bg-ink-900/70">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-[radial-gradient(80%_80%_at_50%_30%,var(--art-a),var(--art-b))]">
        <ProductImage product={product} className="transition-transform duration-500 group-hover:scale-[1.04]" />
        {soldOut && <span className="absolute left-2 top-2 rounded-md bg-ink-850/90 px-2 py-0.5 text-[11px] font-medium text-fg-muted">Out of stock</span>}
      </div>
      <div className="px-1 pb-1 pt-3">
        <p className="truncate text-sm font-medium text-fg group-hover:text-brand">{product.name}</p>
        <p className="truncate text-[0.8rem] text-fg-dim">{product.brand ?? getCategory(product.category).label}</p>
        <div className="mt-1">
          <PriceTag product={product} />
        </div>
      </div>
    </Link>
  );
}
