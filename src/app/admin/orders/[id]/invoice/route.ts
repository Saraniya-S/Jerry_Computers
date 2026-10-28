import { NextResponse, type NextRequest } from "next/server";
import { invoiceNumber } from "@/lib/money";
import { getSessionUser } from "@/lib/server/session";
import { invoicePdf } from "@/lib/server/invoicing";

/** Invoice PDF for staff. */
export async function GET(_: NextRequest, { params }: RouteContext<"/admin/orders/[id]/invoice">) {
  const user = await getSessionUser();
  if (!user || (user.role !== "admin" && user.role !== "ecommerce_staff")) return new NextResponse("Not found", { status: 404 });
  const { id } = await params;
  const found = /^[0-9a-f-]{36}$/i.test(id) ? await invoicePdf(id) : null;
  if (!found) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(found.pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${invoiceNumber(found.invoice.seq)}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
