import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { courierName, dispatchInput, shipmentFlow, shipmentStatusLabel, type DispatchInput } from "@/lib/couriers";
import { db, schema } from "../db";
import type { ShipmentStatus } from "../db/schema";
import { AdminError, audit, isUniqueViolation, type Tx } from "./tx";

/** Creates the shipment for an order being dispatched. Called inside the order's status transaction. */
export async function createShipmentTx(tx: Tx, orderId: string, input: DispatchInput, actorId: string) {
  const parsed = dispatchInput.safeParse(input);
  if (!parsed.success) throw new AdminError(parsed.error.issues[0].message);
  const v = parsed.data;
  const name = courierName(v);
  const now = new Date();
  try {
    const [s] = await tx
      .insert(schema.shipments)
      .values({ orderId, courierCode: v.courierCode, courierName: name, trackingNumber: v.trackingNumber, trackingUrl: v.trackingUrl || null, dispatchedAt: now, createdById: actorId })
      .returning();
    await tx.insert(schema.shipmentEvents).values({ shipmentId: s.id, status: "in_transit", note: `Handed to ${name}`, occurredAt: now, recordedById: actorId });
    // The customer's order pages read these two columns.
    await tx.update(schema.orders).set({ courierName: name, trackingNumber: v.trackingNumber }).where(eq(schema.orders.id, orderId));
    return s;
  } catch (err) {
    if (isUniqueViolation(err, "shipments_courier_tracking_key")) throw new AdminError(`Tracking number ${v.trackingNumber} is already used for another ${name} shipment.`);
    throw err;
  }
}

export const shipmentEventInput = z.object({
  shipmentId: z.string().uuid(),
  status: z.enum(Object.keys(shipmentStatusLabel) as [ShipmentStatus, ...ShipmentStatus[]]),
  note: z.string().trim().max(300).default(""),
  location: z.string().trim().max(80).default(""),
  /** When it happened, if not now. Can't be in the future or before dispatch. */
  occurredAt: z.coerce.date().optional(),
});

/**
 * Records a shipment status reported by the courier (entered by staff). Delivered also completes
 * the order. Only moves allowed by shipmentFlow are accepted.
 */
export async function recordShipmentEvent(actorId: string, input: z.input<typeof shipmentEventInput>) {
  const v = shipmentEventInput.parse(input);
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(schema.shipments).where(eq(schema.shipments.id, v.shipmentId)).for("update");
    if (!s) throw new AdminError("Shipment not found.");
    const allowed = shipmentFlow[s.status] as readonly ShipmentStatus[];
    if (!allowed.includes(v.status)) throw new AdminError(`A shipment that is "${shipmentStatusLabel[s.status]}" can't become "${shipmentStatusLabel[v.status]}".`);
    const occurredAt = v.occurredAt ?? new Date();
    if (occurredAt.getTime() > Date.now() + 60_000) throw new AdminError("That time is in the future.");
    if (occurredAt < s.dispatchedAt) throw new AdminError("That time is before the parcel was dispatched.");

    const [order] = await tx.select().from(schema.orders).where(eq(schema.orders.id, s.orderId)).for("update");
    await tx
      .update(schema.shipments)
      .set({ status: v.status, ...(v.status === "delivered" ? { deliveredAt: occurredAt } : {}) })
      .where(eq(schema.shipments.id, s.id));
    await tx.insert(schema.shipmentEvents).values({ shipmentId: s.id, status: v.status, note: v.note || null, location: v.location || null, occurredAt, recordedById: actorId });
    if (v.status === "delivered" && order.status === "shipped") {
      await tx.update(schema.orders).set({ status: "delivered" }).where(eq(schema.orders.id, order.id));
    }
    await audit(tx, {
      actorId,
      action: "shipment.event",
      entityType: "order",
      entityId: order.id,
      summary: `Shipment ${s.trackingNumber}: ${shipmentStatusLabel[v.status]}${v.note ? ` (${v.note})` : ""}`,
    });
  });
}

/** Marks the order's open shipment delivered when staff mark the order delivered. */
export async function deliverShipmentsTx(tx: Tx, orderId: string, actorId: string) {
  const open = await tx.select().from(schema.shipments).where(eq(schema.shipments.orderId, orderId)).for("update");
  const now = new Date();
  for (const s of open.filter((x) => x.status === "in_transit" || x.status === "out_for_delivery")) {
    await tx.update(schema.shipments).set({ status: "delivered", deliveredAt: now }).where(eq(schema.shipments.id, s.id));
    await tx.insert(schema.shipmentEvents).values({ shipmentId: s.id, status: "delivered", note: "Order marked delivered", occurredAt: now, recordedById: actorId });
  }
}

export async function shipmentsForOrders(orderIds: string[]) {
  if (!orderIds.length) return [];
  const shipments = await db.select().from(schema.shipments).where(inArray(schema.shipments.orderId, orderIds)).orderBy(desc(schema.shipments.dispatchedAt));
  const events = shipments.length
    ? await db
        .select({ e: schema.shipmentEvents, byFirst: schema.users.firstName, byLast: schema.users.lastName })
        .from(schema.shipmentEvents)
        .leftJoin(schema.users, eq(schema.users.id, schema.shipmentEvents.recordedById))
        .where(inArray(schema.shipmentEvents.shipmentId, shipments.map((s) => s.id)))
        .orderBy(asc(schema.shipmentEvents.occurredAt), asc(schema.shipmentEvents.createdAt))
    : [];
  return shipments.map((s) => ({
    ...s,
    events: events.filter((e) => e.e.shipmentId === s.id).map((e) => ({ ...e.e, by: e.byFirst ? `${e.byFirst} ${e.byLast ?? ""}`.trim() : null })),
  }));
}
export type ShipmentWithEvents = Awaited<ReturnType<typeof shipmentsForOrders>>[number];
