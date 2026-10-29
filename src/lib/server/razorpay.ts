import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Minimal Razorpay REST client (https://razorpay.com/docs/api/). Server-only: the key secret never
 * reaches the browser. Amounts are in paise, as Razorpay expects.
 */

const API = "https://api.razorpay.com/v1";

export class GatewayError extends Error {}

export type RzpOrder = { id: string; amount: number; currency: string; receipt: string | null; status: "created" | "attempted" | "paid" };
export type RzpPayment = {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  error_description?: string | null;
};
export type RzpRefund = { id: string; payment_id: string; amount: number; status: "pending" | "processed" | "failed" };

function keys() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) throw new GatewayError("Online payment isn't set up yet.");
  return { id: env.RAZORPAY_KEY_ID, secret: env.RAZORPAY_KEY_SECRET };
}

export const publicKeyId = () => keys().id;

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const { id, secret } = keys();
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error("[razorpay] request failed", method, path, err);
    throw new GatewayError("Couldn't reach Razorpay. Please try again.");
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: { description?: string } }) | null;
  if (!res.ok || !data) {
    console.error("[razorpay]", method, path, res.status, data?.error);
    throw new GatewayError(data?.error?.description ?? `Razorpay returned an error (${res.status}).`);
  }
  return data;
}

export const createGatewayOrder = (input: { amount: number; receipt: string; notes: Record<string, string> }) =>
  call<RzpOrder>("POST", "/orders", { amount: input.amount, currency: "INR", receipt: input.receipt, notes: input.notes });

export const fetchPayment = (paymentId: string) => call<RzpPayment>("GET", `/payments/${encodeURIComponent(paymentId)}`);

export const fetchOrderPayments = (gatewayOrderId: string) => call<{ items: RzpPayment[] }>("GET", `/orders/${encodeURIComponent(gatewayOrderId)}/payments`).then((r) => r.items);

/** Only needed if the account isn't set to capture payments automatically. */
export const capturePayment = (paymentId: string, amount: number) => call<RzpPayment>("POST", `/payments/${encodeURIComponent(paymentId)}/capture`, { amount, currency: "INR" });

export const createRefund = (paymentId: string, amount: number, notes: Record<string, string>) =>
  call<RzpRefund>("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, { amount, notes });

export const fetchRefund = (paymentId: string, refundId: string) => call<RzpRefund>("GET", `/payments/${encodeURIComponent(paymentId)}/refunds/${encodeURIComponent(refundId)}`);

function sameHex(expected: string, given: string) {
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(given, "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** The signature Razorpay Checkout returns: HMAC-SHA256 of "order_id|payment_id" with the key secret. */
export function checkoutSignatureValid(gatewayOrderId: string, paymentId: string, signature: string) {
  return sameHex(createHmac("sha256", keys().secret).update(`${gatewayOrderId}|${paymentId}`).digest("hex"), signature);
}

/** Webhook bodies are signed with the webhook secret (X-Razorpay-Signature). */
export function webhookSignatureValid(rawBody: string, signature: string) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
  return sameHex(createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex"), signature);
}
