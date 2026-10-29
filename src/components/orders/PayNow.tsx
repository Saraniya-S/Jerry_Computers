"use client";

import { CreditCard, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { confirmPaymentAction, startPaymentAction } from "@/app/account/orders/actions";
import { FormAlert } from "@/components/auth/ui";

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (event: "payment.failed", cb: (r: { error?: { description?: string } }) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
const WAITING = "Waiting for payment…";

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    const s = existing ?? document.createElement("script");
    s.addEventListener("load", () => resolve(Boolean(window.Razorpay)));
    s.addEventListener("error", () => resolve(false));
    if (!existing) {
      s.src = SCRIPT;
      s.async = true;
      document.body.appendChild(s);
    }
  });
}

type State = { kind: "idle" } | { kind: "busy"; text: string } | { kind: "done"; text: string } | { kind: "error"; text: string } | { kind: "info"; text: string };

/**
 * Pays an online order with Razorpay Checkout. The server creates the Razorpay order and, after
 * Checkout returns, verifies the signature and asks Razorpay before the order is marked paid.
 */
export function PayNow({ orderId, amountLabel, autoStart = false }: { orderId: string; amountLabel: string; autoStart?: boolean }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const started = useRef(false);

  async function pay() {
    setState({ kind: "busy", text: "Opening secure payment…" });
    const [ready, start] = await Promise.all([loadCheckout(), startPaymentAction(orderId)]);
    if (!start.ok) return setState({ kind: "error", text: start.error });
    if (!ready || !window.Razorpay) return setState({ kind: "error", text: "Razorpay couldn't load. Check your connection and try again." });
    const s = start.session;
    const rzp = new window.Razorpay({
      key: s.keyId,
      order_id: s.gatewayOrderId,
      amount: s.amount,
      currency: s.currency,
      name: "Jerry Computers",
      description: `Order ${s.orderNumber}`,
      prefill: s.prefill,
      theme: { color: "#372f63" },
      handler: async (r: RazorpayResponse) => {
        setState({ kind: "busy", text: "Confirming your payment with Razorpay…" });
        const res = await confirmPaymentAction(orderId, r);
        setState(res.status === "paid" || res.status === "already_paid" ? { kind: "done", text: "Payment received. Your invoice is on its way by email." } : res.status === "pending" ? { kind: "info", text: res.message } : { kind: "error", text: res.message });
      },
      modal: { ondismiss: () => setState((cur) => (cur.kind === "busy" && cur.text === WAITING ? { kind: "info", text: "Payment not completed. You can pay any time from this page." } : cur)) },
    });
    rzp.on("payment.failed", (r) => setState({ kind: "error", text: r.error?.description ? `Payment failed: ${r.error.description}` : "Payment failed. You can try again." }));
    rzp.open();
    setState({ kind: "busy", text: WAITING });
  }

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void pay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival from checkout
  }, [autoStart]);

  if (state.kind === "done") return <FormAlert tone="success">{state.text}</FormAlert>;
  return (
    <div className="grid gap-3 rounded-xl border border-brand/20 bg-brand/[0.04] p-4">
      <div>
        <p className="font-medium text-fg">Payment due: {amountLabel}</p>
        <p className="mt-0.5 text-sm text-fg-muted">Pay by UPI, card, net banking or wallet through Razorpay. We start packing once it&apos;s received.</p>
      </div>
      {(state.kind === "error" || state.kind === "info") && <FormAlert tone={state.kind === "error" ? "error" : "info"}>{state.text}</FormAlert>}
      <button
        type="button"
        onClick={() => void pay()}
        disabled={state.kind === "busy"}
        className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-brand px-6 text-sm font-medium text-white hover:bg-[var(--brand-hover)] disabled:opacity-70"
      >
        {state.kind === "busy" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <CreditCard className="size-4" aria-hidden />}
        {state.kind === "busy" ? state.text : "Pay now"}
      </button>
    </div>
  );
}
