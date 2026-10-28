import type { Product } from "@/data/products";
import { ProductArt } from "./ProductArt";

/** The product's main photo, or its illustrated artwork when no photo has been uploaded. */
export function ProductImage({ product, index = 0, className = "", padding = "p-4" }: { product: Pick<Product, "images" | "category" | "variant" | "name">; index?: number; className?: string; padding?: string }) {
  const src = product.images[index];
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded images, already sized on upload
    <img src={src} alt={product.name} loading="lazy" decoding="async" className={`absolute inset-0 size-full object-contain ${padding} ${className}`} />
  ) : (
    <ProductArt category={product.category} variant={product.variant} className={`absolute inset-0 size-full ${padding} ${className}`} title={product.name} />
  );
}
