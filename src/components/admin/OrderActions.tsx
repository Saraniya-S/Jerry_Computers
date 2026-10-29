"use client";

import { Download, Mail, RefreshCw, Undo2, Wallet } from "lucide-react";
import { useState } from "react";
import { approveRefundAction, recordPaymentAction, recordRefundAction, resendInvoiceAction, syncPaymentAction, syncRefundAction, updateStatusAction } from "@/app/admin/actions";
import { SelectField, TextField } from "@/components/forms/controls";
import { couriers, type CourierCode } from "@/lib/couriers";
import type { OrderStatus } from "@/lib/server/db/schema";
import { ConfirmDialog, ResultAlert, Spinner, useAdminAction } from "./actions-ui";

type Next = "confirmed" | "packed" | "shipped" | "delivered" | "cancelled";

type Props = {
  orderId: string;
  status: OrderStatus;
  next: Next[];
  /** Cash on delivery, dispatched and not yet recorded. */
  canRecordPayment: boolean;
  paymentMethod: "cod" | "online";
  hasInvoice: boolean;
  /** Online order still waiting for Razorpay: blocks packing and shipping. */
  waitingForPayment: boolean;
  /** Set when a refund is due and the viewer may approve it: through Razorpay, or recorded by hand for cash. */
  refund: null | { mode: "gateway" | "manual"; pending: boolean };
  /** COD not dispatched yet: payment can't be recorded until the courier collects it. */
  codWaitsForDispatch?: boolean;
  invoiceHref: string;
};

/** Payment, fulfilment and invoice actions for one order. */
export function OrderActions({ orderId, status, next, canRecordPayment, hasInvoice, waitingForPayment, refund, codWaitsForDispatch, invoiceHref }: Props) {
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
              <Wallet className="size-4" aria-hidden /> Record cash collected
            </button>
            {open === "pay" && (
              <div className="grid gap-3 rounded-lg border border-line bg-ink-950 p-3">
                <TextField
                  label="Note"
                  optional
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Cash collected by courier"
                  hint="Record it once the courier has handed over the cash. Printed on the invoice, which is emailed to the customer."
                />
                <button type="button" onClick={() => go("pay", () => recordPaymentAction(orderId, reference))} disabled={busy !== null} className={primary}>
                  {spin("pay")} Confirm payment and send invoice
                </button>
              </div>
            )}
          </>
        )}
        {waitingForPayment && (
          <>
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Waiting for the customer to pay through Razorpay. It&apos;s marked paid automatically once Razorpay confirms; pack it after that.</p>
            <button type="button" onClick={() => go("sync", () => syncPaymentAction(orderId))} disabled={busy !== null} className={btn}>
              {busy === "sync" ? <Spinner /> : <RefreshCw className="size-4" aria-hidden />} Check payment with Razorpay
            </button>
          </>
        )}
        {codWaitsForDispatch && <p className="rounded-lg bg-ink-950 px-3 py-2 text-xs text-fg-muted">Cash on delivery: payment is recorded after dispatch, once the courier has collected it.</p>}
        {next.includes("confirmed") && (
          <button type="button" onClick={() => go("confirmed", () => updateStatusAction({ orderId, to: "confirmed" }))} disabled={busy !== null} className={primary}>
            {spin("confirmed")} Confirm order
          </button>
        )}
        {next.includes("packed") && (
          <button type="button" onClick={() => go("packed", () => updateStatusAction({ orderId, to: "packed" }))} disabled={busy !== null} className={btn}>
            {spin("packed")} Mark as packed (ready to ship)
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
            <a href={invoiceHref} className={btn}>
              <Download className="size-4" aria-hidden /> Download invoice PDF
            </a>
            <button type="button" onClick={() => go("resend", () => resendInvoiceAction(orderId))} disabled={busy !== null} className={btn}>
              {busy === "resend" ? <Spinner /> : <Mail className="size-4" aria-hidden />} Resend invoice
            </button>
          </>
        )}
        {refund?.pending && (
          <>
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Refund sent to Razorpay; waiting for Razorpay to confirm it.</p>
            <button type="button" onClick={() => go("syncRefund", () => syncRefundAction(orderId))} disabled={busy !== null} className={btn}>
              {busy === "syncRefund" ? <Spinner /> : <RefreshCw className="size-4" aria-hidden />} Check refund status
            </button>
          </>
        )}
        {refund && !refund.pending && refund.mode === "gateway" && (
          <ConfirmDialog
            title="Approve the refund?"
            tone="primary"
            confirmLabel="Approve refund"
            onConfirm={() => approveRefundAction(orderId)}
            trigger={(o) => (
              <button type="button" onClick={o} disabled={busy !== null} className={btn}>
                <Undo2 className="size-4" aria-hidden /> Approve refund
              </button>
            )}
          >
            The amount paid is sent back to the customer&apos;s original payment method through Razorpay. The order shows refunded once Razorpay confirms.
          </ConfirmDialog>
        )}
        {refund && !refund.pending && refund.mode === "manual" && (
          <>
            <button type="button" onClick={() => setOpen(open === "refund" ? null : "refund")} aria-expanded={open === "refund"} className={btn}>
              <Undo2 className="size-4" aria-hidden /> Record cash refund
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
            title={status === "placed" ? "Reject this order?" : "Cancel this order?"}
            confirmLabel={status === "placed" ? "Reject order" : "Cancel order"}
            reason={status === "placed" ? "Reason for rejecting (e.g. can't deliver to this PIN code)" : "Reason for cancelling"}
            onConfirm={(cancelReason) => updateStatusAction({ orderId, to: "cancelled", cancelReason })}
            trigger={(o) => (
              <button type="button" onClick={o} disabled={busy !== null} className={`${btn} border-red-200 text-red-700 hover:bg-red-50`}>
                {status === "placed" ? "Reject order" : "Cancel order"}
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
