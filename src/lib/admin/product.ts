import { z } from "zod";
import { productCategories, productUses, type ProductCategoryId, type ProductUse } from "@/data/products";
import { parseRupees } from "@/lib/money";

export const gstRates = [
  { bp: 0, label: "0%" },
  { bp: 500, label: "5%" },
  { bp: 1200, label: "12%" },
  { bp: 1800, label: "18%" },
  { bp: 2800, label: "28%" },
];

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const rupees = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      const p = parseRupees(v);
      if (p === null || p <= 0) {
        ctx.addIssue({ code: "custom", message: `Enter ${label} in rupees, e.g. 54990.` });
        return z.NEVER;
      }
      return p;
    });

const skuRule = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9._-]{1,39}$/, "Use 2–40 letters, numbers, dots, dashes or underscores.");

/** The admin product form, as submitted (prices typed in rupees). */
export const productInput = z
  .object({
    name: z.string().trim().min(2, "Enter the product name.").max(120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes.")
      .max(80),
    sku: skuRule,
    brandId: z.union([z.string().uuid(), z.literal("")]).transform((v) => v || null),
    subcategoryId: z.union([z.string().uuid(), z.literal("")]).transform((v) => v || null),
    category: z.enum(productCategories.map((c) => c.id) as [ProductCategoryId, ...ProductCategoryId[]], { error: "Choose a category." }),
    summary: z.string().trim().min(5, "Add a one-line summary.").max(200),
    description: z.string().trim().max(5000),
    uses: z.array(z.enum(productUses.map((u) => u.id) as [ProductUse, ...ProductUse[]])).max(4),
    specs: z
      .array(z.object({ label: z.string().trim().max(60), value: z.string().trim().max(200) }))
      .max(30)
      .transform((rows) => rows.filter((r) => r.label && r.value)),
    images: z.array(z.string().regex(/^\/uploads\/[a-z0-9-]+\.(jpg|png|webp|gif)$/)).max(8),
    price: rupees("the price"),
    mrp: rupees("the MRP"),
    gstRateBp: z.number().refine((v) => gstRates.some((r) => r.bp === v), "Choose a GST rate."),
    /** Only used when creating a product; after that stock changes through Inventory adjustments. */
    stock: z.number().int("Stock is a whole number.").min(0, "Stock can't be negative.").max(100_000),
    lowStockThreshold: z.number().int("Use a whole number.").min(0, "Can't be negative.").max(10_000),
    isActive: z.boolean(),
    isFeatured: z.boolean(),
    codAvailable: z.boolean(),
    artVariant: z.number().int().min(0).max(2),
  })
  .superRefine((v, ctx) => {
    if (v.mrp !== null && v.price !== null && v.mrp < v.price) ctx.addIssue({ code: "custom", path: ["mrp"], message: "MRP can't be below the selling price." });
    if (v.mrp !== null && v.price === null) ctx.addIssue({ code: "custom", path: ["price"], message: "Set a price to show an MRP." });
  });
export type ProductInput = z.input<typeof productInput>;

export const variantInput = z.object({
  sku: skuRule,
  name: z.string().trim().min(1, "Name the variant, e.g. 16 GB / 512 GB.").max(80),
  attributes: z
    .array(z.object({ label: z.string().trim().max(40), value: z.string().trim().max(80) }))
    .max(10)
    .transform((rows) => rows.filter((r) => r.label && r.value)),
  price: rupees("the price"),
  /** Only used when creating the variant. */
  stock: z.number().int("Stock is a whole number.").min(0, "Stock can't be negative.").max(100_000),
  isActive: z.boolean(),
});
export type VariantInput = z.input<typeof variantInput>;

export const categoryInput = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes.")
    .max(60),
  parentId: z.string().uuid({ error: "Choose the department it belongs to." }),
  description: z.string().trim().max(300),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(10_000),
});
export type CategoryInput = z.input<typeof categoryInput>;

export const brandInput = z.object({
  name: z.string().trim().min(1, "Enter the brand name.").max(60),
  isActive: z.boolean(),
});
export type BrandInput = z.input<typeof brandInput>;
