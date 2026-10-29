import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { orderNumber } from "@/lib/money";
import { audit, isUniqueViolation } from "./admin/tx";
import { db, schema } from "./db";
import { razorpayEnabled } from "./env";
import { notifyAdmins } from "./notifications";
import { OrderError, recordPayment } from "./orders";
import {
  capturePayment,
  checkoutSignatureValid,
  createGatewayOrder,
  createRefund,
  fetchOrderPayments,
  fetchPayment,
  fetchRefund,
  GatewayError,
  publicKeyId,
  type RzpPayment,
  type RzpRefund,
} from "./razorpay";

/**
 * Online payments through Razorpay.
 *
 * An order is marked paid only after the server has asked Razorpay for the payment and seen it
 * captured for this order's Razorpay order and exact amount. The browser's "success" callback and
 * the webhook both just ask for that check, so either can arrive first, twice, or not at all.
 */

export type CheckoutSession = { keyId: string; gatewayOrderId: string; amount: number; currency: "INR"; orderNumber: string; prefill: { name: string; email: string; contact: string } };

/** Creates (or reuses) the Razorpay order the customer pays against. Only the order's own customer can start it. */
export async function startOnlinePayment(customerId: string, orderId: string): Promise<CheckoutSession> {
  if (!razorpayEnabled) throw new OrderError("Online payment isn't available right now.");
  const [row] = await db
    .select({ order: schema.orders, user: schema.users })
    .from(schema.orders)
    .innerJoin(schema.users, eq(schema.users.id, schema.orders.userId))
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.userId, customerId)));
  if (!row) throw new OrderError("Order not found.");
  const { order, user } = row;
  if (order.paymentMethod !== "online") throw new OrderError("This order is paid on delivery.");
  if (order.paymentStatus !== "pending") throw new OrderError("This order is already paid.");
  if (order.status === "cancelled" || order.status === "returned") throw new OrderError("This order is cancelled, so it can't be paid.");
  // Razorpay's minimum charge is ₹1.
  if (order.totalPaise < 100) throw new OrderError("Orders under ₹1 can't be paid online.");

  let gatewayOrderId = order.gatewayOrderId;
  if (!gatewayOrderId) {
    const created = await createGatewayOrder({ amount: order.totalPaise, receipt: orderNumber(order.seq), notes: { orderId: order.id, orderNumber: orderNumber(order.seq) } });
    // Two tabs racing: keep whichever Razorpay order was saved first.
    const [saved] = await db
      .update(schema.orders)
      .set({ gatewayOrderId: created.id })
      .where(and(eq(schema.orders.id, order.id), sql`${schema.orders.gatewayOrderId} is null`))
      .returning({ id: schema.orders.gatewayOrderId });
    gatewayOrderId = saved?.id ?? (await db.select({ id: schema.orders.gatewayOrderId }).from(schema.orders).where(eq(schema.orders.id, order.id)))[0].id!;
  }
  return {
    keyId: publicKeyId(),
    gatewayOrderId,
    amount: order.totalPaise,
    currency: "INR",
    orderNumber: orderNumber(order.seq),
    prefill: { name: `${user.firstName} ${user.lastName}`.trim(), email: user.email, contact: user.phone?.replace(/\D/g, "").slice(-10) ?? "" },
  };
}

export type ConfirmResult = { status: "paid" | "already_paid" | "pending" | "failed" | "ignored"; orderId: string | null; message: string };

/**
 * Checks one Razorpay payment and, if it's captured for this order, records it (and issues the
 * invoice). `signature` is the Checkout callback's; the webhook passes null because it verified
 * its own signature. Safe to call repeatedly.
 */
export async function confirmOnlinePayment(input: { gatewayOrderId: string; paymentId: string; signature: string | null }): Promise<ConfirmResult> {
  if (input.signature !== null && !checkoutSignatureValid(input.gatewayOrderId, input.paymentId, input.signature)) {
    return { status: "failed", orderId: null, message: "We couldn't verify this payment. If money was taken, it will be checked with Razorpay." };
  }
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.gatewayOrderId, input.gatewayOrderId));
  if (!order) return { status: "ignored", orderId: null, message: "No order uses this Razorpay order." };

  let payment: RzpPayment = await fetchPayment(input.paymentId);
  if (payment.order_id !== input.gatewayOrderId) return { status: "failed", orderId: order.id, message: "This payment belongs to a different order." };
  if (payment.currency !== "INR" || payment.amount !== order.totalPaise) {
    await notifyAdmins(db, {
      kind: "payment.mismatch",
      title: `Payment amount mismatch on ${orderNumber(order.seq)}`,
      body: `Razorpay payment ${payment.id} is ${payment.currency} ${payment.amount / 100}, the order total is ₹${order.totalPaise / 100}. Not marked paid.`,
      href: `/admin/orders/${order.id}`,
    });
    return { status: "failed", orderId: order.id, message: "The payment amount doesn't match the order. The shop has been told." };
  }
  if (payment.status === "authorized") payment = await capturePayment(payment.id, payment.amount);
  if (payment.status === "failed") return { status: "failed", orderId: order.id, message: payment.error_description || "The payment failed. You can try again." };
  if (payment.status !== "captured") return { status: "pending", orderId: order.id, message: "Razorpay hasn't confirmed the payment yet. We'll update the order as soon as it does." };

  // Captured. Record it unless it's already on the order.
  const [known] = await db
    .select({ id: schema.payments.id })
    .from(schema.payments)
    .where(and(eq(schema.payments.provider, "razorpay"), eq(schema.payments.kind, "payment"), eq(schema.payments.reference, payment.id)));
  if (known) return { status: "already_paid", orderId: order.id, message: "Payment received." };

  if (order.paymentStatus !== "pending" || order.status === "cancelled" || order.status === "returned") {
    // Money arrived for an order that's already paid or no longer wanted: keep the record so it's refunded.
    try {
      await db.transaction(async (tx) => {
        await tx.insert(schema.payments).values({ orderId: order.id, kind: "payment", method: "online", amountPaise: payment.amount, provider: "razorpay", reference: payment.id, note: "Received after the order was paid or cancelled" });
        await tx.update(schema.orders).set({ paymentStatus: "refund_pending" }).where(eq(schema.orders.id, order.id));
        await audit(tx, { actorId: null, action: "order.payment", entityType: "order", entityId: order.id, summary: `Extra Razorpay payment ${payment.id} received on ${orderNumber(order.seq)}; refund due` });
      });
    } catch (err) {
      // The same payment confirmed twice at once: it's the order's own payment, already recorded.
      if (isUniqueViolation(err, "payments_gateway_reference_key")) return { status: "already_paid", orderId: order.id, message: "Payment received." };
      throw err;
    }
    await notifyAdmins(db, { kind: "order.refund_due", title: `Refund due on ${orderNumber(order.seq)}`, body: `Razorpay payment ${payment.id} arrived after the order was paid or cancelled.`, href: `/admin/orders/${order.id}` });
    return { status: "already_paid", orderId: order.id, message: "This order was already paid or cancelled; the shop will refund this payment." };
  }

  try {
    await recordPayment(order.id, payment.id, null, { provider: "razorpay" });
  } catch (err) {
    // A webhook and the browser confirming at the same moment: the other one recorded it.
    if (err instanceof OrderError && /already recorded/.test(err.message)) return { status: "already_paid", orderId: order.id, message: "Payment received." };
    if (isUniqueViolation(err, "payments_gateway_reference_key")) return { status: "already_paid", orderId: order.id, message: "Payment received." };
    throw err;
  }
  return { status: "paid", orderId: order.id, message: "Payment received." };
}

/** Asks Razorpay about every payment on the order's Razorpay order (for when the callback and webhook were both missed). */
export async function syncOnlinePayment(orderId: string): Promise<ConfirmResult> {
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
  if (!order) throw new OrderError("Order not found.");
  if (!order.gatewayOrderId) return { status: "pending", orderId, message: "The customer hasn't started paying yet." };
  const payments = await fetchOrderPayments(order.gatewayOrderId);
  const captured = payments.find((p) => p.status === "captured" || p.status === "authorized");
  if (!captured) return { status: "pending", orderId, message: payments.length ? "Razorpay shows only failed or unfinished attempts." : "Razorpay has no payment for this order yet." };
  return confirmOnlinePayment({ gatewayOrderId: order.gatewayOrderId, paymentId: captured.id, signature: null });
}

/* Refunds: only when an admin approves. */

const netPaid = sql<number>`coalesce(sum(case
  when ${schema.payments.kind} = 'payment' and ${schema.payments.status} = 'succeeded' then ${schema.payments.amountPaise}
  when ${schema.payments.kind} = 'refund' and ${schema.payments.status} in ('succeeded', 'pending') then -${schema.payments.amountPaise}
  else 0 end), 0)::int`;

/**
 * Admin-approved refund of a Razorpay payment. A "pending" refund row is claimed first (so a second
 * click can't refund twice), then Razorpay is asked to refund; the order shows refunded only once
 * Razorpay reports the refund processed (here, or later by webhook or "Check refund status").
 */
export async function approveGatewayRefund(adminId: string, orderId: string) {
  const claim = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).for("update");
    if (!order) throw new OrderError("Order not found.");
    if (order.paymentStatus !== "refund_pending") throw new OrderError("There's no refund due on this order.");
    const [inFlight] = await tx
      .select({ id: schema.payments.id })
      .from(schema.payments)
      .where(and(eq(schema.payments.orderId, orderId), eq(schema.payments.kind, "refund"), eq(schema.payments.status, "pending")));
    if (inFlight) throw new OrderError("A refund is already being processed for this order.");
    const [paid] = await tx
      .select({ id: schema.payments.id, reference: schema.payments.reference, amount: schema.payments.amountPaise })
      .from(schema.payments)
      .where(and(eq(schema.payments.orderId, orderId), eq(schema.payments.kind, "payment"), eq(schema.payments.provider, "razorpay"), eq(schema.payments.status, "succeeded")))
      .orderBy(sql`${schema.payments.createdAt} desc`)
      .limit(1);
    if (!paid?.reference) throw new OrderError("This order has no Razorpay payment to refund. Record the cash refund instead.");
    const [{ net }] = await tx.select({ net: netPaid }).from(schema.payments).where(eq(schema.payments.orderId, orderId));
    const amount = Math.min(net, paid.amount);
    if (amount <= 0) throw new OrderError("Nothing is left to refund on this order.");
    const [row] = await tx
      .insert(schema.payments)
      .values({ orderId, kind: "refund", method: "online", amountPaise: amount, provider: "razorpay", status: "pending", recordedById: adminId, note: "Approved by admin; waiting for Razorpay" })
      .returning({ id: schema.payments.id });
    return { rowId: row.id, paymentId: paid.reference, amount, seq: order.seq };
  });

  let refund: RzpRefund;
  try {
    refund = await createRefund(claim.paymentId, claim.amount, { orderId, orderNumber: orderNumber(claim.seq) });
  } catch (err) {
    await db.update(schema.payments).set({ status: "failed", note: `Razorpay refused the refund: ${(err as Error).message}` }).where(eq(schema.payments.id, claim.rowId));
    throw err instanceof GatewayError ? new OrderError(`Razorpay couldn't start the refund: ${err.message}`) : err;
  }
  await db.transaction(async (tx) => {
    await tx.update(schema.payments).set({ reference: refund.id, note: null }).where(eq(schema.payments.id, claim.rowId));
    await audit(tx, { actorId: adminId, action: "order.refund", entityType: "order", entityId: orderId, summary: `Approved refund of ₹${claim.amount / 100} for ${orderNumber(claim.seq)} through Razorpay (${refund.id})` });
  });
  await applyRefundStatus(refund);
  return { refundId: refund.id, amount: claim.amount, status: refund.status };
}

/** Brings a refund row (and the order) in line with what Razorpay says about the refund. */
export async function applyRefundStatus(refund: Pick<RzpRefund, "id" | "status">) {
  if (refund.status === "pending") return;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(schema.payments)
      .where(and(eq(schema.payments.provider, "razorpay"), eq(schema.payments.kind, "refund"), eq(schema.payments.reference, refund.id)))
      .for("update");
    if (!row || row.status !== "pending") return;
    await tx.update(schema.payments).set({ status: refund.status === "processed" ? "succeeded" : "failed" }).where(eq(schema.payments.id, row.id));
    if (refund.status === "processed") {
      const [{ net }] = await tx.select({ net: netPaid }).from(schema.payments).where(eq(schema.payments.orderId, row.orderId));
      if (net <= 0) await tx.update(schema.orders).set({ paymentStatus: "refunded" }).where(eq(schema.orders.id, row.orderId));
    }
  });
  if (refund.status === "failed") {
    const [order] = await db.select({ seq: schema.orders.seq, id: schema.orders.id }).from(schema.orders).innerJoin(schema.payments, eq(schema.payments.orderId, schema.orders.id)).where(eq(schema.payments.reference, refund.id));
    if (order) await notifyAdmins(db, { kind: "order.refund_failed", title: `Refund failed on ${orderNumber(order.seq)}`, body: `Razorpay refund ${refund.id} failed. Approve it again or refund another way.`, href: `/admin/orders/${order.id}` });
  }
}

/** Asks Razorpay for the latest state of the order's pending refunds. */
export async function syncRefunds(orderId: string) {
  const pending = await db
    .select({ refundId: schema.payments.reference })
    .from(schema.payments)
    .where(and(eq(schema.payments.orderId, orderId), eq(schema.payments.provider, "razorpay"), eq(schema.payments.kind, "refund"), eq(schema.payments.status, "pending")));
  const paid = await db
    .select({ id: schema.payments.reference })
    .from(schema.payments)
    .where(and(eq(schema.payments.orderId, orderId), eq(schema.payments.provider, "razorpay"), eq(schema.payments.kind, "payment")));
  for (const r of pending) {
    if (!r.refundId) continue;
    for (const p of paid) {
      if (!p.id) continue;
      const refund = await fetchRefund(p.id, r.refundId).catch(() => null);
      if (refund) {
        await applyRefundStatus(refund);
        break;
      }
    }
  }
  return pending.length;
}

