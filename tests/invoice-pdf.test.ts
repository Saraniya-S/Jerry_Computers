import { writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { Invoice, InvoiceLine } from "@/lib/server/db/schema";
import { amountInWords, renderInvoicePdf } from "@/lib/server/invoice-pdf";
import { splitGst } from "@/lib/server/orders";
import { DEFAULT_INVOICE_TERMS, shopSchema } from "@/lib/settings";

// Nothing saved yet: the defaults are the shop's details from its bills.
const shop = shopSchema.parse({ legalName: "Jerry Computers" });

const line = (name: string, quantity: number, unitPricePaise: number): InvoiceLine => {
  const amount = unitPricePaise * quantity;
  const { taxable, gst } = splitGst(amount, 1800);
  return { name, category: "Accessories", quantity, unitPricePaise, gstRateBp: 1800, taxablePaise: taxable, gstPaise: gst, amountPaise: amount };
};

function invoice(lines: InvoiceLine[], gstin: string | null = null): Invoice {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    seq: 275,
    orderId: "00000000-0000-0000-0000-000000000001",
    lines,
    taxablePaise: lines.reduce((s, l) => s + l.taxablePaise, 0),
    gstPaise: lines.reduce((s, l) => s + l.gstPaise, 0),
    intraState: true,
    shippingPaise: 0,
    totalPaise: lines.reduce((s, l) => s + l.amountPaise, 0),
    billedTo: { name: "Test School", email: "office@test.local", companyName: null, gstin },
    sentTo: "office@test.local",
    sentById: null,
    sentAt: new Date("2026-06-02T10:25:00Z"),
  };
}

const render = (inv: Invoice) =>
  renderInvoicePdf({
    invoice: inv,
    orderSeq: 42,
    orderDate: new Date("2026-06-01T09:00:00Z"),
    paymentMethod: "online",
    paymentReference: "pay_TEST123",
    shipTo: { label: "School", recipientName: "Test School", phone: "+91 98765 43210", line1: "Main Road", line2: null, landmark: null, city: "Verkilambi", state: "Tamil Nadu", postalCode: "629166" },
    shop,
    billedBy: "Online",
  });

describe("invoice PDF", () => {
  it("defaults to the GSTIN, address and terms from the shop's bills", () => {
    expect(shop).toMatchObject({ gstin: "33BEYPJ4897M2ZD", city: "Kanniyakumari District", invoiceTerms: DEFAULT_INVOICE_TERMS });
  });

  it("writes the amount in words", () => {
    expect(amountInWords(15_250_00)).toBe("Fifteen Thousand Two Hundred Fifty Only");
    expect(amountInWords(1_30_026_40)).toBe("One Lakh Thirty Thousand Twenty Six and Forty Paise Only");
  });

  it("renders one page for a short invoice and more for a long one", async () => {
    const short = invoice([line("Lanzone Cat6 Copper Blk", 1, 12_000_00), line("Quickheal Antivirus-One Year", 4, 550_00), line("Relicel UPS Battery-12V,7AH AGM VRLA", 1, 1_050_00)]);
    const bytes = await render(short);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    if (process.env.INVOICE_PREVIEW) await writeFile(process.env.INVOICE_PREVIEW, bytes);

    const long = invoice(Array.from({ length: 60 }, (_, i) => line(`Item ${i + 1} with a reasonably long product name to wrap`, 1, 1_000_00)), "33ABCDE1234F1Z5");
    const many = await render(long);
    expect((await PDFDocument.load(many)).getPageCount()).toBeGreaterThan(1);
    if (process.env.INVOICE_PREVIEW) await writeFile(process.env.INVOICE_PREVIEW.replace(/\.pdf$/, "-long.pdf"), many);
  });
});
