/** Money is stored as whole paise. */

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatPaise = (paise: number) => inr.format(paise / 100);

/** "1,499.50" or "1499.5" → 149950; null when it isn't a valid non-negative amount. */
export function parseRupees(value: string) {
  const clean = value.replace(/[,\s₹]/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

export const paiseToInput = (paise: number | null | undefined) => (paise == null ? "" : (paise / 100).toFixed(2).replace(/\.00$/, ""));

export const orderNumber = (seq: number) => `JC-${String(seq).padStart(6, "0")}`;
export const invoiceNumber = (seq: number) => `INV-${String(seq).padStart(6, "0")}`;

export const orderStatusLabel: Record<string, string> = {
  placed: "Placed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const paymentStatusLabel: Record<string, string> = { pending: "Payment pending", paid: "Paid", refund_pending: "Refund due", refunded: "Refunded" };

export const paymentLabel: Record<string, string> = { cod: "Cash on delivery", online: "Online payment" };
