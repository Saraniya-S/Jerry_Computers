/**
 * DEMONSTRATION CATALOGUE.
 *
 * There is no product database yet, so these entries are placeholders that
 * exist only to shape the UI. They are not real inventory: names are
 * generic, `price` is null (shown as "Price on enquiry"), and imagery is
 * original illustration. Replace `getFeaturedProducts` with a database
 * query when the catalogue is connected — components only rely on the
 * `Product` type.
 */

export type ProductCategoryId =
  | "laptops"
  | "desktops"
  | "components"
  | "cctv"
  | "printers"
  | "ups"
  | "accessories";

export type ProductCategory = {
  id: ProductCategoryId;
  label: string;
  blurb: string;
};

/** What a product is typically bought for; used by the catalogue's "Good for" filter. */
export type ProductUse = "home" | "office" | "creative" | "security";

export const productUses: { id: ProductUse; label: string }[] = [
  { id: "home", label: "Home & study" },
  { id: "office", label: "Office & business" },
  { id: "creative", label: "Gaming & creative" },
  { id: "security", label: "Security" },
];

/** A product as shown in the store. Stored in the database and edited in the admin area. */
export type Product = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  category: ProductCategoryId;
  summary: string;
  description: string;
  uses: ProductUse[];
  specs: { label: string; value: string }[];
  /** Uploaded image URLs; the first is the main image. */
  images: string[];
  /** Artwork variant (0–2) used when there is no image. */
  variant: 0 | 1 | 2;
  /** Price including GST, in paise. Null means it can't be bought online yet. */
  pricePaise: number | null;
  mrpPaise: number | null;
  gstRateBp: number;
  stock: number;
  isFeatured: boolean;
};

/** Can be added to the cart: priced and in stock. */
export const canBuy = (p: Pick<Product, "pricePaise" | "stock">) => p.pricePaise !== null && p.stock > 0;

export const productCategories: ProductCategory[] = [
  { id: "laptops", label: "Laptops", blurb: "Everyday, business and performance notebooks." },
  { id: "desktops", label: "Desktops", blurb: "Ready-built towers and custom PC builds." },
  { id: "components", label: "Components", blurb: "Graphics, memory, storage and more." },
  { id: "cctv", label: "CCTV Systems", blurb: "Cameras, recorders and complete kits." },
  { id: "printers", label: "Printers", blurb: "Home, office and multifunction printing." },
  { id: "ups", label: "UPS Devices", blurb: "Backup power for desks and server rooms." },
  { id: "accessories", label: "Accessories", blurb: "Keyboards, mice, cables and peripherals." },
];

export function getCategory(id: ProductCategoryId): ProductCategory {
  return productCategories.find((c) => c.id === id)!;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** Shop price in whole rupees, e.g. ₹54,990. */
export function formatPrice(pricePaise: number | null) {
  if (pricePaise === null) return "Price on enquiry";
  return inr.format(Math.round(pricePaise / 100));
}

/** Whole-percent discount from MRP, or null. */
export function discountPercent(p: Pick<Product, "pricePaise" | "mrpPaise">) {
  if (p.pricePaise === null || !p.mrpPaise || p.mrpPaise <= p.pricePaise) return null;
  return Math.round((1 - p.pricePaise / p.mrpPaise) * 100);
}
