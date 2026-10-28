"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { DispatchInput } from "@/lib/couriers";
import type { ActionResult } from "@/lib/admin/result";
import { attempt } from "@/lib/server/admin/attempt";
import { recordShipmentEvent, updateShipmentDetails, type shipmentEventInput } from "@/lib/server/admin/shipments";
import { CATALOGUE_TAG } from "@/lib/server/catalogue";
import { emailInvoice } from "@/lib/server/invoicing";
import { addOrderNote, OrderError, recordPayment, recordRefund, updateOrderStatus } from "@/lib/server/orders";
import { requirePermission } from "@/lib/server/permissions";

export type AdminResult = ActionResult;

const uuid = z.string().uuid();

/**
 * Marks the order paid after staff have checked the money arrived, issues its invoice and emails
 * the PDF. The browser never decides a payment succeeded; this needs a signed-in staff member.
 */
export async function recordPaymentAction(orderId: string, reference: string): Promise<AdminResult> {
  const staff = await requirePermission("payments.record");
  const id = uuid.parse(orderId);
  const ref = z.string().trim().max(120).parse(reference);
  try {
    await recordPayment(id, ref, staff.id);
  } catch (err) {
    if (err instanceof OrderError) return { ok: false, error: err.message };
    throw err;
  }
  refresh();
  try {
    const to = await emailInvoice(id);
    return { ok: true, message: `Payment recorded. Invoice PDF emailed to ${to}.` };
  } catch (err) {
    console.error("[admin] invoice email failed", err);
    return { ok: false, error: "Payment is recorded and the invoice is ready, but the email didn't send. Use Resend invoice." };
  }
}

export async function resendInvoiceAction(orderId: string): Promise<AdminResult> {
  await requirePermission("payments.record");
  try {
    const to = await emailInvoice(uuid.parse(orderId));
    return { ok: true, message: `Invoice PDF re-sent to ${to}.` };
  } catch (err) {
    if (err instanceof OrderError) return { ok: false, error: err.message };
    console.error("[admin] invoice email failed", err);
    return { ok: false, error: "The email didn't send. Please try again." };
  }
}

/** Records that a cancelled order's payment has been returned. Admins only. */
export async function recordRefundAction(orderId: string, reference: string): Promise<AdminResult> {
  const admin = await requirePermission("payments.refund");
  const res = await attempt(async () => {
    await recordRefund(uuid.parse(orderId), z.string().max(120).parse(reference), admin.id);
    return "Refund recorded.";
  });
  if (res.ok) refresh();
  return res;
}

const statusSchema = z.object({
  orderId: z.string().uuid(),
  to: z.enum(["confirmed", "packed", "shipped", "delivered", "cancelled"]),
  cancelReason: z.string().trim().max(300).optional(),
});

export async function updateStatusAction(input: z.input<typeof statusSchema> & { shipment?: DispatchInput }): Promise<AdminResult> {
  const staff = await requirePermission("orders.fulfil");
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { orderId, to, cancelReason } = parsed.data;
  const res = await attempt(async () => {
    await updateOrderStatus(orderId, to, staff.id, { shipment: input.shipment, cancelReason });
    const messages = {
      confirmed: "Order confirmed. Pack it next.",
      packed: "Marked as packed and ready to ship.",
      shipped: "Dispatched. The shipment and tracking number are on the order.",
      delivered: "Marked as delivered.",
      cancelled: "Order cancelled and its stock put back on sale.",
    };
    return messages[to];
  });
  if (!res.ok) return res;
  // Cancelling returns stock to the shelf.
  if (to === "cancelled") updateTag(CATALOGUE_TAG);
  refresh();
  return res;
}

export async function shipmentEventAction(input: z.input<typeof shipmentEventInput>): Promise<AdminResult> {
  const staff = await requirePermission("orders.fulfil");
  const res = await attempt(async () => {
    await recordShipmentEvent(staff.id, input);
    return "Shipment updated.";
  });
  if (res.ok) refresh();
  return res;
}

/** Corrects the courier, tracking number or link on a shipment that's still on its way. */
export async function updateShipmentAction(shipmentId: string, input: DispatchInput): Promise<AdminResult> {
  const staff = await requirePermission("orders.fulfil");
  const res = await attempt(async () => {
    await updateShipmentDetails(staff.id, uuid.parse(shipmentId), input);
    return "Shipment details updated.";
  });
  if (res.ok) refresh();
  return res;
}

export async function addOrderNoteAction(orderId: string, note: string): Promise<AdminResult> {
  const staff = await requirePermission("orders.fulfil");
  const res = await attempt(async () => {
    await addOrderNote(uuid.parse(orderId), staff.id, z.string().max(2000).parse(note));
    return "Note added.";
  });
  if (res.ok) refresh();
  return res;
}
