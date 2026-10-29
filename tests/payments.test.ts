import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as webhook } from "@/app/api/payments/razorpay/webhook/route";
import { collectionTotals, listCollections, recordCollection } from "@/lib/server/admin/collections";
import { createServiceRequest } from "@/lib/server/admin/service-requests";
import { db, schema } from "@/lib/server/db";
import { getOrder, placeOrder, recordRefund, updateOrderStatus } from "@/lib/server/orders";
import { applyRefundStatus, approveGatewayRefund, confirmOnlinePayment, startOnlinePayment, syncOnlinePayment } from "@/lib/server/payments";
import { saveSettings } from "@/lib/server/settings";
import { installFakeRazorpay } from "./fake-razorpay";
import { makeProduct, makeUser, reset, walkIn } from "./helpers";

type U = Awaited<ReturnType<typeof makeUser>>;
const order = async (id: string) => (await getOrder(id))!;

async function cartOrder(customer: U, products: { slug: string }[], paymentMethod: "cod" | "online") {
  const [addr] = await db
    .insert(schema.addresses)
    .values({ userId: customer.id, label: "Home", recipientName: "C", phone: "+91 98765 43210", line1: "1 Street", city: "Chennai", state: "Tamil Nadu", postalCode: "600001" })
    .returning();
  for (const p of products) await db.insert(schema.cartItems).values({ userId: customer.id, productSlug: p.slug, quantity: 1 });
  return placeOrder(customer.id, { addressId: addr.id, paymentMethod, note: null });
}

describe("checkout rules", () => {
  let customer: U;
  beforeEach(async () => {
    await reset();
    customer = await makeUser("customer");
    await saveSettings("store", { shippingPaise: 99_00, codEnabled: true }, customer.id);
  });

  it("offers cash on delivery only when every item allows it", async () => {
    const cod = await makeProduct({ codAvailable: true });
    const online = await makeProduct({ codAvailable: false });
    await expect(cartOrder(customer, [cod, online], "cod")).rejects.toThrow(/can't be paid for on delivery/);
    await db.delete(schema.cartItems);
    const o = await cartOrder(customer, [cod], "cod");
    expect(o.paymentMethod).toBe("cod");
  });

  it("adds the delivery charge to every order, however large", async () => {
    const pricey = await makeProduct({ pricePaise: 5_00_000_00, codAvailable: true });
    const o = await cartOrder(customer, [pricey], "cod");
    expect(o).toMatchObject({ shippingPaise: 99_00, totalPaise: 5_00_000_00 + 99_00 });
  });
});

describe("Razorpay payments", () => {
  let customer: U;
  let rzp: ReturnType<typeof installFakeRazorpay>;
  let orderId: string;
  beforeEach(async () => {
    await reset();
    rzp = installFakeRazorpay();
    customer = await makeUser("customer");
    await saveSettings("store", { shippingPaise: 50_00, codEnabled: true }, customer.id);
    orderId = (await cartOrder(customer, [await makeProduct({ pricePaise: 1_000_00 })], "online")).id;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("creates one Razorpay order for the customer's own order, for the exact total", async () => {
    const other = await makeUser("customer");
    await expect(startOnlinePayment(other.id, orderId)).rejects.toThrow(/not found/);
    const a = await startOnlinePayment(customer.id, orderId);
    const b = await startOnlinePayment(customer.id, orderId);
    expect(a.gatewayOrderId).toBe(b.gatewayOrderId);
    expect(a).toMatchObject({ keyId: "rzp_test_fake", amount: 1_050_00, currency: "INR" });
    expect(rzp.state.calls.filter((c) => c === "POST /orders")).toHaveLength(1);
  });

  it("marks the order paid only after Razorpay confirms the captured payment", async () => {
    const s = await startOnlinePayment(customer.id, orderId);
    const cb = rzp.pay(s.gatewayOrderId);
    // A forged signature is refused without touching the order.
    expect((await confirmOnlinePayment({ gatewayOrderId: s.gatewayOrderId, paymentId: cb.razorpay_payment_id, signature: "00".repeat(32) })).status).toBe("failed");
    expect((await order(orderId)).paymentStatus).toBe("pending");

    const r = await confirmOnlinePayment({ gatewayOrderId: s.gatewayOrderId, paymentId: cb.razorpay_payment_id, signature: cb.razorpay_signature });
    expect(r.status).toBe("paid");
    const o = await order(orderId);
    expect(o.paymentStatus).toBe("paid");
    expect(o.invoice).not.toBeNull();
    expect(o.payments).toMatchObject([{ provider: "razorpay", reference: cb.razorpay_payment_id, amountPaise: 1_050_00, status: "succeeded" }]);
  });

  it("doesn't mark failed, unfinished or wrong-amount payments as paid", async () => {
    const admin = await makeUser("admin");
    const s = await startOnlinePayment(customer.id, orderId);
    const failed = rzp.pay(s.gatewayOrderId, { status: "failed" });
    expect((await confirmOnlinePayment({ gatewayOrderId: s.gatewayOrderId, paymentId: failed.razorpay_payment_id, signature: failed.razorpay_signature })).status).toBe("failed");
    const short = rzp.pay(s.gatewayOrderId, { amount: 1_00 });
    expect((await confirmOnlinePayment({ gatewayOrderId: s.gatewayOrderId, paymentId: short.razorpay_payment_id, signature: short.razorpay_signature })).status).toBe("failed");
    expect((await order(orderId)).paymentStatus).toBe("pending");
    const inbox = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, admin.id));
    expect(inbox.some((n) => n.kind === "payment.mismatch")).toBe(true);
    // An authorised payment is captured through the API, then recorded.
    const auth = rzp.pay(s.gatewayOrderId, { status: "authorized" });
    expect((await confirmOnlinePayment({ gatewayOrderId: s.gatewayOrderId, paymentId: auth.razorpay_payment_id, signature: auth.razorpay_signature })).status).toBe("paid");
    expect(rzp.state.calls).toContain(`POST /payments/${auth.razorpay_payment_id}/capture`);
  });

  it("records a payment once when the browser and the webhook confirm it together", async () => {
    const s = await startOnlinePayment(customer.id, orderId);
    const cb = rzp.pay(s.gatewayOrderId);
    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: cb.razorpay_payment_id, order_id: s.gatewayOrderId } } } });
    const req = () => new Request("http://x/api/payments/razorpay/webhook", { method: "POST", body, headers: { "x-razorpay-signature": rzp.webhookSignature(body) } }) as unknown as NextRequest;
    const [a, b, c] = await Promise.all([
      confirmOnlinePayment({ gatewayOrderId: s.gatewayOrderId, paymentId: cb.razorpay_payment_id, signature: cb.razorpay_signature }),
      webhook(req()),
      webhook(req()),
    ]);
    expect(["paid", "already_paid"]).toContain(a.status);
    expect([b.status, c.status]).toEqual([200, 200]);
    const rows = await db.select().from(schema.payments).where(eq(schema.payments.orderId, orderId));
    expect(rows).toHaveLength(1);
    expect((await order(orderId)).paymentStatus).toBe("paid");
  });

  it("rejects webhooks without a valid signature", async () => {
    const body = JSON.stringify({ event: "payment.captured", payload: {} });
    const res = await webhook(new Request("http://x", { method: "POST", body, headers: { "x-razorpay-signature": "deadbeef" } }) as unknown as NextRequest);
    expect(res.status).toBe(401);
  });

  it("finds a payment that both the callback and webhook missed", async () => {
    const s = await startOnlinePayment(customer.id, orderId);
    rzp.pay(s.gatewayOrderId);
    expect((await syncOnlinePayment(orderId)).status).toBe("paid");
  });

  it("flags money that arrives for a cancelled order as a refund due", async () => {
    const staff = await makeUser("ecommerce_staff");
    const s = await startOnlinePayment(customer.id, orderId);
    await updateOrderStatus(orderId, "cancelled", staff.id, { cancelReason: "Out of stock" });
    const cb = rzp.pay(s.gatewayOrderId);
    await confirmOnlinePayment({ gatewayOrderId: s.gatewayOrderId, paymentId: cb.razorpay_payment_id, signature: cb.razorpay_signature });
    expect((await order(orderId)).paymentStatus).toBe("refund_pending");
  });

  describe("refunds", () => {
    let admin: U;
    beforeEach(async () => {
      admin = await makeUser("admin");
      const staff = await makeUser("ecommerce_staff");
      const s = await startOnlinePayment(customer.id, orderId);
      const cb = rzp.pay(s.gatewayOrderId);
      await confirmOnlinePayment({ gatewayOrderId: s.gatewayOrderId, paymentId: cb.razorpay_payment_id, signature: cb.razorpay_signature });
      await updateOrderStatus(orderId, "cancelled", staff.id, { cancelReason: "Customer changed mind" });
    });

    it("refunds through Razorpay only when an admin approves, and shows refunded only once Razorpay confirms", async () => {
      expect((await order(orderId)).paymentStatus).toBe("refund_pending");
      await expect(recordRefund(orderId, "cash", admin.id)).rejects.toThrow(/through Razorpay/);
      rzp.state.refundStatus = "pending";
      const r = await approveGatewayRefund(admin.id, orderId);
      expect(r).toMatchObject({ amount: 1_050_00, status: "pending" });
      expect((await order(orderId)).paymentStatus).toBe("refund_pending");
      // A second click can't refund twice.
      await expect(approveGatewayRefund(admin.id, orderId)).rejects.toThrow(/already being processed/);
      await applyRefundStatus({ id: r.refundId, status: "processed" });
      const o = await order(orderId);
      expect(o.paymentStatus).toBe("refunded");
      expect(o.payments.map((p) => [p.kind, p.status])).toEqual([
        ["payment", "succeeded"],
        ["refund", "succeeded"],
      ]);
    });

    it("keeps the refund due when Razorpay refuses or fails it, so it can be approved again", async () => {
      rzp.state.failRefund = true;
      await expect(approveGatewayRefund(admin.id, orderId)).rejects.toThrow(/couldn't start the refund/);
      expect((await order(orderId)).paymentStatus).toBe("refund_pending");
      rzp.state.failRefund = false;
      rzp.state.refundStatus = "pending";
      const r = await approveGatewayRefund(admin.id, orderId);
      await applyRefundStatus({ id: r.refundId, status: "failed" });
      expect((await order(orderId)).paymentStatus).toBe("refund_pending");
      rzp.state.refundStatus = "processed";
      await approveGatewayRefund(admin.id, orderId);
      expect((await order(orderId)).paymentStatus).toBe("refunded");
    });
  });
});

describe("service desk collections", () => {
  let admin: U, eng: U, other: U, jobId: string;
  beforeEach(async () => {
    await reset();
    admin = await makeUser("admin");
    eng = await makeUser("engineer");
    jobId = (await createServiceRequest(admin.id, walkIn())).id;
    other = await makeUser("engineer");
  });

  it("lets the assigned engineer and admins record what the customer paid", async () => {
    await recordCollection(eng, { requestId: jobId, amount: "1,500", method: "upi", note: "Advance" });
    await recordCollection(admin, { requestId: jobId, amount: "750.50", method: "cash" });
    await expect(recordCollection(other, { requestId: jobId, amount: "100", method: "cash" })).rejects.toThrow(/isn't assigned to you/);
    await expect(recordCollection(eng, { requestId: jobId, amount: "0", method: "cash" })).rejects.toThrow(/amount/);
    await expect(recordCollection(eng, { requestId: jobId, amount: "-5", method: "cash" })).rejects.toThrow(/amount/);
    const c = await listCollections(jobId);
    expect(c.totalPaise).toBe(2_250_50);
    const day = new Date(Date.now() - 86_400_000);
    const t = await collectionTotals(day, new Date(Date.now() + 86_400_000));
    expect(t).toMatchObject({ total: 2_250_50, jobs: 1 });
    expect(Object.fromEntries(t.byMethod.map((m) => [m.method, m.total]))).toEqual({ upi: 1_500_00, cash: 750_50 });
  });

  it("allows only admins to correct, with a reason, and never below zero", async () => {
    await recordCollection(eng, { requestId: jobId, amount: "1000", method: "cash" });
    await expect(recordCollection(eng, { requestId: jobId, amount: "100", method: "cash", note: "typo", correction: true })).rejects.toThrow(/Only an admin/);
    await expect(recordCollection(admin, { requestId: jobId, amount: "100", method: "cash", correction: true })).rejects.toThrow(/what the correction/);
    await expect(recordCollection(admin, { requestId: jobId, amount: "2000", method: "cash", note: "typo", correction: true })).rejects.toThrow(/Only ₹1,000.00/);
    await recordCollection(admin, { requestId: jobId, amount: "100", method: "cash", note: "Typed 1000 instead of 900", correction: true });
    expect((await listCollections(jobId)).totalPaise).toBe(900_00);
    const log = await db.select().from(schema.auditLogs).where(and(eq(schema.auditLogs.entityId, jobId), eq(schema.auditLogs.action, "service.collection")));
    expect(log).toHaveLength(1);
  });

  it("won't record money on a cancelled job for an engineer", async () => {
    const { changeServiceStatus } = await import("@/lib/server/admin/service-requests");
    await changeServiceStatus({ id: admin.id, role: "admin" }, { requestId: jobId, to: "cancelled", note: "Customer withdrew" });
    await expect(recordCollection(eng, { requestId: jobId, amount: "100", method: "cash" })).rejects.toThrow();
  });
});
