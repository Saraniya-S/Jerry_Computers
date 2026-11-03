import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { canBuy, getCategory } from "@/data/products";
import { shippingFor } from "@/lib/settings";
import { getCatalogue } from "./catalogue";
import { db, schema } from "./db";
import type { DispatchInput } from "@/lib/couriers";
import { orderNumber } from "@/lib/money";
import { logOrderMovements } from "./admin/inventory";
import { createShipmentTx, deliverShipmentsTx, shipmentsForOrders } from "./admin/shipments";
import { audit, type Tx } from "./admin/tx";
import type { AddressSnapshot, InvoiceLine, OrderStatus, PaymentStatus } from "./db/schema";
import { notify, notifyAdmins } from "./notifications";
import { razorpayEnabled } from "./env";
import { getSettings } from "./settings";

export class OrderError extends Error {}

/** How long an unpaid online checkout holds its stock before it's released. */
export const CHECKOUT_HOLD_MINUTES = 30;

/**
 * Orders that were really placed (see orders.placedAt), plus any unpaid checkout that took money
 * after it expired and so needs a refund. Staff lists, counts and reports only ever see these.
 */
export const isPlaced = or(isNotNull(schema.orders.placedAt), ne(schema.orders.paymentStatus, "pending"))!;

/** Puts an order's items back on the shelf and logs it. */
async function releaseStock(tx: Tx, orderId: string, actorId: string | null) {
  const items = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
  const moved: { productId: string; delta: number; stockAfter: number }[] = [];
  for (const i of items) {
    const [p] = await tx
      .update(schema.products)
      .set({ stock: sql`${schema.products.stock} + ${i.quantity}` })
      .where(eq(schema.products.slug, i.productSlug))
      .returning({ id: schema.products.id, stock: schema.products.stock });
    if (p) moved.push({ productId: p.id, delta: i.quantity, stockAfter: p.stock });
  }
  await logOrderMovements(tx, orderId, actorId, moved, "order_cancelled");
}

/** Cancels the unpaid online checkouts matching `where` and releases their stock. Rows another transaction holds are left for next time. */
async function cancelCheckouts(tx: Tx, where: SQL, reason: string) {
  const rows = await tx
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(and(isNull(schema.orders.placedAt), eq(schema.orders.status, "placed"), eq(schema.orders.paymentStatus, "pending"), where))
    .for("update", { skipLocked: true });
  for (const { id } of rows) {
    await releaseStock(tx, id, null);
    await tx.update(schema.orders).set({ status: "cancelled", cancelledAt: new Date(), cancelReason: reason }).where(eq(schema.orders.id, id));
  }
  return rows.length;
}

/**
 * Releases the stock of online checkouts left unpaid for longer than CHECKOUT_HOLD_MINUTES. Runs
 * before every checkout and payment attempt, so abandoned checkouts never block a buyer.
 */
export async function expireUnpaidCheckouts(now = new Date()) {
  const cutoff = new Date(now.getTime() - CHECKOUT_HOLD_MINUTES * 60_000);
  return db.transaction((tx) => cancelCheckouts(tx, lt(schema.orders.createdAt, cutoff), "Payment wasn't completed in time"));
}

/** A placed order: tell the order desk and take the bought items out of the customer's cart. */
async function announceOrder(tx: Tx, order: { id: string; seq: number; userId: string; paymentMethod: "cod" | "online" }, slugs: string[]) {
  const staff = await tx
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.role, "ecommerce_staff"), sql`${schema.users.disabledAt} is null`));
  await notify(
    tx,
    staff.map((u) => u.id),
    { kind: "order.placed", title: `New order ${orderNumber(order.seq)}`, body: `${order.paymentMethod === "cod" ? "Cash on delivery" : "Paid online"} · ${slugs.length} item${slugs.length === 1 ? "" : "s"}`, href: `/staff/orders/${order.id}` },
  );
  if (slugs.length) await tx.delete(schema.cartItems).where(and(eq(schema.cartItems.userId, order.userId), inArray(schema.cartItems.productSlug, slugs)));
}

/**
 * Turns the customer's cart into an order at today's prices and reserves the stock. Cash on
 * delivery is placed at once. An online checkout only holds the stock: it becomes an order (and the
 * cart is emptied) when Razorpay confirms the payment, and is released if that doesn't happen in
 * time. Throws OrderError with a message for the customer when something is no longer available.
 */
export async function placeOrder(userId: string, input: { addressId: string; paymentMethod: "cod" | "online"; note: string | null }) {
  await expireUnpaidCheckouts();
  const [catalogue, store] = await Promise.all([getCatalogue(), getSettings("store")]);
  if (input.paymentMethod === "cod" && !store.codEnabled) throw new OrderError("Cash on delivery isn't available right now. Choose online payment.");
  if (input.paymentMethod === "online" && !razorpayEnabled) throw new OrderError("Online payment isn't available right now.");
  const bySlug = new Map(catalogue.map((p) => [p.slug, p]));

  return db.transaction(async (tx) => {
    const [address] = await tx
      .select()
      .from(schema.addresses)
      .where(and(eq(schema.addresses.id, input.addressId), eq(schema.addresses.userId, userId)));
    if (!address) throw new OrderError("Choose a delivery address.");

    const cart = await tx.select().from(schema.cartItems).where(eq(schema.cartItems.userId, userId));
    if (!cart.length) throw new OrderError("Your cart is empty.");

    const lines = cart.map((l) => {
      const p = bySlug.get(l.productSlug);
      if (!p || !canBuy(p)) throw new OrderError(`${p?.name ?? "A product in your cart"} is no longer available. Remove it to continue.`);
      return { p, quantity: l.quantity };
    });
    // Cash on delivery is offered per product; one item without it means the order is paid online.
    const noCod = lines.find(({ p }) => !p.codAvailable);
    if (input.paymentMethod === "cod" && noCod) throw new OrderError(`${noCod.p.name} can't be paid for on delivery. Choose online payment.`);
    // Checking out again replaces any earlier unpaid checkout, and gives its stock back first.
    await cancelCheckouts(tx, eq(schema.orders.userId, userId), "Replaced by a newer checkout");

    // Reserve stock; the WHERE guards against two people buying the last unit at once.
    const moved: { productId: string; delta: number; stockAfter: number }[] = [];
    for (const { p, quantity } of lines) {
      const [ok] = await tx
        .update(schema.products)
        .set({ stock: sql`${schema.products.stock} - ${quantity}` })
        .where(and(eq(schema.products.slug, p.slug), gte(schema.products.stock, quantity)))
        .returning({ id: schema.products.id, stock: schema.products.stock });
      if (!ok) throw new OrderError(`Only ${p.stock} of ${p.name} left. Lower the quantity to continue.`);
      moved.push({ productId: ok.id, delta: -quantity, stockAfter: ok.stock });
    }

    const itemsTotal = lines.reduce((s, { p, quantity }) => s + p.pricePaise! * quantity, 0);
    const shipping = shippingFor(store);
    const snapshot: AddressSnapshot = {
      label: address.label,
      recipientName: address.recipientName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      landmark: address.landmark,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
    };
    const [order] = await tx
      .insert(schema.orders)
      .values({
        userId,
        paymentMethod: input.paymentMethod,
        shippingAddress: snapshot,
        customerNote: input.note,
        itemsTotalPaise: itemsTotal,
        shippingPaise: shipping,
        totalPaise: itemsTotal + shipping,
        placedAt: input.paymentMethod === "cod" ? new Date() : null,
      })
      .returning();
    await tx.insert(schema.orderItems).values(
      lines.map(({ p, quantity }) => ({
        orderId: order.id,
        productSlug: p.slug,
        productName: p.name,
        categoryLabel: getCategory(p.category).label,
        quantity,
        unitPricePaise: p.pricePaise!,
        gstRateBp: p.gstRateBp,
      })),
    );
    await logOrderMovements(tx, order.id, userId, moved, "order_placed");
    if (order.placedAt) await announceOrder(tx, order, lines.map(({ p }) => p.slug));
    return order;
  });
}

async function withDetails(orders: (typeof schema.orders.$inferSelect)[]) {
  if (!orders.length) return [];
  const ids = orders.map((o) => o.id);
  const [items, invoices] = await Promise.all([
    db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, ids)),
    db.select().from(schema.invoices).where(inArray(schema.invoices.orderId, ids)),
  ]);
  return orders.map((o) => ({
    ...o,
    items: items.filter((i) => i.orderId === o.id),
    invoice: invoices.find((i) => i.orderId === o.id) ?? null,
  }));
}
export type OrderWithDetails = Awaited<ReturnType<typeof withDetails>>[number];

/** The customer's placed orders. Unpaid online checkouts aren't orders, so they aren't listed. */
export async function listCustomerOrders(userId: string) {
  return withDetails(await db.select().from(schema.orders).where(and(eq(schema.orders.userId, userId), isPlaced)).orderBy(desc(schema.orders.createdAt)));
}

export async function getCustomerOrder(userId: string, orderId: string) {
  const [o] = await db.select().from(schema.orders).where(and(eq(schema.orders.id, orderId), eq(schema.orders.userId, userId)));
  return o ? (await withDetails([o]))[0] : null;
}

/* Staff side */

const customerCols = {
  id: schema.users.id,
  firstName: schema.users.firstName,
  lastName: schema.users.lastName,
  email: schema.users.email,
  phone: schema.users.phone,
  customerType: schema.users.customerType,
  companyName: schema.users.companyName,
  gstin: schema.users.gstin,
};

export type OrderFilter = OrderStatus | "unpaid";

export type OrderQuery = {
  /** Order number (JC-000012 or 12), customer name, email or phone. */
  q?: string;
  status?: OrderStatus;
  paymentMethod?: "cod" | "online";
  paymentStatus?: PaymentStatus;
  /** Placed on or after / before these dates (yyyy-mm-dd, shop time is IST). */
  from?: string;
  to?: string;
  sort?: "newest" | "oldest" | "updated" | "total_desc" | "total_asc";
  /** Only these orders (used by the dashboards). */
  ids?: string[];
  customerId?: string;
  page?: number;
  pageSize?: number;
};

const istDay = (d: string) => new Date(`${d}T00:00:00+05:30`);

function orderWhere(f: OrderQuery & { filter?: OrderFilter }) {
  const where: SQL[] = [isPlaced];
  if (f.filter === "unpaid") where.push(eq(schema.orders.paymentStatus, "pending"), notInArray(schema.orders.status, ["cancelled", "returned"]));
  else if (f.filter) where.push(eq(schema.orders.status, f.filter));
  if (f.status) where.push(eq(schema.orders.status, f.status));
  if (f.ids) where.push(inArray(schema.orders.id, f.ids));
  if (f.customerId) where.push(eq(schema.orders.userId, f.customerId));
  if (f.paymentMethod) where.push(eq(schema.orders.paymentMethod, f.paymentMethod));
  if (f.paymentStatus) where.push(eq(schema.orders.paymentStatus, f.paymentStatus));
  if (f.from) where.push(gte(schema.orders.createdAt, istDay(f.from)));
  if (f.to) where.push(lt(schema.orders.createdAt, new Date(istDay(f.to).getTime() + 86_400_000)));
  const q = f.q?.trim();
  if (q) {
    const seq = /^(jc-?)?0*(\d{1,9})$/i.exec(q);
    const like = `%${q}%`;
    where.push(
      or(
        seq ? eq(schema.orders.seq, Number(seq[2])) : undefined,
        ilike(schema.users.email, like),
        ilike(schema.users.phone, like),
        ilike(schema.users.companyName, like),
        ilike(sql`${schema.users.firstName} || ' ' || ${schema.users.lastName}`, like),
      )!,
    );
  }
  return and(...where);
}

const orderSort = {
  newest: [desc(schema.orders.createdAt)],
  oldest: [asc(schema.orders.createdAt)],
  updated: [desc(schema.orders.updatedAt)],
  total_desc: [desc(schema.orders.totalPaise), desc(schema.orders.createdAt)],
  total_asc: [asc(schema.orders.totalPaise), desc(schema.orders.createdAt)],
};

/** Orders for staff, filtered, sorted and paged in the database. */
export async function searchOrders(f: OrderQuery & { filter?: OrderFilter } = {}) {
  const pageSize = Math.min(f.pageSize ?? 25, 100);
  const page = Math.max(1, f.page ?? 1);
  const where = orderWhere(f);
  const [rows, [{ n }]] = await Promise.all([
    db
      .select({ order: schema.orders, customer: customerCols })
      .from(schema.orders)
      .innerJoin(schema.users, eq(schema.users.id, schema.orders.userId))
      .where(where)
      .orderBy(...orderSort[f.sort ?? "newest"])
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(schema.orders).innerJoin(schema.users, eq(schema.users.id, schema.orders.userId)).where(where),
  ]);
  const detailed = await withDetails(rows.map((r) => r.order));
  return { rows: detailed.map((o, i) => ({ ...o, customer: rows[i].customer })), total: n, page, pageSize };
}

export async function listOrders({ filter, limit = 100 }: { filter?: OrderFilter; limit?: number } = {}) {
  return (await searchOrders({ filter, pageSize: limit })).rows;
}
export type StaffOrder = Awaited<ReturnType<typeof listOrders>>[number];

export async function getOrder(orderId: string) {
  const [row] = await db
    .select({ order: schema.orders, customer: customerCols })
    .from(schema.orders)
    .innerJoin(schema.users, eq(schema.users.id, schema.orders.userId))
    .where(eq(schema.orders.id, orderId));
  if (!row) return null;
  const [payments, shipments] = await Promise.all([
    db
      .select({ p: schema.payments, byFirst: schema.users.firstName, byLast: schema.users.lastName })
      .from(schema.payments)
      .leftJoin(schema.users, eq(schema.users.id, schema.payments.recordedById))
      .where(eq(schema.payments.orderId, orderId))
      .orderBy(asc(schema.payments.createdAt)),
    shipmentsForOrders([orderId]),
  ]);
  return {
    ...(await withDetails([row.order]))[0],
    customer: row.customer,
    payments: payments.map((p) => ({ ...p.p, by: p.byFirst ? `${p.byFirst} ${p.byLast ?? ""}`.trim() : null })),
    shipments,
  };
}

export async function orderStats() {
  const [byStatus, [unpaid], [customers], [revenue], [lowStock]] = await Promise.all([
    db.select({ status: schema.orders.status, n: count() }).from(schema.orders).where(isPlaced).groupBy(schema.orders.status),
    db
      .select({ n: count() })
      .from(schema.orders)
      .where(and(isPlaced, eq(schema.orders.paymentStatus, "pending"), notInArray(schema.orders.status, ["cancelled", "returned"]))),
    db.select({ n: count() }).from(schema.users).where(eq(schema.users.role, "customer")),
    db
      .select({ total: sql<number>`coalesce(sum(${schema.orders.totalPaise}), 0)::int`, n: count() })
      .from(schema.orders)
      .where(and(eq(schema.orders.paymentStatus, "paid"), sql`${schema.orders.paidAt} >= date_trunc('month', now())`)),
    db
      .select({ n: count() })
      .from(schema.products)
      .where(sql`${schema.products.isActive} and ${schema.products.archivedAt} is null and ${schema.products.pricePaise} is not null and ${schema.products.stock} <= ${schema.products.lowStockThreshold}`),
  ]);
  const status = Object.fromEntries(byStatus.map((s) => [s.status, s.n])) as Partial<Record<OrderStatus, number>>;
  return { status, unpaid: unpaid.n, customers: customers.n, paidThisMonthPaise: revenue.total, paidOrdersThisMonth: revenue.n, lowStock: lowStock.n };
}

export async function listCustomers() {
  return db
    .select({
      ...customerCols,
      createdAt: schema.users.createdAt,
      emailVerifiedAt: schema.users.emailVerifiedAt,
      orders: sql<number>`(select count(*)::int from ${schema.orders} where ${schema.orders.userId} = ${schema.users.id} and ${isPlaced})`,
    })
    .from(schema.users)
    .where(eq(schema.users.role, "customer"))
    .orderBy(desc(schema.users.createdAt))
    .limit(200);
}

/** Splits a GST-inclusive amount into taxable value and tax. */
export function splitGst(amountPaise: number, rateBp: number) {
  const taxable = Math.round((amountPaise * 10_000) / (10_000 + rateBp));
  return { taxable, gst: amountPaise - taxable };
}

/**
 * Records payment and issues the invoice in one step: the order becomes paid, a payment record is
 * written and an invoice with GST split out is frozen. Sending the PDF is the caller's job.
 *
 * This is the only way an order becomes paid. Cash on delivery is recorded by staff once the
 * courier has collected it (provider "manual"); online orders only by the Razorpay flow after the
 * payment is verified with Razorpay (provider "razorpay", reference = the pay_… id, no staff).
 */
export async function recordPayment(orderId: string, reference: string, staffId: string | null, { provider = "manual" }: { provider?: "manual" | "razorpay" } = {}) {
  const shop = await getSettings("shop");
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).for("update");
    if (!order) throw new OrderError("Order not found.");
    if (order.status === "cancelled") throw new OrderError("This order is cancelled.");
    if (order.paymentStatus !== "pending") throw new OrderError("Payment is already recorded for this order.");
    if (provider === "manual") {
      if (order.paymentMethod === "online") throw new OrderError("Online payments are recorded automatically once Razorpay confirms them.");
      if (!canRecordPayment(order)) throw new OrderError("Cash on delivery is collected by the courier: record it once the order has been dispatched.");
    } else {
      if (order.paymentMethod !== "online") throw new OrderError("This order is paid on delivery.");
      if (order.status === "returned") throw new OrderError("This order was returned.");
      if (!reference.trim()) throw new OrderError("Missing the Razorpay payment id.");
    }

    const [customer] = await tx.select().from(schema.users).where(eq(schema.users.id, order.userId));
    const items = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
    const lines: InvoiceLine[] = items.map((i) => {
      const amount = i.unitPricePaise * i.quantity;
      const { taxable, gst } = splitGst(amount, i.gstRateBp);
      return {
        name: i.productName,
        category: i.categoryLabel,
        quantity: i.quantity,
        unitPricePaise: i.unitPricePaise,
        gstRateBp: i.gstRateBp,
        taxablePaise: taxable,
        gstPaise: gst,
        amountPaise: amount,
      };
    });

    const now = new Date();
    // A verified online payment is what places the checkout as an order and confirms it.
    const placing = !order.placedAt;
    const autoConfirm = provider === "razorpay" && order.status === "placed";
    await tx
      .update(schema.orders)
      .set({ paymentStatus: "paid", paidAt: now, paymentReference: reference || null, ...(placing ? { placedAt: now } : {}), ...(autoConfirm ? { status: "confirmed" as const } : {}) })
      .where(eq(schema.orders.id, orderId));
    await tx.insert(schema.payments).values({
      orderId,
      kind: "payment",
      method: order.paymentMethod,
      amountPaise: order.totalPaise,
      provider,
      reference: reference || null,
      recordedById: staffId,
      createdAt: now,
    });
    const [invoice] = await tx
      .insert(schema.invoices)
      .values({
        orderId,
        lines,
        taxablePaise: lines.reduce((s, l) => s + l.taxablePaise, 0),
        gstPaise: lines.reduce((s, l) => s + l.gstPaise, 0),
        intraState: Boolean(shop.state) && shop.state === order.shippingAddress.state,
        shippingPaise: order.shippingPaise,
        totalPaise: order.totalPaise,
        billedTo: {
          name: `${customer.firstName} ${customer.lastName}`.trim(),
          email: customer.email,
          companyName: customer.customerType === "business" ? customer.companyName : null,
          gstin: customer.customerType === "business" ? customer.gstin : null,
        },
        sentTo: customer.email,
        sentById: staffId,
        sentAt: now,
      })
      .returning();
    await audit(tx, {
      actorId: staffId,
      action: "order.payment",
      entityType: "order",
      entityId: orderId,
      summary: `Recorded ${order.paymentMethod === "cod" ? "cash on delivery" : "online"} payment for ${orderNumber(order.seq)}${reference ? ` (ref ${reference})` : ""}`,
      details: { amountPaise: order.totalPaise, provider },
    });
    if (autoConfirm) {
      await audit(tx, {
        actorId: null,
        action: "order.status",
        entityType: "order",
        entityId: orderId,
        summary: placing ? `${orderNumber(order.seq)}: placed and confirmed (payment received)` : `${orderNumber(order.seq)}: placed → confirmed (payment received)`,
      });
    }
    if (placing) await announceOrder(tx, order, items.map((i) => i.productSlug));
    return invoice;
  });
}

/**
 * Records that the money for a cancelled, paid cash-on-delivery order has been handed back. Razorpay
 * payments are refunded through Razorpay instead (approveRefund in payments.ts).
 */
export async function recordRefund(orderId: string, reference: string, staffId: string) {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).for("update");
    if (!order) throw new OrderError("Order not found.");
    if (order.paymentStatus !== "refund_pending") throw new OrderError("There's no refund due on this order.");
    if (!reference.trim()) throw new OrderError("Enter the refund's UPI or bank transaction ID, or how the cash was returned.");
    const [gateway] = await tx
      .select({ id: schema.payments.id })
      .from(schema.payments)
      .where(and(eq(schema.payments.orderId, orderId), eq(schema.payments.provider, "razorpay")));
    if (gateway) throw new OrderError("This order was paid through Razorpay, so the refund goes back through Razorpay.");
    const [{ paid }] = await tx
      // A refund that failed never left the shop, so it doesn't reduce what's owed back.
      .select({
        paid: sql<number>`coalesce(sum(case
          when ${schema.payments.kind} = 'payment' and ${schema.payments.status} = 'succeeded' then ${schema.payments.amountPaise}
          when ${schema.payments.kind} = 'refund' and ${schema.payments.status} in ('succeeded', 'pending') then -${schema.payments.amountPaise}
          else 0 end), 0)::int`,
      })
      .from(schema.payments)
      .where(eq(schema.payments.orderId, orderId));
    if (paid <= 0) throw new OrderError("No payment is recorded on this order, so there's nothing to refund.");
    await tx.insert(schema.payments).values({ orderId, kind: "refund", method: order.paymentMethod, amountPaise: paid, reference: reference.trim(), recordedById: staffId });
    await tx.update(schema.orders).set({ paymentStatus: "refunded" }).where(eq(schema.orders.id, orderId));
    await audit(tx, {
      actorId: staffId,
      action: "order.refund",
      entityType: "order",
      entityId: orderId,
      summary: `Recorded refund for ${orderNumber(order.seq)} (ref ${reference.trim()})`,
      details: { amountPaise: paid },
    });
    return paid;
  });
}

const flow: Record<OrderStatus, OrderStatus[]> = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  // Set by recording a "returned" shipment update, not by hand.
  returned: [],
  cancelled: [],
};

/**
 * Next fulfilment steps. An online order is confirmed only by its verified payment (recordPayment
 * does it automatically), so until then it can only be cancelled. Cash on delivery is paid after
 * dispatch, so staff confirm those by hand.
 */
export function allowedNext(order: { status: OrderStatus; paymentMethod: "cod" | "online"; paymentStatus: PaymentStatus }) {
  return flow[order.status].filter((s) => s === "cancelled" || order.paymentMethod === "cod" || order.paymentStatus === "paid");
}

/** Cash on delivery is collected by the courier, so it can only be recorded once the parcel has gone out. */
/** Staff can record a payment only for cash on delivery, once dispatched (online payments come from Razorpay). */
export function canRecordPayment(order: { status: OrderStatus; paymentMethod: "cod" | "online"; paymentStatus: PaymentStatus }) {
  if (order.paymentStatus !== "pending" || order.paymentMethod !== "cod") return false;
  return order.status === "shipped" || order.status === "delivered";
}

type StatusExtras = { shipment?: DispatchInput; cancelReason?: string };

export async function updateOrderStatus(orderId: string, to: OrderStatus, actorId: string, extras: StatusExtras = {}) {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).for("update");
    if (!order) throw new OrderError("Order not found.");
    if (!order.placedAt && order.paymentStatus === "pending") throw new OrderError("This checkout hasn't been paid, so it isn't an order yet.");
    if (!allowedNext(order).includes(to)) {
      throw new OrderError(
        order.paymentMethod === "online" && order.paymentStatus === "pending" && to !== "cancelled"
          ? "This order is confirmed automatically once its online payment comes through Razorpay."
          : `An order that is "${order.status}" can't move to "${to}".`,
      );
    }

    if (to === "shipped") {
      if (!extras.shipment) throw new OrderError("Enter the courier and tracking number.");
      await createShipmentTx(tx, orderId, extras.shipment, actorId);
    }
    if (to === "delivered") await deliverShipmentsTx(tx, orderId, actorId);
    if (to === "cancelled") {
      if (!extras.cancelReason?.trim()) throw new OrderError("Say why the order is being cancelled.");
      await releaseStock(tx, orderId, actorId);
    }

    await tx
      .update(schema.orders)
      .set({
        status: to,
        ...(to === "cancelled" ? { cancelledAt: new Date(), cancelReason: extras.cancelReason!.trim().slice(0, 300) } : {}),
        // Money already received has to go back; recordRefund closes it.
        ...(to === "cancelled" && order.paymentStatus === "paid" ? { paymentStatus: "refund_pending" as const } : {}),
      })
      .where(eq(schema.orders.id, orderId));
    if (to === "cancelled" && order.paymentStatus === "paid") {
      await notifyAdmins(tx, { kind: "order.refund_due", title: `Refund due on ${orderNumber(order.seq)}`, body: extras.cancelReason?.trim() ?? "", href: `/admin/orders/${orderId}` });
    }
    await audit(tx, {
      actorId,
      action: "order.status",
      entityType: "order",
      entityId: orderId,
      summary: `${orderNumber(order.seq)}: ${order.status} → ${to}${to === "cancelled" ? ` (${extras.cancelReason!.trim()})` : ""}`,
    });
  });
}

/* Internal notes and timeline */

export async function addOrderNote(orderId: string, authorId: string, body: string) {
  const text = body.trim();
  if (!text) throw new OrderError("Write the note first.");
  if (text.length > 1000) throw new OrderError("Keep notes under 1,000 characters.");
  await db.transaction(async (tx) => {
    const [order] = await tx.select({ id: schema.orders.id }).from(schema.orders).where(eq(schema.orders.id, orderId));
    if (!order) throw new OrderError("Order not found.");
    await tx.insert(schema.orderNotes).values({ orderId, authorId, body: text });
  });
}

/**
 * Everything that happened to an order, oldest first: placement, the audited staff actions
 * (status, payment, refund, shipment updates) and internal notes.
 */
export async function orderTimeline(orderId: string) {
  const [order] = await db.select({ createdAt: schema.orders.createdAt, placedAt: schema.orders.placedAt }).from(schema.orders).where(eq(schema.orders.id, orderId));
  if (!order) return [];
  const [logs, notes] = await Promise.all([
    db
      .select({ log: schema.auditLogs, first: schema.users.firstName, last: schema.users.lastName })
      .from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.users.id, schema.auditLogs.actorId))
      .where(and(eq(schema.auditLogs.entityType, "order"), eq(schema.auditLogs.entityId, orderId))),
    db
      .select({ note: schema.orderNotes, first: schema.users.firstName, last: schema.users.lastName })
      .from(schema.orderNotes)
      .leftJoin(schema.users, eq(schema.users.id, schema.orderNotes.authorId))
      .where(eq(schema.orderNotes.orderId, orderId)),
  ]);
  const name = (f: string | null, l: string | null) => (f ? `${f} ${l ?? ""}`.trim() : null);
  return [
    { id: "placed", kind: "placed" as const, text: "Order placed by the customer", by: null, at: order.placedAt ?? order.createdAt },
    ...logs.map((r) => ({ id: r.log.id, kind: "action" as const, text: r.log.summary, by: name(r.first, r.last), at: r.log.createdAt })),
    ...notes.map((r) => ({ id: r.note.id, kind: "note" as const, text: r.note.body, by: name(r.first, r.last), at: r.note.createdAt })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
}
export type TimelineEntry = Awaited<ReturnType<typeof orderTimeline>>[number];
