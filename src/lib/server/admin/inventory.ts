import "server-only";
import { and, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db";
import type { InventoryReason } from "../db/schema";
import { AdminError, audit, type Db, type Tx } from "./tx";

/** Reasons staff can pick. Order movements are written by the order flow only. */
export const manualReasons = ["restock", "correction", "damaged", "customer_return"] as const satisfies readonly InventoryReason[];

export const adjustmentInput = z
  .object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().nullable().default(null),
    /** "add": change by quantity (negative removes). "set": counted stock is quantity. */
    mode: z.enum(["add", "set"]),
    quantity: z.number().int("Use a whole number.").min(-100_000).max(100_000),
    reason: z.enum(manualReasons, { error: "Choose a reason." }),
    note: z.string().trim().max(300).default(""),
    /** The stock the person saw when they filled the form; a mismatch means someone else changed it. */
    expectedStock: z.number().int().min(0).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "set" && v.quantity < 0) ctx.addIssue({ code: "custom", path: ["quantity"], message: "Counted stock can't be negative." });
    if ((v.reason === "correction" || v.reason === "damaged") && !v.note) ctx.addIssue({ code: "custom", path: ["note"], message: "Say what happened." });
  });
export type AdjustmentInput = z.input<typeof adjustmentInput>;

/**
 * Changes stock on a product or variant and logs the movement, in one transaction. The row is
 * locked first so concurrent adjustments and orders queue up instead of overwriting each other.
 */
export async function adjustStock(actorId: string, input: AdjustmentInput) {
  const v = adjustmentInput.parse(input);
  return db.transaction(async (tx) => {
    const [product] = await tx
      .select({ id: schema.products.id, name: schema.products.name, stock: schema.products.stock })
      .from(schema.products)
      .where(eq(schema.products.id, v.productId))
      .for("update");
    if (!product) throw new AdminError("Product not found.");

    let current = product.stock;
    let label = product.name;
    if (v.variantId) {
      const [variant] = await tx
        .select({ stock: schema.productVariants.stock, name: schema.productVariants.name })
        .from(schema.productVariants)
        .where(and(eq(schema.productVariants.id, v.variantId), eq(schema.productVariants.productId, v.productId)))
        .for("update");
      if (!variant) throw new AdminError("Variant not found.");
      current = variant.stock;
      label = `${product.name} (${variant.name})`;
    }

    if (v.expectedStock !== undefined && v.expectedStock !== current) {
      throw new AdminError(`Stock changed to ${current} while you were editing. Check the new count and try again.`);
    }
    const delta = v.mode === "set" ? v.quantity - current : v.quantity;
    if (delta === 0) throw new AdminError("That doesn't change the stock.");
    if (current + delta < 0) throw new AdminError(`Only ${current} in stock; you can't remove ${-delta}.`);
    if ((v.reason === "restock" || v.reason === "customer_return") && delta < 0) throw new AdminError("Restocks and returns add stock. Use Correction or Damaged to remove it.");
    if (v.reason === "damaged" && delta > 0) throw new AdminError("Damaged stock is removed, not added.");

    const stockAfter = current + delta;
    if (v.variantId) {
      await tx.update(schema.productVariants).set({ stock: stockAfter }).where(eq(schema.productVariants.id, v.variantId));
    } else {
      await tx.update(schema.products).set({ stock: stockAfter }).where(eq(schema.products.id, v.productId));
    }
    await tx.insert(schema.inventoryMovements).values({
      productId: v.productId,
      variantId: v.variantId,
      delta,
      stockAfter,
      reason: v.reason,
      note: v.note || null,
      actorId,
    });
    await audit(tx, {
      actorId,
      action: "inventory.adjust",
      entityType: "product",
      entityId: v.productId,
      summary: `${delta > 0 ? "Added" : "Removed"} ${Math.abs(delta)} × ${label} (${v.reason.replace("_", " ")}); now ${stockAfter}`,
      details: { variantId: v.variantId, delta, stockBefore: current, stockAfter, reason: v.reason, note: v.note || null },
    });
    return { delta, stockAfter };
  });
}

/** Logs stock taken by, or returned from, an order. Call inside the order's transaction after updating stock. */
export async function logOrderMovements(tx: Tx, orderId: string, actorId: string | null, lines: { productId: string; delta: number; stockAfter: number }[], reason: "order_placed" | "order_cancelled") {
  if (!lines.length) return;
  await tx.insert(schema.inventoryMovements).values(lines.map((l) => ({ ...l, reason, orderId, actorId })));
}

/**
 * Units in orders that are placed or packed: already off the shelf count (stock) but still in
 * the building. On hand = stock + reserved.
 */
export async function reservedByProduct(q: Db = db, productIds?: string[]) {
  const rows = await q
    .select({ productId: schema.products.id, reserved: sql<number>`coalesce(sum(${schema.orderItems.quantity}), 0)::int` })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
    .innerJoin(schema.products, eq(schema.products.slug, schema.orderItems.productSlug))
    .where(and(inArray(schema.orders.status, ["placed", "packed"]), productIds ? inArray(schema.products.id, productIds) : undefined))
    .groupBy(schema.products.id);
  return new Map(rows.map((r) => [r.productId, r.reserved]));
}

export async function listMovements({ productId, reason, page = 1, pageSize = 25 }: { productId?: string; reason?: InventoryReason; page?: number; pageSize?: number }) {
  const where: SQL[] = [];
  if (productId) where.push(eq(schema.inventoryMovements.productId, productId));
  if (reason) where.push(eq(schema.inventoryMovements.reason, reason));
  const cond = where.length ? and(...where) : undefined;
  const [rows, [{ n }]] = await Promise.all([
    db
      .select({
        m: schema.inventoryMovements,
        productName: schema.products.name,
        productSku: schema.products.sku,
        variantName: schema.productVariants.name,
        actorFirst: schema.users.firstName,
        actorLast: schema.users.lastName,
        actorRole: schema.users.role,
        orderSeq: schema.orders.seq,
      })
      .from(schema.inventoryMovements)
      .innerJoin(schema.products, eq(schema.products.id, schema.inventoryMovements.productId))
      .leftJoin(schema.productVariants, eq(schema.productVariants.id, schema.inventoryMovements.variantId))
      .leftJoin(schema.users, eq(schema.users.id, schema.inventoryMovements.actorId))
      .leftJoin(schema.orders, eq(schema.orders.id, schema.inventoryMovements.orderId))
      .where(cond)
      .orderBy(desc(schema.inventoryMovements.createdAt), desc(schema.inventoryMovements.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(schema.inventoryMovements).where(cond),
  ]);
  return { rows, total: n };
}
