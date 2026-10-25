import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatPrice, getCategory, type Product } from "@/data/products";
import { ProductArt } from "./ProductArt";

type ProductCardProps = {
  product: Product;
  /** When false the card is decorative (e.g. off-axis in the helix) and not focusable. */
  interactive?: boolean;
  className?: string;
};

export function ProductCard({ product, interactive = true, className = "" }: ProductCardProps) {
  const category = getCategory(product.category);
  const body = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[radial-gradient(80%_80%_at_50%_30%,var(--art-a),var(--art-b))]">
        {product.image ? (
          <Image src={product.image} alt={product.name} fill sizes="220px" className="object-contain p-3" />
        ) : (
          <ProductArt category={product.category} variant={product.variant} className="absolute inset-0 size-full p-2" />
        )}
      </div>
      <div className="flex flex-1 flex-col px-1.5 pb-1 pt-3">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-fg-dim">{category.label}</p>
        <p className="mt-1 text-[0.95rem] font-medium leading-snug tracking-tight text-fg">{product.name}</p>
        <div className="mt-auto flex items-center justify-between pt-2.5">
          <span className="text-[0.78rem] text-fg-muted">{formatPrice(product.price)}</span>
          <ArrowUpRight className="size-4 text-fg-muted transition-colors group-hover:text-copper" aria-hidden />
        </div>
      </div>
    </>
  );
  const cls = `group flex h-full flex-col rounded-2xl border border-[var(--card-edge)] bg-[linear-gradient(180deg,var(--card-top),var(--card-bottom))] p-2.5 shadow-[0_20px_50px_-20px_var(--shadow),inset_0_1px_0_var(--highlight)] transition-colors hover:border-copper/50 ${className}`;

  if (!interactive) {
    return (
      <div className={cls} aria-hidden>
        {body}
      </div>
    );
  }
  return (
    <Link href={`/products/${product.slug}`} className={cls} aria-label={`${product.name} — view product`}>
      {body}
    </Link>
  );
}
