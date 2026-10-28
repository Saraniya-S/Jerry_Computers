import { NextResponse, type NextRequest } from "next/server";
import { invoiceNumber } from "@/lib/money";
import { invoicePdf } from "@/lib/server/invoicing";
import { getSessionUser } from "@/lib/server/session";

/** Invoice PDF for the customer who placed the order. */
export async function GET(_: NextRequest, { params }: RouteContext<"/account/orders/[id]/invoice">) {
  const user = await getSessionUser();
  const { id } = await params;
  const found = user && /^[0-9a-f-]{36}$/i.test(id) ? await invoicePdf(id) : null;
  // Same response for "not yours" and "doesn't exist".
  if (!found || found.order.userId !== user?.id) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(found.pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${invoiceNumber(found.invoice.seq)}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
