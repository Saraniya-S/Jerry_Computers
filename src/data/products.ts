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

export type Product = {
  slug: string;
  name: string;
  category: ProductCategoryId;
  summary: string;
  /** Price in the store currency. `null` means price on enquiry. */
  price: number | null;
  /** Optional photo path under /public. Falls back to category artwork. */
  image?: string;
  /** Artwork variant (0–2) used when no photo is supplied. */
  variant: 0 | 1 | 2;
  isDemo: true;
};

export const productCategories: ProductCategory[] = [
  { id: "laptops", label: "Laptops", blurb: "Everyday, business and performance notebooks." },
  { id: "desktops", label: "Desktops", blurb: "Ready-built towers and custom PC builds." },
  { id: "components", label: "Components", blurb: "Graphics, memory, storage and more." },
  { id: "cctv", label: "CCTV Systems", blurb: "Cameras, recorders and complete kits." },
  { id: "printers", label: "Printers", blurb: "Home, office and multifunction printing." },
  { id: "ups", label: "UPS Devices", blurb: "Backup power for desks and server rooms." },
  { id: "accessories", label: "Accessories", blurb: "Keyboards, mice, cables and peripherals." },
];

const demo = (
  slug: string,
  name: string,
  category: ProductCategoryId,
  summary: string,
  variant: 0 | 1 | 2,
): Product => ({ slug, name, category, summary, variant, price: null, isDemo: true });

export const products: Product[] = [
  demo("ultrabook-14", "Ultrabook 14", "laptops", "Thin, light notebook for work and study.", 0),
  demo("creator-16", "Creator 16", "laptops", "Large-screen laptop for creative workloads.", 1),
  demo("business-15", "Business 15", "laptops", "Durable notebook for the office.", 2),
  demo("tower-performance", "Performance Tower", "desktops", "Custom-configured gaming and creator build.", 0),
  demo("compact-office", "Compact Office PC", "desktops", "Small-form desktop for daily tasks.", 1),
  demo("workstation-pro", "Workstation Build", "desktops", "Multi-core build for heavy workloads.", 2),
  demo("graphics-card", "Graphics Card", "components", "Discrete GPU for gaming and rendering.", 0),
  demo("ddr5-memory", "DDR5 Memory Kit", "components", "Dual-channel desktop memory.", 1),
  demo("nvme-ssd", "NVMe SSD", "components", "Fast M.2 solid-state storage.", 2),
  demo("dome-camera", "Dome Camera", "cctv", "Indoor dome camera for shops and offices.", 0),
  demo("bullet-camera", "Bullet Camera", "cctv", "Weather-rated outdoor camera.", 1),
  demo("nvr-kit", "NVR Recorder Kit", "cctv", "Network recorder with camera set.", 2),
  demo("laser-printer", "Laser Printer", "printers", "Monochrome laser for high volume.", 0),
  demo("ink-tank", "Ink Tank Printer", "printers", "Low running-cost colour printing.", 1),
  demo("mfp-office", "Office Multifunction", "printers", "Print, scan and copy in one unit.", 2),
  demo("ups-desktop", "Desktop UPS", "ups", "Backup power for a single workstation.", 0),
  demo("ups-online", "Online UPS", "ups", "Continuous power for sensitive equipment.", 1),
  demo("ups-rack", "Rack-mount UPS", "ups", "Protection for network and server racks.", 2),
  demo("mech-keyboard", "Mechanical Keyboard", "accessories", "Tactile keyboard for long sessions.", 0),
  demo("wireless-mouse", "Wireless Mouse", "accessories", "Ergonomic, low-latency mouse.", 1),
  demo("usb-c-hub", "USB-C Hub", "accessories", "Expand ports for modern laptops.", 2),
];

export function getFeaturedProducts(): Product[] {
  return products;
}

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getCategory(id: ProductCategoryId): ProductCategory {
  return productCategories.find((c) => c.id === id)!;
}

export function formatPrice(price: number | null) {
  if (price === null) return "Price on enquiry";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(price);
}
