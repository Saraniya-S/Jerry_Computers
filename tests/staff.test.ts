import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { recordShipmentEvent, updateShipmentDetails } from "@/lib/server/admin/shipments";
import { db, schema } from "@/lib/server/db";
import { addOrderNote, getOrder, orderTimeline, placeOrder, recordPayment, updateOrderStatus } from "@/lib/server/orders";
import { ordersNeedingAction, staffMetrics } from "@/lib/server/staff/dashboard";
import { makeOrder, makeProduct, makeUser, reset } from "./helpers";

type U = Awaited<ReturnType<typeof makeUser>>;
const ship = (n = "AWB-1001") => ({ courierCode: "dtdc" as const, courierName: "", trackingNumber: n, trackingUrl: "" });
const stockOf = async (id: string) => (await db.select().from(schema.products).where(eq(schema.products.id, id)))[0].stock;

describe("e-commerce staff order workflow", () => {
  let staff: U, customer: U;
  beforeEach(async () => {
    await reset();
    staff = await makeUser("ecommerce_staff");
    customer = await makeUser("customer");
  });

  it("places an order from the cart, takes stock with a movement and tells staff", async () => {
    const p = await makeProduct({ stock: 5 });
    const [addr] = await db
      .insert(schema.addresses)
      .values({ userId: customer.id, label: "Home", recipientName: "C", phone: "+91 98765 43210", line1: "1 Street", city: "Chennai", state: "Tamil Nadu", postalCode: "600001" })
      .returning();
    await db.insert(schema.cartItems).values({ userId: customer.id, productSlug: p.slug, quantity: 2 });
    const order = await placeOrder(customer.id, { addressId: addr.id, paymentMethod: "cod", note: null });
    expect(await stockOf(p.id)).toBe(3);
    const [move] = await db.select().from(schema.inventoryMovements).where(and(eq(schema.inventoryMovements.productId, p.id), eq(schema.inventoryMovements.reason, "order_placed")));
    expect(move).toMatchObject({ delta: -2, stockAfter: 3, orderId: order.id });
    const inbox = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, staff.id));
    expect(inbox).toMatchObject([{ kind: "order.placed", href: `/staff/orders/${order.id}` }]);
  });

  it("enforces confirm → pack → ship → deliver and rejects skipped or repeated steps", async () => {
    const o = await makeOrder(customer.id, await makeProduct());
    await expect(updateOrderStatus(o.id, "packed", staff.id)).rejects.toThrow(/can't move/);
    await expect(updateOrderStatus(o.id, "shipped", staff.id, { shipment: ship() })).rejects.toThrow(/can't move/);
    await updateOrderStatus(o.id, "confirmed", staff.id);
    await expect(updateOrderStatus(o.id, "confirmed", staff.id)).rejects.toThrow(/can't move/);
    await updateOrderStatus(o.id, "packed", staff.id);
    await updateOrderStatus(o.id, "shipped", staff.id, { shipment: ship() });
    await expect(updateOrderStatus(o.id, "cancelled", staff.id, { cancelReason: "too late" })).rejects.toThrow(/can't move/);
    await updateOrderStatus(o.id, "delivered", staff.id);
    expect((await getOrder(o.id))?.status).toBe("delivered");
  });

  it("rejects a new order with a reason, puts stock back exactly once", async () => {
    const p = await makeProduct({ stock: 4 });
    const o = await makeOrder(customer.id, p);
    await expect(updateOrderStatus(o.id, "cancelled", staff.id, { cancelReason: " " })).rejects.toThrow(/why/);
    const results = await Promise.allSettled([1, 2].map(() => updateOrderStatus(o.id, "cancelled", staff.id, { cancelReason: "Can't deliver to this PIN code" })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await stockOf(p.id)).toBe(5);
    const moves = await db.select().from(schema.inventoryMovements).where(and(eq(schema.inventoryMovements.productId, p.id), eq(schema.inventoryMovements.reason, "order_cancelled")));
    expect(moves).toHaveLength(1);
    expect((await getOrder(o.id))?.cancelReason).toBe("Can't deliver to this PIN code");
  });

  it("only records cash on delivery after dispatch", async () => {
    const o = await makeOrder(customer.id, await makeProduct());
    await expect(recordPayment(o.id, "", staff.id)).rejects.toThrow(/once the order has been dispatched/);
    await updateOrderStatus(o.id, "confirmed", staff.id);
    await updateOrderStatus(o.id, "packed", staff.id);
    await expect(recordPayment(o.id, "", staff.id)).rejects.toThrow(/dispatched/);
    await updateOrderStatus(o.id, "shipped", staff.id, { shipment: ship() });
    await recordPayment(o.id, "Cash collected by DTDC", staff.id);
    expect((await getOrder(o.id))?.paymentStatus).toBe("paid");
  });

  it("marks a parcel the courier brings back as returned, with a refund due if paid", async () => {
    const admin = await makeUser("admin");
    const p = await makeProduct({ stock: 3 });
    const o = await makeOrder(customer.id, p, { paymentMethod: "online" });
    await recordPayment(o.id, "UPI-77", staff.id);
    await updateOrderStatus(o.id, "confirmed", staff.id);
    await updateOrderStatus(o.id, "packed", staff.id);
    await updateOrderStatus(o.id, "shipped", staff.id, { shipment: ship() });
    const s = (await getOrder(o.id))!.shipments[0];
    await recordShipmentEvent(staff.id, { shipmentId: s.id, status: "returned", note: "Customer not reachable" });
    const after = await getOrder(o.id);
    expect(after).toMatchObject({ status: "returned", paymentStatus: "refund_pending" });
    // Stock is not put back automatically; an admin restocks after checking the goods.
    expect(await stockOf(p.id)).toBe(3);
    expect((await db.select().from(schema.notifications).where(eq(schema.notifications.userId, admin.id))).some((n) => n.kind === "order.returned")).toBe(true);
    await expect(updateOrderStatus(o.id, "delivered", staff.id)).rejects.toThrow(/can't move/);
  });

  it("corrects shipment details on the right order, and only while in transit", async () => {
    const o = await makeOrder(customer.id, await makeProduct());
    const other = await makeOrder(customer.id, await makeProduct());
    for (const id of [o.id, other.id]) {
      await updateOrderStatus(id, "confirmed", staff.id);
      await updateOrderStatus(id, "packed", staff.id);
    }
    await updateOrderStatus(o.id, "shipped", staff.id, { shipment: ship("AWB-1") });
    await updateOrderStatus(other.id, "shipped", staff.id, { shipment: ship("AWB-2") });
    const s = (await getOrder(o.id))!.shipments[0];
    await expect(updateShipmentDetails(staff.id, s.id, ship("AWB-2"))).rejects.toThrow(/already used/);
    await updateShipmentDetails(staff.id, s.id, { courierCode: "bluedart", courierName: "", trackingNumber: "BD-555", trackingUrl: "https://www.bluedart.com/" });
    expect(await getOrder(o.id)).toMatchObject({ courierName: "Blue Dart", trackingNumber: "BD-555" });
    expect((await getOrder(other.id))?.trackingNumber).toBe("AWB-2");
    await recordShipmentEvent(staff.id, { shipmentId: s.id, status: "delivered" });
    await expect(updateShipmentDetails(staff.id, s.id, ship("AWB-9"))).rejects.toThrow(/finished/);
  });

  it("keeps internal notes and staff actions on the timeline", async () => {
    const o = await makeOrder(customer.id, await makeProduct());
    await updateOrderStatus(o.id, "confirmed", staff.id);
    await addOrderNote(o.id, staff.id, "Customer asked to deliver after 5 pm");
    await expect(addOrderNote(o.id, staff.id, "   ")).rejects.toThrow();
    const t = await orderTimeline(o.id);
    expect(t.map((x) => x.kind)).toEqual(["placed", "action", "note"]);
    expect(t[2]).toMatchObject({ text: "Customer asked to deliver after 5 pm", by: `${staff.firstName} Test` });
  });

  it("counts the dashboard and action list from real orders", async () => {
    const a = await makeOrder(customer.id, await makeProduct());
    const b = await makeOrder(customer.id, await makeProduct(), { paymentMethod: "online" });
    const c = await makeOrder(customer.id, await makeProduct());
    await updateOrderStatus(b.id, "confirmed", staff.id);
    await updateOrderStatus(c.id, "cancelled", staff.id, { cancelReason: "Duplicate" });
    const m = await staffMetrics();
    expect(m).toMatchObject({ total: 3, onlineToVerify: 1, codToCollect: 0 });
    expect(m.status).toMatchObject({ placed: 1, confirmed: 1, cancelled: 1 });
    expect((await ordersNeedingAction()).map((o) => o.id).sort()).toEqual([a.id, b.id].sort());
  });
});
