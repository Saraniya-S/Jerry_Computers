import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { recordShipmentEvent } from "@/lib/server/admin/shipments";
import { db, schema } from "@/lib/server/db";
import { getOrder, recordPayment, recordRefund, updateOrderStatus } from "@/lib/server/orders";
import { makeOrder, makeProduct, makeUser, reset } from "./helpers";

const ship = { courierCode: "bluedart" as const, courierName: "", trackingNumber: "AWB123456", trackingUrl: "" };

describe("payments", () => {
  let staff: Awaited<ReturnType<typeof makeUser>>;
  let customer: Awaited<ReturnType<typeof makeUser>>;
  beforeEach(async () => {
    await reset();
    staff = await makeUser("ecommerce_staff");
    customer = await makeUser("customer");
  });

  it("won't mark an online payment paid without the transaction reference staff checked", async () => {
    const o = await makeOrder(customer.id, await makeProduct(), { paymentMethod: "online" });
    await expect(recordPayment(o.id, "  ", staff.id)).rejects.toThrow(/transaction ID/);
    const [still] = await db.select().from(schema.orders).where(eq(schema.orders.id, o.id));
    expect(still.paymentStatus).toBe("pending");
    // Online orders can't be packed or shipped until paid.
    await expect(updateOrderStatus(o.id, "packed", staff.id)).rejects.toThrow(/Record the online payment/);
  });

  it("records a payment row with the invoice, once", async () => {
    const o = await makeOrder(customer.id, await makeProduct(), { paymentMethod: "online" });
    await recordPayment(o.id, "UPI-998877", staff.id);
    await expect(recordPayment(o.id, "UPI-998877", staff.id)).rejects.toThrow(/already recorded/);
    const full = await getOrder(o.id);
    expect(full?.paymentStatus).toBe("paid");
    expect(full?.payments).toMatchObject([{ kind: "payment", amountPaise: o.totalPaise, reference: "UPI-998877", recordedById: staff.id }]);
    expect(full?.invoice).not.toBeNull();
  });

  it("cancelling a paid order makes a refund due, returns stock, and the refund closes it", async () => {
    const p = await makeProduct({ stock: 4 });
    const o = await makeOrder(customer.id, p);
    await recordPayment(o.id, "", staff.id);
    await expect(updateOrderStatus(o.id, "cancelled", staff.id)).rejects.toThrow(/why/);
    await updateOrderStatus(o.id, "cancelled", staff.id, { cancelReason: "Customer changed mind" });
    let full = await getOrder(o.id);
    expect(full?.paymentStatus).toBe("refund_pending");
    const [after] = await db.select().from(schema.products).where(eq(schema.products.id, p.id));
    expect(after.stock).toBe(5);
    await recordRefund(o.id, "NEFT-1", staff.id);
    full = await getOrder(o.id);
    expect(full?.paymentStatus).toBe("refunded");
    expect(full?.payments.map((x) => x.kind)).toEqual(["payment", "refund"]);
  });
});

describe("shipments", () => {
  beforeEach(reset);

  it("attaches the courier and tracking to the order being shipped, and delivery completes it", async () => {
    const staff = await makeUser("ecommerce_staff");
    const customer = await makeUser("customer");
    const other = await makeOrder(customer.id, await makeProduct());
    const o = await makeOrder(customer.id, await makeProduct());
    await expect(updateOrderStatus(o.id, "shipped", staff.id)).rejects.toThrow(/courier/);
    await updateOrderStatus(o.id, "shipped", staff.id, { shipment: ship });

    const full = await getOrder(o.id);
    expect(full?.shipments).toHaveLength(1);
    expect(full?.shipments[0]).toMatchObject({ orderId: o.id, courierName: "Blue Dart", trackingNumber: "AWB123456", status: "in_transit" });
    expect(full).toMatchObject({ courierName: "Blue Dart", trackingNumber: "AWB123456" });
    expect((await getOrder(other.id))?.shipments).toHaveLength(0);

    // The same AWB can't be reused for another Blue Dart shipment.
    await expect(updateOrderStatus(other.id, "shipped", staff.id, { shipment: ship })).rejects.toThrow(/already used/);

    const s = full!.shipments[0];
    await expect(recordShipmentEvent(staff.id, { shipmentId: s.id, status: "in_transit" })).rejects.toThrow(/can't become/);
    await recordShipmentEvent(staff.id, { shipmentId: s.id, status: "out_for_delivery", location: "Chennai hub" });
    await recordShipmentEvent(staff.id, { shipmentId: s.id, status: "delivered" });
    const done = await getOrder(o.id);
    expect(done?.status).toBe("delivered");
    expect(done?.shipments[0].events.map((e) => e.status)).toEqual(["in_transit", "out_for_delivery", "delivered"]);
  });
});
