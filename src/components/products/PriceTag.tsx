import { discountPercent, formatPrice, type Product } from "@/data/products";

/** Price with MRP struck through and the saving, or "Price on enquiry". */
export function PriceTag({ product, size = "sm" }: { product: Pick<Product, "pricePaise" | "mrpPaise">; size?: "sm" | "lg" }) {
  const off = discountPercent(product);
  if (product.pricePaise === null) return <span className={size === "lg" ? "text-xl text-fg-muted" : "text-[0.8rem] text-fg-muted"}>Price on enquiry</span>;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span className={`font-semibold tabular-nums text-fg ${size === "lg" ? "text-3xl tracking-[-0.02em]" : "text-sm"}`}>{formatPrice(product.pricePaise)}</span>
      {off !== null && (
        <>
          <s className={`tabular-nums text-fg-dim ${size === "lg" ? "text-base" : "text-xs"}`}>{formatPrice(product.mrpPaise)}</s>
          <span className={`font-medium text-leaf-mid ${size === "lg" ? "text-sm" : "text-xs"}`}>{off}% off</span>
        </>
      )}
    </span>
  );
}
