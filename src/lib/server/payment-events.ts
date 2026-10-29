import "server-only";
import { emailInvoice } from "./invoicing";
import type { ConfirmResult } from "./payments";

/** After a payment is newly recorded, email the invoice. A failed email never undoes the payment. */
export async function afterConfirm(result: ConfirmResult) {
  if (result.status !== "paid" || !result.orderId) return;
  try {
    await emailInvoice(result.orderId);
  } catch (err) {
    console.error("[payments] invoice email failed", result.orderId, err);
  }
}
