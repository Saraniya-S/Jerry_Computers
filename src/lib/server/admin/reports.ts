import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, count, desc, eq, gte, isNull, lt, ne, notInArray, sql } from "drizzle-orm";
import { OPEN_FOR_ADMIN_STATUSES } from "@/lib/service-desk";
import { db, schema } from "../db";
import type { DeviceType, OrderStatus, ServiceStatus } from "../db/schema";
import { collectionTotals } from "./collections";
import { listEngineers } from "./engineers";

const sum = (col: unknown) => sql<number>`coalesce(sum(${col}), 0)::int`;

/** Headline numbers for the admin overview, all counted from the database. */
export async function dashboardMetrics() {
  const monthStart = sql`date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'`;
  const [orderRows, [products], [customers], [money], serviceRows, [engineers], [transfers]] = await Promise.all([
    db.select({ status: schema.orders.status, n: count() }).from(schema.orders).groupBy(schema.orders.status),
    db
      .select({
        live: sql<number>`count(*) filter (where ${schema.products.isActive})::int`,
        total: count(),
        low: sql<number>`count(*) filter (where ${schema.products.isActive} and ${schema.products.stock} <= ${schema.products.lowStockThreshold})::int`,
      })
      .from(schema.products)
      .where(isNull(schema.products.archivedAt)),
    db
      .select({
        active: sql<number>`count(*) filter (where ${schema.users.disabledAt} is null)::int`,
        ordered90: sql<number>`count(*) filter (where exists (select 1 from ${schema.orders} o where o.user_id = ${schema.users.id} and o.created_at >= now() - interval '90 days'))::int`,
      })
      .from(schema.users)
      .where(eq(schema.users.role, "customer")),
    db
      .select({
        collected: sql<number>`coalesce(sum(${schema.payments.amountPaise}) filter (where ${schema.payments.kind} = 'payment' and ${schema.payments.createdAt} >= ${monthStart}), 0)::int`,
        refunded: sql<number>`coalesce(sum(${schema.payments.amountPaise}) filter (where ${schema.payments.kind} = 'refund' and ${schema.payments.createdAt} >= ${monthStart}), 0)::int`,
        payments: sql<number>`count(*) filter (where ${schema.payments.kind} = 'payment' and ${schema.payments.createdAt} >= ${monthStart})::int`,
      })
      .from(schema.payments),
    db.select({ status: schema.serviceRequests.status, n: count() }).from(schema.serviceRequests).groupBy(schema.serviceRequests.status),
    db
      .select({
        total: count(),
        available: sql<number>`count(*) filter (where ${schema.users.disabledAt} is null and ${schema.users.passwordHash} is not null and coalesce(${schema.engineerProfiles.isAvailable}, true))::int`,
      })
      .from(schema.users)
      .leftJoin(schema.engineerProfiles, eq(schema.engineerProfiles.userId, schema.users.id))
      .where(eq(schema.users.role, "engineer")),
    db.select({ n: count() }).from(schema.transferRequests).where(eq(schema.transferRequests.status, "pending")),
  ]);
  const [unpaid] = await db
    .select({ n: count(), value: sum(schema.orders.totalPaise) })
    .from(schema.orders)
    .where(and(eq(schema.orders.paymentStatus, "pending"), notInArray(schema.orders.status, ["cancelled", "returned"])));

  const orders = Object.fromEntries(orderRows.map((r) => [r.status, r.n])) as Partial<Record<OrderStatus, number>>;
  const services = Object.fromEntries(serviceRows.map((r) => [r.status, r.n])) as Partial<Record<ServiceStatus, number>>;
  return {
    orders,
    totalOrders: orderRows.reduce((s, r) => s + r.n, 0),
    pendingOrders: (orders.placed ?? 0) + (orders.confirmed ?? 0) + (orders.packed ?? 0),
    unpaid,
    products,
    customers,
    money,
    services,
    openServices: OPEN_FOR_ADMIN_STATUSES.reduce((s, k) => s + (services[k] ?? 0), 0),
    unableServices: services.unable_to_complete ?? 0,
    unassignedServices: services.open ?? 0,
    engineers,
    pendingTransfers: transfers.n,
  };
}

export async function lowStockProducts(limit = 6) {
  return db
    .select({ id: schema.products.id, name: schema.products.name, sku: schema.products.sku, stock: schema.products.stock, threshold: schema.products.lowStockThreshold })
    .from(schema.products)
    .where(and(isNull(schema.products.archivedAt), eq(schema.products.isActive, true), sql`${schema.products.stock} <= ${schema.products.lowStockThreshold}`))
    .orderBy(schema.products.stock, schema.products.name)
    .limit(limit);
}

const engineer = alias(schema.users, "engineer");

export async function recentServiceRequests(limit = 6) {
  return db
    .select({ r: schema.serviceRequests, engineerName: sql<string | null>`${engineer.firstName} || ' ' || ${engineer.lastName}` })
    .from(schema.serviceRequests)
    .leftJoin(engineer, eq(engineer.id, schema.serviceRequests.assignedEngineerId))
    .orderBy(desc(schema.serviceRequests.createdAt))
    .limit(limit);
}

/** Date range in shop time (IST), inclusive of both days. */
export type Range = { from: string; to: string };
const start = (d: string) => new Date(`${d}T00:00:00+05:30`);
const endExclusive = (d: string) => new Date(start(d).getTime() + 86_400_000);

export async function salesReport(r: Range) {
  const inRange = (col: Parameters<typeof gte>[0]) => and(gte(col, start(r.from)), lt(col, endExclusive(r.to)));
  const [byMethod, booked, statusRows, topProducts, outstanding] = await Promise.all([
    // Money that actually moved, from payment records.
    db
      .select({ kind: schema.payments.kind, method: schema.payments.method, n: count(), amount: sum(schema.payments.amountPaise) })
      .from(schema.payments)
      .where(inRange(schema.payments.createdAt))
      .groupBy(schema.payments.kind, schema.payments.method),
    // Orders placed in the range (whether or not paid yet).
    db
      .select({
        n: sql<number>`count(*) filter (where ${schema.orders.status} not in ('cancelled', 'returned'))::int`,
        value: sql<number>`coalesce(sum(${schema.orders.totalPaise}) filter (where ${schema.orders.status} not in ('cancelled', 'returned')), 0)::int`,
        cancelled: sql<number>`count(*) filter (where ${schema.orders.status} = 'cancelled')::int`,
        cancelledValue: sql<number>`coalesce(sum(${schema.orders.totalPaise}) filter (where ${schema.orders.status} = 'cancelled'), 0)::int`,
      })
      .from(schema.orders)
      .where(inRange(schema.orders.createdAt)),
    db.select({ status: schema.orders.status, n: count(), value: sum(schema.orders.totalPaise) }).from(schema.orders).where(inRange(schema.orders.createdAt)).groupBy(schema.orders.status),
    db
      .select({ name: schema.orderItems.productName, slug: schema.orderItems.productSlug, units: sum(schema.orderItems.quantity), value: sql<number>`coalesce(sum(${schema.orderItems.quantity} * ${schema.orderItems.unitPricePaise}), 0)::int` })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .where(and(inRange(schema.orders.createdAt), ne(schema.orders.status, "cancelled")))
      .groupBy(schema.orderItems.productName, schema.orderItems.productSlug)
      .orderBy(desc(sql`sum(${schema.orderItems.quantity})`))
      .limit(10),
    // Right now, regardless of range.
    db
      .select({
        codDue: sql<number>`coalesce(sum(${schema.orders.totalPaise}) filter (where ${schema.orders.paymentMethod} = 'cod' and ${schema.orders.paymentStatus} = 'pending' and ${schema.orders.status} not in ('cancelled', 'returned')), 0)::int`,
        codDueN: sql<number>`count(*) filter (where ${schema.orders.paymentMethod} = 'cod' and ${schema.orders.paymentStatus} = 'pending' and ${schema.orders.status} not in ('cancelled', 'returned'))::int`,
        onlineDue: sql<number>`coalesce(sum(${schema.orders.totalPaise}) filter (where ${schema.orders.paymentMethod} = 'online' and ${schema.orders.paymentStatus} = 'pending' and ${schema.orders.status} not in ('cancelled', 'returned')), 0)::int`,
        onlineDueN: sql<number>`count(*) filter (where ${schema.orders.paymentMethod} = 'online' and ${schema.orders.paymentStatus} = 'pending' and ${schema.orders.status} not in ('cancelled', 'returned'))::int`,
        refundDue: sql<number>`coalesce(sum(${schema.orders.totalPaise}) filter (where ${schema.orders.paymentStatus} = 'refund_pending'), 0)::int`,
        refundDueN: sql<number>`count(*) filter (where ${schema.orders.paymentStatus} = 'refund_pending')::int`,
      })
      .from(schema.orders),
  ]);
  const pick = (kind: "payment" | "refund", method?: "cod" | "online") =>
    byMethod.filter((m) => m.kind === kind && (!method || m.method === method)).reduce((a, m) => ({ n: a.n + m.n, amount: a.amount + m.amount }), { n: 0, amount: 0 });
  const gross = pick("payment");
  const refunds = pick("refund");
  return {
    gross,
    refunds,
    net: gross.amount - refunds.amount,
    cod: pick("payment", "cod"),
    online: pick("payment", "online"),
    booked: booked[0],
    statuses: statusRows,
    topProducts,
    outstanding: outstanding[0],
  };
}

export async function inventoryReport(r: Range) {
  const [[stock], movements] = await Promise.all([
    db
      .select({
        products: count(),
        units: sum(schema.products.stock),
        value: sql<number>`coalesce(sum(${schema.products.stock}::bigint * ${schema.products.pricePaise}) filter (where ${schema.products.pricePaise} is not null), 0)::bigint`,
        unpricedUnits: sql<number>`coalesce(sum(${schema.products.stock}) filter (where ${schema.products.pricePaise} is null), 0)::int`,
        out: sql<number>`count(*) filter (where ${schema.products.stock} = 0)::int`,
        low: sql<number>`count(*) filter (where ${schema.products.stock} > 0 and ${schema.products.stock} <= ${schema.products.lowStockThreshold})::int`,
      })
      .from(schema.products)
      .where(isNull(schema.products.archivedAt)),
    db
      .select({ reason: schema.inventoryMovements.reason, n: count(), units: sum(schema.inventoryMovements.delta) })
      .from(schema.inventoryMovements)
      .where(and(gte(schema.inventoryMovements.createdAt, start(r.from)), lt(schema.inventoryMovements.createdAt, endExclusive(r.to)), ne(schema.inventoryMovements.reason, "opening_balance")))
      .groupBy(schema.inventoryMovements.reason),
  ]);
  return { stock: { ...stock, value: Number(stock.value) }, movements };
}

export async function serviceReport(r: Range) {
  const created = and(gte(schema.serviceRequests.createdAt, start(r.from)), lt(schema.serviceRequests.createdAt, endExclusive(r.to)));
  const completedIn = and(eq(schema.serviceRequests.status, "completed"), gte(schema.serviceRequests.completedAt, start(r.from)), lt(schema.serviceRequests.completedAt, endExclusive(r.to)));
  const [byStatus, byDevice, byLocation, [done], perEngineer, engineers, [transfers]] = await Promise.all([
    db.select({ status: schema.serviceRequests.status, n: count() }).from(schema.serviceRequests).where(created).groupBy(schema.serviceRequests.status),
    db.select({ device: schema.serviceRequests.deviceType, n: count() }).from(schema.serviceRequests).where(created).groupBy(schema.serviceRequests.deviceType),
    db.select({ location: schema.serviceRequests.location, source: schema.serviceRequests.source, n: count() }).from(schema.serviceRequests).where(created).groupBy(schema.serviceRequests.location, schema.serviceRequests.source),
    db
      .select({ n: count(), avgHours: sql<number | null>`round(avg(extract(epoch from (${schema.serviceRequests.completedAt} - ${schema.serviceRequests.createdAt})) / 3600)::numeric, 1)::float` })
      .from(schema.serviceRequests)
      .where(completedIn),
    db.select({ id: schema.serviceRequests.assignedEngineerId, n: count() }).from(schema.serviceRequests).where(completedIn).groupBy(schema.serviceRequests.assignedEngineerId),
    listEngineers(),
    db
      .select({
        requested: count(),
        approved: sql<number>`count(*) filter (where ${schema.transferRequests.status} = 'approved')::int`,
        rejected: sql<number>`count(*) filter (where ${schema.transferRequests.status} = 'rejected')::int`,
      })
      .from(schema.transferRequests)
      .where(and(gte(schema.transferRequests.createdAt, start(r.from)), lt(schema.transferRequests.createdAt, endExclusive(r.to)))),
  ]);
  const [pending] = await db.select({ n: count() }).from(schema.transferRequests).where(eq(schema.transferRequests.status, "pending"));
  const collected = await collectionTotals(start(r.from), endExclusive(r.to));
  return {
    collected,
    byStatus: byStatus as { status: ServiceStatus; n: number }[],
    byDevice: byDevice as { device: DeviceType; n: number }[],
    byLocation,
    created: byStatus.reduce((s, x) => s + x.n, 0),
    completed: done,
    engineers: engineers.map((e) => ({ ...e, completedInRange: perEngineer.find((p) => p.id === e.id)?.n ?? 0 })),
    transfers: { ...transfers, pending: pending.n },
  };
}
