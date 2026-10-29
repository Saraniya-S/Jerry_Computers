import type { ProductCategoryId } from "@/data/products";

/** A cart line as the browser sees it: quantity plus what the drawer and checkout show. */
export type CartItem = {
  slug: string;
  quantity: number;
  name: string;
  category: ProductCategoryId;
  categoryLabel: string;
  variant: 0 | 1 | 2;
  image: string | null;
  /** GST-inclusive unit price in paise. */
  pricePaise: number;
  stock: number;
  codAvailable: boolean;
};

export const MAX_QUANTITY = 10;

export const cartCount = (items: CartItem[]) => items.reduce((n, l) => n + l.quantity, 0);
export const cartTotal = (items: CartItem[]) => items.reduce((n, l) => n + l.pricePaise * l.quantity, 0);
