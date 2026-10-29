import { NextResponse, type NextRequest } from "next/server";
import { afterConfirm } from "@/lib/server/payment-events";
import { applyRefundStatus, confirmOnlinePayment } from "@/lib/server/payments";
import { webhookSignatureValid } from "@/lib/server/razorpay";

type Event = {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string | null } };
    refund?: { entity: { id: string; status: "pending" | "processed" | "failed" } };
  };
};

/**
 * Razorpay webhook: payment.captured / order.paid record the payment (after checking it with
 * Razorpay's API, like the checkout callback); refund.processed / refund.failed settle refunds.
 * Only bodies signed with RAZORPAY_WEBHOOK_SECRET are accepted. A 5xx makes Razorpay retry.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!webhookSignatureValid(raw, signature)) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  let event: Event;
  try {
    event = JSON.parse(raw) as Event;
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  try {
    if ((event.event === "payment.captured" || event.event === "order.paid") && event.payload.payment?.entity.order_id) {
      const p = event.payload.payment.entity;
      await afterConfirm(await confirmOnlinePayment({ gatewayOrderId: p.order_id!, paymentId: p.id, signature: null }));
    } else if ((event.event === "refund.processed" || event.event === "refund.failed") && event.payload.refund) {
      await applyRefundStatus(event.payload.refund.entity);
    }
    // Other events (payment.failed, …) need nothing: the order simply stays unpaid.
  } catch (err) {
    console.error("[razorpay webhook]", event.event, err);
    return NextResponse.json({ error: "temporary failure" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
