"use client";

import { Download, Mail, Undo2, Wallet } from "lucide-react";
import { useState } from "react";
import { recordPaymentAction, recordRefundAction, resendInvoiceAction, updateStatusAction } from "@/app/admin/actions";
import { SelectField, TextField } from "@/components/forms/controls";
import { couriers, type CourierCode } from "@/lib/couriers";
import { ConfirmDialog, ResultAlert, Spinner, useAdminAction } from "./actions-ui";

type Next = "packed" | "shipped" | "delivered" | "cancelled";

type Props = {
  orderId: string;
  next: Next[];
  canRecordPayment: boolean;
  paymentMethod: "cod" | "online";
  hasInvoice: boolean;
  /** Shown when packing/shipping is blocked until payment. */
  waitingForPayment: boolean;
  /** A cancelled paid order whose refund isn't recorded yet, and the viewer may record it. */
  canRecordRefund: boolean;
};

/** Payment, fulfilment and invoice actions for one order. */
export function OrderActions({ orderId, next, canRecordPayment, paymentMethod, hasInvoice, waitingForPayment, canRecordRefund }: Props) {
  const [reference, setReference] = useState("");
  const [refundRef, setRefundRef] = useState("");
  const [shipment, setShipment] = useState({ courierCode: "" as CourierCode | "", courierName: "", trackingNumber: "", trackingUrl: "" });
  const [open, setOpen] = useState<"pay" | "ship" | "refund" | null>(null);
  const { run, busy, result } = useAdminAction();

  const go = (key: string, action: Parameters<typeof run>[1]) => run(key, action, (r) => r.ok && setOpen(null));
  const spin = (key: string) => busy === key && <Spinner />;

  return (
    <section className="rounded-xl border border-line p-4">
      <h2 className="mb-3 text-sm font-medium text-fg">Actions</h2>
      <div className="grid gap-2">
        {canRecordPayment && (
          <>
            <button type="button" onClick={() => setOpen(open === "pay" ? null : "pay")} aria-expanded={open === "pay"} className={primary}>
              <Wallet className="size-4" aria-hidden /> Record payment
            </button>
            {open === "pay" && (
              <div className="grid gap-3 rounded-lg border border-line bg-ink-950 p-3">
                <TextField
                  label={paymentMethod === "cod" ? "Note" : "Payment reference"}
                  optional={paymentMethod === "cod"}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={paymentMethod === "cod" ? "Cash collected by courier" : "UPI / bank transaction ID"}
                  hint={paymentMethod === "online" ? "Check it against your bank or UPI statement first. The customer is emailed the invoice PDF." : "Printed on the invoice. The customer is emailed the invoice PDF."}
                />
                <button
                  type="button"
                  onClick={() => go("pay", () => recordPaymentAction(orderId, reference))}
                  disabled={busy !== null || (paymentMethod === "online" && !reference.trim())}
                  className={primary}
                >
                  {spin("pay")} Confirm payment and send invoice
                </button>
              </div>
            )}
          </>
        )}
        {waitingForPayment && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Online order: record the payment before packing or shipping.</p>}
        {next.includes("packed") && (
          <button type="button" onClick={() => go("packed", () => updateStatusAction({ orderId, to: "packed" }))} disabled={busy !== null} className={btn}>
            {spin("packed")} Mark as packed
          </button>
        )}
        {next.includes("shipped") && (
          <>
            <button type="button" onClick={() => setOpen(open === "ship" ? null : "ship")} aria-expanded={open === "ship"} className={btn}>
              Dispatch with courier
            </button>
            {open === "ship" && (
              <div className="grid gap-3 rounded-lg border border-line bg-ink-950 p-3">
                <SelectField
                  label="Courier"
                  placeholder="Choose the courier"
                  options={couriers.map((c) => ({ value: c.code, label: c.name }))}
                  value={shipment.courierCode}
                  onChange={(e) => setShipment({ ...shipment, courierCode: e.target.value as CourierCode })}
                />
                {shipment.courierCode === "other" && <TextField label="Courier name" value={shipment.courierName} onChange={(e) => setShipment({ ...shipment, courierName: e.target.value })} />}
                <TextField label="Tracking (AWB) number" value={shipment.trackingNumber} onChange={(e) => setShipment({ ...shipment, trackingNumber: e.target.value.trim() })} />
                <TextField label="Tracking link" optional type="url" value={shipment.trackingUrl} onChange={(e) => setShipment({ ...shipment, trackingUrl: e.target.value })} placeholder="https://" hint="Copy it from the courier's booking receipt, if it has one." />
                <button
                  type="button"
                  onClick={() => go("shipped", () => updateStatusAction({ orderId, to: "shipped", shipment: { ...shipment, courierCode: shipment.courierCode as CourierCode } }))}
                  disabled={busy !== null || !shipment.courierCode || !shipment.trackingNumber}
                  className={primary}
                >
                  {spin("shipped")} Save shipment
                </button>
              </div>
            )}
          </>
        )}
        {next.includes("delivered") && (
          <ConfirmDialog
            title="Mark this order delivered?"
            tone="primary"
            confirmLabel="Mark delivered"
            onConfirm={() => updateStatusAction({ orderId, to: "delivered" })}
            trigger={(o) => (
              <button type="button" onClick={o} disabled={busy !== null} className={btn}>
                Mark as delivered
              </button>
            )}
          >
            Only do this once the courier or customer has confirmed delivery. The open shipment is closed as delivered.
          </ConfirmDialog>
        )}
        {hasInvoice && (
          <>
            <a href={`/admin/orders/${orderId}/invoice`} className={btn}>
              <Download className="size-4" aria-hidden /> Download invoice PDF
            </a>
            <button type="button" onClick={() => go("resend", () => resendInvoiceAction(orderId))} disabled={busy !== null} className={btn}>
              {busy === "resend" ? <Spinner /> : <Mail className="size-4" aria-hidden />} Resend invoice
            </button>
          </>
        )}
        {canRecordRefund && (
          <>
            <button type="button" onClick={() => setOpen(open === "refund" ? null : "refund")} aria-expanded={open === "refund"} className={btn}>
              <Undo2 className="size-4" aria-hidden /> Record refund
            </button>
            {open === "refund" && (
              <div className="grid gap-3 rounded-lg border border-line bg-ink-950 p-3">
                <TextField label="Refund reference" value={refundRef} onChange={(e) => setRefundRef(e.target.value)} placeholder="UPI / NEFT reference, or “cash returned”" hint="Record it only after the money has actually been sent back." />
                <button type="button" onClick={() => go("refund", () => recordRefundAction(orderId, refundRef))} disabled={busy !== null || !refundRef.trim()} className={primary}>
                  {spin("refund")} Confirm refund
                </button>
              </div>
            )}
          </>
        )}
        {next.includes("cancelled") && (
          <ConfirmDialog
            title="Cancel this order?"
            confirmLabel="Cancel order"
            reason="Reason for cancelling"
            onConfirm={(cancelReason) => updateStatusAction({ orderId, to: "cancelled", cancelReason })}
            trigger={(o) => (
              <button type="button" onClick={o} disabled={busy !== null} className={`${btn} border-red-200 text-red-700 hover:bg-red-50`}>
                Cancel order
              </button>
            )}
          >
            Its stock goes back on sale. If it was paid, it is marked “Refund due” until a refund is recorded.
          </ConfirmDialog>
        )}
      </div>
      {result && (
        <div className="mt-3">
          <ResultAlert result={result} />
        </div>
      )}
    </section>
  );
}

const btn = "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-ink-850 px-3 text-sm text-fg transition-colors hover:bg-ink-900 disabled:opacity-60";
const primary = "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-[var(--brand-hover)] disabled:opacity-60";
