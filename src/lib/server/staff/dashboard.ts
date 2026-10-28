import "server-only";
import { and, asc, count, desc, eq, inArray, notInArray, or, sql } from "drizzle-orm";
import { db, schema } from "../db";
import type { OrderStatus } from "../db/schema";
import { searchOrders } from "../orders";

const o = schema.orders;

/** Order-desk numbers for the staff dashboard, counted from the orders table. */
export async function staffMetrics() {
  const [byStatus, [payments], [lowStock]] = await Promise.all([
    db.select({ status: o.status, n: count() }).from(o).groupBy(o.status),
    db
      .select({
        onlineToVerify: sql<number>`count(*) filter (where ${o.paymentMethod} = 'online' and ${o.paymentStatus} = 'pending' and ${o.status} not in ('cancelled', 'returned'))::int`,
        codToCollect: sql<number>`count(*) filter (where ${o.paymentMethod} = 'cod' and ${o.paymentStatus} = 'pending' and ${o.status} in ('shipped', 'delivered'))::int`,
        refundDue: sql<number>`count(*) filter (where ${o.paymentStatus} = 'refund_pending')::int`,
      })
      .from(o),
    db
      .select({ n: count() })
      .from(schema.products)
      .where(sql`${schema.products.archivedAt} is null and ${schema.products.isActive} and ${schema.products.stock} <= ${schema.products.lowStockThreshold}`),
  ]);
  const status = Object.fromEntries(byStatus.map((r) => [r.status, r.n])) as Partial<Record<OrderStatus, number>>;
  return { status, total: byStatus.reduce((n, r) => n + r.n, 0), ...payments, lowStock: lowStock.n };
}

/**
 * Orders someone has to act on, oldest first: new orders to confirm, confirmed orders that can be
 * packed, packed orders to dispatch, and online orders whose payment isn't recorded yet.
 */
export async function ordersNeedingAction(limit = 8) {
  const ids = await db
    .select({ id: o.id })
    .from(o)
    .where(
      or(
        eq(o.status, "placed"),
        and(eq(o.status, "confirmed"), or(eq(o.paymentMethod, "cod"), eq(o.paymentStatus, "paid"))),
        eq(o.status, "packed"),
        and(eq(o.paymentMethod, "online"), eq(o.paymentStatus, "pending"), notInArray(o.status, ["cancelled", "returned"])),
      ),
    )
    .orderBy(asc(o.createdAt))
    .limit(limit);
  if (!ids.length) return [];
  const { rows } = await searchOrders({ ids: ids.map((r) => r.id), sort: "oldest", pageSize: limit });
  return rows;
}

/** Why an order is on the action list. */
export function nextActionLabel(order: { status: OrderStatus; paymentMethod: "cod" | "online"; paymentStatus: string }) {
  if (order.paymentMethod === "online" && order.paymentStatus === "pending" && order.status !== "placed") return "Verify payment";
  if (order.status === "placed") return "Confirm or reject";
  if (order.status === "confirmed") return "Pack";
  if (order.status === "packed") return "Dispatch";
  return null;
}

export async function recentlyUpdatedOrders(limit = 6) {
  return (await searchOrders({ sort: "updated", pageSize: limit })).rows;
}

export const STATUS_ORDER: OrderStatus[] = ["placed", "confirmed", "packed", "shipped", "delivered", "returned", "cancelled"];

/** Cancelled and returned orders, newest first, with their refund state. */
export async function cancellationsAndReturns({ kind, page = 1, pageSize = 25 }: { kind?: "cancelled" | "returned" | "refund_due"; page?: number; pageSize?: number }) {
  const where =
    kind === "refund_due"
      ? eq(o.paymentStatus, "refund_pending")
      : kind
        ? eq(o.status, kind)
        : inArray(o.status, ["cancelled", "returned"]);
  const [{ n }] = await db.select({ n: count() }).from(o).where(where);
  const ids = await db
    .select({ id: o.id })
    .from(o)
    .where(where)
    .orderBy(desc(o.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const rows = ids.length ? (await searchOrders({ ids: ids.map((r) => r.id), sort: "updated", pageSize })).rows : [];
  return { rows, total: n, page, pageSize };
}

