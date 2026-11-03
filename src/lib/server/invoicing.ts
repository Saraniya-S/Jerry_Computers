import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { renderInvoicePdf } from "./invoice-pdf";
import { sendInvoiceEmail } from "./mail";
import { getOrder, OrderError } from "./orders";
import { getSettings } from "./settings";

/** The PDF for an order's invoice, or null when it has none yet. */
export async function invoicePdf(orderId: string) {
  const order = await getOrder(orderId);
  if (!order?.invoice) return null;
  const [issuer] = order.invoice.sentById ? await db.select({ firstName: schema.users.firstName, lastName: schema.users.lastName }).from(schema.users).where(eq(schema.users.id, order.invoice.sentById)) : [];
  const pdf = await renderInvoicePdf({
    invoice: order.invoice,
    orderSeq: order.seq,
    orderDate: order.createdAt,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    shipTo: order.shippingAddress,
    shop: await getSettings("shop"),
    // Razorpay payments are recorded by the system, so no staff member issued them.
    billedBy: issuer ? `${issuer.firstName} ${issuer.lastName}`.trim() : "Online",
  });
  return { pdf, order, invoice: order.invoice };
}

/** Emails the invoice PDF to the customer. */
export async function emailInvoice(orderId: string) {
  const found = await invoicePdf(orderId);
  if (!found) throw new OrderError("This order has no invoice yet. Record the payment first.");
  await sendInvoiceEmail({
    invoice: found.invoice,
    orderSeq: found.order.seq,
    customerName: found.order.customer.firstName,
    pdf: found.pdf,
  });
  return found.invoice.sentTo;
}
