"use server";

import { refresh } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireCustomer } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { OrderError } from "@/lib/server/orders";
import { afterConfirm } from "@/lib/server/payment-events";
import { confirmOnlinePayment, startOnlinePayment, type CheckoutSession, type ConfirmResult } from "@/lib/server/payments";
import { GatewayError } from "@/lib/server/razorpay";

export type StartResult = { ok: true; session: CheckoutSession } | { ok: false; error: string };

/** Opens Razorpay Checkout for one of the customer's own unpaid online orders. */
export async function startPaymentAction(orderId: string): Promise<StartResult> {
  const me = await requireCustomer();
  try {
    return { ok: true, session: await startOnlinePayment(me.id, z.string().uuid().parse(orderId)) };
  } catch (err) {
    if (err instanceof OrderError || err instanceof GatewayError) return { ok: false, error: err.message };
    throw err;
  }
}

const callback = z.object({ razorpay_order_id: z.string().min(1).max(64), razorpay_payment_id: z.string().min(1).max(64), razorpay_signature: z.string().min(1).max(256) });

/**
 * Checkout's success callback. The signature is checked and the payment confirmed with Razorpay
 * on the server; what the browser says about success isn't trusted on its own.
 */
export async function confirmPaymentAction(orderId: string, input: z.input<typeof callback>): Promise<ConfirmResult> {
  const me = await requireCustomer();
  const v = callback.parse(input);
  const id = z.string().uuid().parse(orderId);
  // Only the customer's own order, and only the Razorpay order created for it.
  const [order] = await db
    .select({ gatewayOrderId: schema.orders.gatewayOrderId })
    .from(schema.orders)
    .where(and(eq(schema.orders.id, id), eq(schema.orders.userId, me.id)));
  if (!order || order.gatewayOrderId !== v.razorpay_order_id) return { status: "failed", orderId: null, message: "This payment doesn't match your order." };
  let result: ConfirmResult;
  try {
    result = await confirmOnlinePayment({ gatewayOrderId: v.razorpay_order_id, paymentId: v.razorpay_payment_id, signature: v.razorpay_signature });
  } catch (err) {
    if (err instanceof GatewayError) return { status: "pending", orderId, message: "We couldn't reach Razorpay to confirm the payment. If money was taken, the order updates automatically." };
    throw err;
  }
  await afterConfirm(result);
  refresh();
  return result;
}
