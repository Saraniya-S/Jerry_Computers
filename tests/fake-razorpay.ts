import { createHmac } from "node:crypto";
import { vi } from "vitest";

/**
 * An in-memory stand-in for Razorpay's REST API, installed as global fetch. Tests drive it the way
 * Checkout would (payments created against an order, captured or failed) and then let the app
 * verify them through the same API calls it makes in production.
 */
type Payment = { id: string; order_id: string; amount: number; currency: string; status: "authorized" | "captured" | "failed"; error_description?: string };
type Refund = { id: string; payment_id: string; amount: number; status: "pending" | "processed" | "failed" };

export function installFakeRazorpay() {
  const orders = new Map<string, { id: string; amount: number; currency: string; receipt: string; status: string }>();
  const payments = new Map<string, Payment>();
  const refunds = new Map<string, Refund>();
  let n = 0;
  const next = (p: string) => `${p}_${(++n).toString().padStart(6, "0")}`;
  const state = { refundStatus: "processed" as Refund["status"], failRefund: false, calls: [] as string[] };

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/v1/, "");
    const method = init?.method ?? "GET";
    state.calls.push(`${method} ${path}`);
    if (!String((init?.headers as Record<string, string>)?.authorization ?? "").startsWith("Basic ")) return json({ error: { description: "auth" } }, 401);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    let m: RegExpMatchArray | null;
    if (method === "POST" && path === "/orders") {
      const o = { id: next("order"), amount: body.amount, currency: body.currency, receipt: body.receipt, status: "created" };
      orders.set(o.id, o);
      return json(o);
    }
    if (method === "GET" && (m = path.match(/^\/orders\/([^/]+)\/payments$/))) return json({ items: [...payments.values()].filter((p) => p.order_id === m![1]) });
    if (method === "GET" && (m = path.match(/^\/payments\/([^/]+)$/))) return payments.has(m[1]) ? json(payments.get(m[1])) : json({ error: { description: "not found" } }, 404);
    if (method === "POST" && (m = path.match(/^\/payments\/([^/]+)\/capture$/))) {
      const p = payments.get(m[1])!;
      p.status = "captured";
      return json(p);
    }
    if (method === "POST" && (m = path.match(/^\/payments\/([^/]+)\/refund$/))) {
      if (state.failRefund) return json({ error: { description: "The amount is more than the refundable amount" } }, 400);
      const r: Refund = { id: next("rfnd"), payment_id: m[1], amount: body.amount, status: state.refundStatus };
      refunds.set(r.id, r);
      return json(r);
    }
    if (method === "GET" && (m = path.match(/^\/payments\/([^/]+)\/refunds\/([^/]+)$/))) return refunds.has(m[2]) ? json(refunds.get(m[2])) : json({ error: {} }, 404);
    return json({ error: { description: `unhandled ${method} ${path}` } }, 400);
  });

  return {
    state,
    refunds,
    /** The customer pays in Checkout: returns what Checkout hands the browser, signed like Razorpay does. */
    pay(gatewayOrderId: string, opts: { status?: Payment["status"]; amount?: number } = {}) {
      const order = orders.get(gatewayOrderId)!;
      const p: Payment = { id: next("pay"), order_id: gatewayOrderId, amount: opts.amount ?? order.amount, currency: "INR", status: opts.status ?? "captured" };
      payments.set(p.id, p);
      const signature = createHmac("sha256", "test_key_secret").update(`${gatewayOrderId}|${p.id}`).digest("hex");
      return { razorpay_order_id: gatewayOrderId, razorpay_payment_id: p.id, razorpay_signature: signature, payment: p };
    },
    setRefundStatus(id: string, status: Refund["status"]) {
      refunds.get(id)!.status = status;
    },
    webhookSignature: (raw: string) => createHmac("sha256", "test_webhook_secret").update(raw).digest("hex"),
  };
}
