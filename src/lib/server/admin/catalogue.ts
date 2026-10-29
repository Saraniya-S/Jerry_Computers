import "server-only";
import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { brandInput, categoryInput, productInput, slugify, variantInput, type BrandInput, type CategoryInput, type ProductInput, type VariantInput } from "@/lib/admin/product";
import { db, schema } from "../db";
import { AdminError, audit, isUniqueViolation, type Tx } from "./tx";

/** Thrown with per-field messages for the form. */
export class FieldError extends AdminError {
  constructor(public fields: Record<string, string>) {
    super("Check the highlighted fields.");
  }
}

/** SKUs are unique across products and variants together. */
async function skuTaken(tx: Tx, sku: string, except: { productId?: string; variantId?: string }) {
  const [p] = await tx
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(and(eq(schema.products.sku, sku), except.productId ? ne(schema.products.id, except.productId) : undefined));
  if (p) return true;
  const [v] = await tx
    .select({ id: schema.productVariants.id })
    .from(schema.productVariants)
    .where(and(eq(schema.productVariants.sku, sku), except.variantId ? ne(schema.productVariants.id, except.variantId) : undefined));
  return Boolean(v);
}

/** Order lines point at products by slug, so these can't be renamed or deleted once sold. */
async function timesOrdered(q: Tx | typeof db, slug: string) {
  const [{ n }] = await q.select({ n: count() }).from(schema.orderItems).where(eq(schema.orderItems.productSlug, slug));
  return n;
}

// Serialises SKU checks so two saves can't claim the same SKU between the check and the insert.
const lockSkus = (tx: Tx) => tx.execute(sql`select pg_advisory_xact_lock(hashtext('jc:sku'))`);

/** Creates or updates a product. Stock is only set on create; after that it moves through inventory adjustments. */
export async function saveProduct(actorId: string, id: string | null, input: ProductInput) {
  const parsed = productInput.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    throw new FieldError(fields);
  }
  const v = parsed.data;

  try {
    return await db.transaction(async (tx) => {
      await lockSkus(tx);
      const existing = id ? (await tx.select().from(schema.products).where(eq(schema.products.id, id)).for("update"))[0] : null;
      if (id && !existing) throw new AdminError("Product not found.");

      const fields: Record<string, string> = {};
      const [slugClash] = await tx
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(and(eq(schema.products.slug, v.slug), id ? ne(schema.products.id, id) : undefined));
      if (slugClash) fields.slug = "Another product already uses this web address.";
      if (await skuTaken(tx, v.sku, { productId: id ?? undefined })) fields.sku = "Another product or variant already uses this SKU.";
      if (existing && existing.slug !== v.slug && (await timesOrdered(tx, existing.slug)) > 0) {
        fields.slug = "This product has been ordered, so its web address is fixed (order history links to it).";
      }

      let brandName: string | null = null;
      if (v.brandId) {
        const [b] = await tx.select().from(schema.brands).where(eq(schema.brands.id, v.brandId));
        if (!b) fields.brandId = "Choose a brand from the list.";
        else brandName = b.name;
      }
      if (v.subcategoryId) {
        const [c] = await tx
          .select({ id: schema.categories.id, parentSlug: sql<string>`(select p.slug from ${schema.categories} p where p.id = ${schema.categories.parentId})` })
          .from(schema.categories)
          .where(eq(schema.categories.id, v.subcategoryId));
        if (!c) fields.subcategoryId = "Choose a sub-category from the list.";
        else if (c.parentSlug !== v.category) fields.subcategoryId = "That sub-category belongs to another department.";
      }
      if (existing?.archivedAt && v.isActive) fields.isActive = "Restore the product from the archive before showing it in the store.";
      if (Object.keys(fields).length) throw new FieldError(fields);

      const values = {
        name: v.name,
        slug: v.slug,
        sku: v.sku,
        brandId: v.brandId,
        brand: brandName,
        category: v.category,
        subcategoryId: v.subcategoryId,
        summary: v.summary,
        description: v.description,
        uses: v.uses,
        specs: v.specs,
        images: v.images,
        pricePaise: v.price,
        mrpPaise: v.mrp,
        gstRateBp: v.gstRateBp,
        lowStockThreshold: v.lowStockThreshold,
        isActive: v.isActive,
        isFeatured: v.isFeatured,
        codAvailable: v.codAvailable,
        artVariant: v.artVariant,
      };

      if (existing) {
        await tx.update(schema.products).set(values).where(eq(schema.products.id, existing.id));
        if (existing.slug !== v.slug) await tx.update(schema.cartItems).set({ productSlug: v.slug }).where(eq(schema.cartItems.productSlug, existing.slug));
        const changed = (Object.keys(values) as (keyof typeof values)[]).filter((k) => JSON.stringify(values[k]) !== JSON.stringify(existing[k]));
        if (changed.length) {
          await audit(tx, {
            actorId,
            action: "product.update",
            entityType: "product",
            entityId: existing.id,
            summary: `Updated ${v.name}: ${changed.join(", ")}`,
            details: Object.fromEntries(changed.map((k) => [k, { from: existing[k], to: values[k] }])),
          });
        }
        return existing.id;
      }

      const [created] = await tx.insert(schema.products).values({ ...values, stock: v.stock }).returning({ id: schema.products.id });
      await tx.insert(schema.inventoryMovements).values({ productId: created.id, delta: v.stock, stockAfter: v.stock, reason: "opening_balance", note: "Stock when the product was created", actorId });
      await audit(tx, { actorId, action: "product.create", entityType: "product", entityId: created.id, summary: `Created ${v.name} (${v.sku}) with ${v.stock} in stock` });
      return created.id;
    });
  } catch (err) {
    if (isUniqueViolation(err, "products_sku_key")) throw new FieldError({ sku: "Another product already uses this SKU." });
    if (isUniqueViolation(err, "products_slug_key")) throw new FieldError({ slug: "Another product already uses this web address." });
    throw err;
  }
}

export async function setProductArchived(actorId: string, id: string, archived: boolean) {
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(schema.products).where(eq(schema.products.id, id)).for("update");
    if (!p) throw new AdminError("Product not found.");
    if (Boolean(p.archivedAt) === archived) return;
    // Archiving hides it; restoring keeps it hidden until someone switches it back on.
    await tx
      .update(schema.products)
      .set(archived ? { archivedAt: new Date(), isActive: false, isFeatured: false } : { archivedAt: null })
      .where(eq(schema.products.id, id));
    if (archived) await tx.delete(schema.cartItems).where(eq(schema.cartItems.productSlug, p.slug));
    await audit(tx, { actorId, action: archived ? "product.archive" : "product.restore", entityType: "product", entityId: id, summary: `${archived ? "Archived" : "Restored"} ${p.name}` });
  });
}

/** Why a product can't be deleted, or null when it can (never sold and stock never moved). */
export async function productDeleteBlocker(id: string) {
  const [p] = await db.select({ slug: schema.products.slug }).from(schema.products).where(eq(schema.products.id, id));
  if (!p) return "Product not found.";
  const ordered = await timesOrdered(db, p.slug);
  if (ordered) return `It appears in ${ordered} order${ordered === 1 ? "" : "s"}. Archive it instead to keep order history intact.`;
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.inventoryMovements)
    .where(and(eq(schema.inventoryMovements.productId, id), ne(schema.inventoryMovements.reason, "opening_balance")));
  if (n) return "Its stock has history (restocks or adjustments). Archive it instead to keep the inventory record.";
  return null;
}

export async function deleteProduct(actorId: string, id: string) {
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(schema.products).where(eq(schema.products.id, id)).for("update");
    if (!p) throw new AdminError("Product not found.");
    const blocker = await productDeleteBlocker(id);
    if (blocker) throw new AdminError(`${p.name} can't be deleted: ${blocker}`);
    await tx.delete(schema.cartItems).where(eq(schema.cartItems.productSlug, p.slug));
    await tx.delete(schema.products).where(eq(schema.products.id, id));
    await audit(tx, { actorId, action: "product.delete", entityType: "product", entityId: id, summary: `Deleted ${p.name} (${p.sku})`, details: { slug: p.slug, sku: p.sku } });
  });
}

/* Variants */

export async function saveVariant(actorId: string, productId: string, variantId: string | null, input: VariantInput) {
  const parsed = variantInput.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    throw new FieldError(fields);
  }
  const v = parsed.data;
  try {
    return await db.transaction(async (tx) => {
      await lockSkus(tx);
      const [product] = await tx.select({ id: schema.products.id, name: schema.products.name }).from(schema.products).where(eq(schema.products.id, productId));
      if (!product) throw new AdminError("Product not found.");
      if (await skuTaken(tx, v.sku, { variantId: variantId ?? undefined })) throw new FieldError({ sku: "Another product or variant already uses this SKU." });
      const values = { sku: v.sku, name: v.name, attributes: v.attributes, pricePaise: v.price, isActive: v.isActive };
      if (variantId) {
        const [updated] = await tx
          .update(schema.productVariants)
          .set(values)
          .where(and(eq(schema.productVariants.id, variantId), eq(schema.productVariants.productId, productId)))
          .returning({ id: schema.productVariants.id });
        if (!updated) throw new AdminError("Variant not found.");
        await audit(tx, { actorId, action: "variant.update", entityType: "product", entityId: productId, summary: `Updated variant ${v.name} (${v.sku}) of ${product.name}` });
        return variantId;
      }
      const [created] = await tx.insert(schema.productVariants).values({ ...values, productId, stock: v.stock }).returning({ id: schema.productVariants.id });
      await tx.insert(schema.inventoryMovements).values({ productId, variantId: created.id, delta: v.stock, stockAfter: v.stock, reason: "opening_balance", note: "Stock when the variant was created", actorId });
      await audit(tx, { actorId, action: "variant.create", entityType: "product", entityId: productId, summary: `Added variant ${v.name} (${v.sku}) to ${product.name} with ${v.stock} in stock` });
      return created.id;
    });
  } catch (err) {
    if (isUniqueViolation(err, "product_variants_sku_key")) throw new FieldError({ sku: "Another variant already uses this SKU." });
    throw err;
  }
}

export async function deleteVariant(actorId: string, productId: string, variantId: string) {
  await db.transaction(async (tx) => {
    const [variant] = await tx
      .select()
      .from(schema.productVariants)
      .where(and(eq(schema.productVariants.id, variantId), eq(schema.productVariants.productId, productId)))
      .for("update");
    if (!variant) throw new AdminError("Variant not found.");
    const [{ n }] = await tx
      .select({ n: count() })
      .from(schema.inventoryMovements)
      .where(and(eq(schema.inventoryMovements.variantId, variantId), ne(schema.inventoryMovements.reason, "opening_balance")));
    if (n) throw new AdminError("This variant's stock has history. Switch it off instead of deleting it.");
    await tx.delete(schema.productVariants).where(eq(schema.productVariants.id, variantId));
    await audit(tx, { actorId, action: "variant.delete", entityType: "product", entityId: productId, summary: `Deleted variant ${variant.name} (${variant.sku})` });
  });
}

/* Categories */

export async function listCategoryTree() {
  const rows = await db
    .select({
      c: schema.categories,
      products: sql<number>`(case when ${schema.categories.isDepartment}
        then (select count(*)::int from ${schema.products} p where p.category = ${schema.categories.slug} and p.archived_at is null)
        else (select count(*)::int from ${schema.products} p where p.subcategory_id = ${schema.categories.id} and p.archived_at is null) end)`,
    })
    .from(schema.categories)
    .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name));
  const departments = rows.filter((r) => r.c.isDepartment);
  return departments.map((d) => ({ ...d.c, products: d.products, children: rows.filter((r) => r.c.parentId === d.c.id).map((r) => ({ ...r.c, products: r.products })) }));
}

/** Creates or updates a sub-category. Departments are fixed because the storefront is built on them. */
export async function saveCategory(actorId: string, id: string | null, input: CategoryInput) {
  const parsed = categoryInput.safeParse({ ...input, slug: input.slug || slugify(String(input.name ?? "")) });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    throw new FieldError(fields);
  }
  const v = parsed.data;
  try {
    return await db.transaction(async (tx) => {
      const [parent] = await tx.select().from(schema.categories).where(eq(schema.categories.id, v.parentId));
      if (!parent?.isDepartment) throw new FieldError({ parentId: "Sub-categories go directly under a store department." });
      if (id) {
        const [cur] = await tx.select().from(schema.categories).where(eq(schema.categories.id, id)).for("update");
        if (!cur) throw new AdminError("Category not found.");
        if (cur.isDepartment) throw new AdminError("Store departments are fixed. Add a sub-category under it instead.");
        if (cur.parentId !== v.parentId) {
          const [{ n }] = await tx.select({ n: count() }).from(schema.products).where(eq(schema.products.subcategoryId, id));
          if (n) throw new FieldError({ parentId: `${n} product${n === 1 ? " is" : "s are"} in this sub-category. Move them before changing its department.` });
        }
        await tx.update(schema.categories).set(v).where(eq(schema.categories.id, id));
        await audit(tx, { actorId, action: "category.update", entityType: "category", entityId: id, summary: `Updated category ${v.name}` });
        return id;
      }
      const [created] = await tx.insert(schema.categories).values(v).returning({ id: schema.categories.id });
      await audit(tx, { actorId, action: "category.create", entityType: "category", entityId: created.id, summary: `Created category ${v.name} under ${parent.name}` });
      return created.id;
    });
  } catch (err) {
    if (isUniqueViolation(err, "categories_slug_key")) throw new FieldError({ slug: "Another category already uses this web address." });
    throw err;
  }
}

export async function deleteCategory(actorId: string, id: string) {
  await db.transaction(async (tx) => {
    const [cur] = await tx.select().from(schema.categories).where(eq(schema.categories.id, id)).for("update");
    if (!cur) throw new AdminError("Category not found.");
    if (cur.isDepartment) throw new AdminError("Store departments can't be deleted.");
    const [{ n }] = await tx.select({ n: count() }).from(schema.products).where(eq(schema.products.subcategoryId, id));
    if (n) throw new AdminError(`${n} product${n === 1 ? " uses" : "s use"} ${cur.name}. Move ${n === 1 ? "it" : "them"} to another sub-category first.`);
    await tx.delete(schema.categories).where(eq(schema.categories.id, id));
    await audit(tx, { actorId, action: "category.delete", entityType: "category", entityId: id, summary: `Deleted category ${cur.name}` });
  });
}

/* Brands */

export async function listBrands(q = "") {
  return db
    .select({
      b: schema.brands,
      products: sql<number>`(select count(*)::int from ${schema.products} p where p.brand_id = ${schema.brands.id} and p.archived_at is null)`,
    })
    .from(schema.brands)
    .where(q ? sql`${schema.brands.name} ilike ${`%${q}%`}` : undefined)
    .orderBy(asc(schema.brands.name));
}

/** Creates or renames a brand. A rename updates the brand name shown on its products too. */
export async function saveBrand(actorId: string, id: string | null, input: BrandInput) {
  const parsed = brandInput.safeParse(input);
  if (!parsed.success) throw new FieldError({ name: parsed.error.issues[0].message });
  const v = parsed.data;
  const slug = slugify(v.name);
  if (!slug) throw new FieldError({ name: "Use at least one letter or number." });
  try {
    return await db.transaction(async (tx) => {
      if (id) {
        const [cur] = await tx.select().from(schema.brands).where(eq(schema.brands.id, id)).for("update");
        if (!cur) throw new AdminError("Brand not found.");
        await tx.update(schema.brands).set({ name: v.name, slug, isActive: v.isActive }).where(eq(schema.brands.id, id));
        if (cur.name !== v.name) await tx.update(schema.products).set({ brand: v.name }).where(eq(schema.products.brandId, id));
        await audit(tx, { actorId, action: "brand.update", entityType: "brand", entityId: id, summary: cur.name === v.name ? `Updated brand ${v.name}` : `Renamed brand ${cur.name} to ${v.name}` });
        return id;
      }
      const [created] = await tx.insert(schema.brands).values({ name: v.name, slug, isActive: v.isActive }).returning({ id: schema.brands.id });
      await audit(tx, { actorId, action: "brand.create", entityType: "brand", entityId: created.id, summary: `Created brand ${v.name}` });
      return created.id;
    });
  } catch (err) {
    if (isUniqueViolation(err, "brands_slug_key")) throw new FieldError({ name: "That brand already exists." });
    throw err;
  }
}

export async function deleteBrand(actorId: string, id: string) {
  await db.transaction(async (tx) => {
    const [cur] = await tx.select().from(schema.brands).where(eq(schema.brands.id, id)).for("update");
    if (!cur) throw new AdminError("Brand not found.");
    const [{ n }] = await tx.select({ n: count() }).from(schema.products).where(eq(schema.products.brandId, id));
    if (n) throw new AdminError(`${n} product${n === 1 ? " uses" : "s use"} ${cur.name}. Switch the brand off instead, or change those products first.`);
    await tx.delete(schema.brands).where(eq(schema.brands.id, id));
    await audit(tx, { actorId, action: "brand.delete", entityType: "brand", entityId: id, summary: `Deleted brand ${cur.name}` });
  });
}
