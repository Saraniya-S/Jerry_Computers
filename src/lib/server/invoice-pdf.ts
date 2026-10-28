import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { site } from "@/config/site";
import { invoiceNumber, orderNumber, paymentLabel } from "@/lib/money";
import type { ShopSettings } from "@/lib/settings";
import type { AddressSnapshot, Invoice } from "./db/schema";

/**
 * Renders a GST tax invoice as an A4 PDF. Uses the built-in Helvetica, which has no ₹ glyph,
 * so amounts are written "Rs.".
 */

const ink = rgb(0.11, 0.1, 0.22);
const muted = rgb(0.33, 0.32, 0.44);
const dim = rgb(0.55, 0.53, 0.63);
const brand = rgb(0.216, 0.184, 0.388);
const line = rgb(0.85, 0.89, 0.84);
const band = rgb(0.93, 0.96, 0.93);

const rs = (paise: number) => `Rs. ${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (bp: number) => `${(bp / 100).toString()}%`;
const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });

type Input = {
  invoice: Invoice;
  orderSeq: number;
  orderDate: Date;
  paymentMethod: string;
  paymentReference: string | null;
  shipTo: AddressSnapshot;
  shop: ShopSettings;
};

export async function renderInvoicePdf({ invoice, orderSeq, orderDate, paymentMethod, paymentReference, shipTo, shop }: Input) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${invoiceNumber(invoice.seq)}`);
  pdf.setAuthor(shop.legalName || site.name);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28;
  const H = 841.89;
  const M = 44;
  let page = pdf.addPage([W, H]);
  let y = H - M;

  const text = (p: PDFPage, s: string, x: number, yy: number, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; align?: "left" | "right"; width?: number } = {}) => {
    const size = o.size ?? 9;
    const font = o.font ?? regular;
    const clean = s.replace(/[^\x20-\x7E -ÿ]/g, "?");
    const tx = o.align === "right" ? x + (o.width ?? 0) - font.widthOfTextAtSize(clean, size) : x;
    p.drawText(clean, { x: tx, y: yy, size, font, color: o.color ?? ink });
  };
  /** Wraps a string to fit a width; returns the lines. */
  const wrap = (s: string, width: number, size = 9, font = regular) => {
    const words = s.split(/\s+/);
    const out: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > width && cur) {
        out.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) out.push(cur);
    return out;
  };

  // Header: seller on the left, invoice details on the right.
  const sellerName = shop.legalName || site.name;
  text(page, sellerName, M, y - 4, { size: 16, font: bold, color: brand });
  let sy = y - 22;
  const sellerLines = [shop.address, [shop.city, shop.state, shop.postalCode].filter(Boolean).join(", "), [shop.phone, shop.email].filter(Boolean).join("  |  ")].filter(Boolean);
  for (const l of sellerLines.flatMap((l) => wrap(l, 280, 8.5))) {
    text(page, l, M, sy, { size: 8.5, color: muted });
    sy -= 12;
  }
  if (shop.gstin) {
    text(page, `GSTIN: ${shop.gstin}`, M, sy, { size: 8.5, font: bold, color: ink });
    sy -= 12;
  }

  text(page, "TAX INVOICE", W - M - 200, y - 4, { size: 16, font: bold, align: "right", width: 200 });
  const meta: [string, string][] = [
    ["Invoice no.", invoiceNumber(invoice.seq)],
    ["Invoice date", dateFmt.format(invoice.sentAt)],
    ["Order no.", orderNumber(orderSeq)],
    ["Order date", dateFmt.format(orderDate)],
    ["Payment", `${paymentLabel[paymentMethod] ?? paymentMethod} (paid)`],
  ];
  let my = y - 24;
  for (const [k, v] of meta) {
    text(page, k, W - M - 200, my, { size: 8.5, color: dim });
    text(page, v, W - M - 120, my, { size: 8.5, font: bold, align: "right", width: 120 });
    my -= 12.5;
  }
  if (paymentReference) {
    for (const l of wrap(`Ref: ${paymentReference}`, 200, 8)) {
      text(page, l, W - M - 200, my, { size: 8, color: dim, align: "right", width: 200 });
      my -= 11;
    }
  }
  y = Math.min(sy, my) - 14;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: line });
  y -= 18;

  // Billed to / ship to
  const b = invoice.billedTo;
  const colW = (W - 2 * M - 20) / 2;
  const billLines = [b.companyName ?? b.name, b.companyName ? b.name : "", b.email, b.gstin ? `GSTIN: ${b.gstin}` : ""].filter(Boolean);
  const shipLines = [
    shipTo.recipientName,
    shipTo.line1,
    shipTo.line2 ?? "",
    shipTo.landmark ? `Near ${shipTo.landmark}` : "",
    `${shipTo.city}, ${shipTo.state} ${shipTo.postalCode}`,
    shipTo.phone,
  ].filter(Boolean);
  text(page, "BILLED TO", M, y, { size: 7.5, font: bold, color: dim });
  text(page, "SHIP TO", M + colW + 20, y, { size: 7.5, font: bold, color: dim });
  let by = y - 14;
  for (const l of billLines.flatMap((l) => wrap(l, colW))) {
    text(page, l, M, by);
    by -= 12;
  }
  let shy = y - 14;
  for (const l of shipLines.flatMap((l) => wrap(l, colW))) {
    text(page, l, M + colW + 20, shy);
    shy -= 12;
  }
  text(page, `Place of supply: ${shipTo.state}`, M + colW + 20, shy - 2, { size: 8, color: dim });
  y = Math.min(by, shy - 12) - 14;

  // Items table
  const cols = [
    { key: "#", x: M, w: 18, align: "left" as const },
    { key: "Item", x: M + 20, w: 186, align: "left" as const },
    { key: "Qty", x: M + 206, w: 30, align: "right" as const },
    { key: "Rate", x: M + 238, w: 64, align: "right" as const },
    { key: "Taxable", x: M + 304, w: 70, align: "right" as const },
    { key: "GST", x: M + 376, w: 66, align: "right" as const },
    { key: "Amount", x: M + 444, w: W - 2 * M - 444, align: "right" as const },
  ];
  const header = () => {
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: band });
    for (const c of cols) text(page, c.key.toUpperCase(), c.x + (c.align === "left" ? 4 : 0), y, { size: 7.5, font: bold, color: muted, align: c.align, width: c.w - 4 });
    y -= 22;
  };
  header();
  invoice.lines.forEach((l, i) => {
    const nameLines = wrap(l.name, 180, 9, bold);
    const rowH = 12 * nameLines.length + 14;
    if (y - rowH < 160) {
      page = pdf.addPage([W, H]);
      y = H - M;
      header();
    }
    text(page, String(i + 1), cols[0].x + 4, y, { color: muted });
    nameLines.forEach((n, j) => text(page, n, cols[1].x + 4, y - j * 12, { font: bold }));
    text(page, l.category, cols[1].x + 4, y - nameLines.length * 12, { size: 7.5, color: dim });
    text(page, String(l.quantity), cols[2].x, y, { align: "right", width: cols[2].w - 4 });
    text(page, rs(l.unitPricePaise), cols[3].x, y, { align: "right", width: cols[3].w - 4 });
    text(page, rs(l.taxablePaise), cols[4].x, y, { align: "right", width: cols[4].w - 4 });
    text(page, rs(l.gstPaise), cols[5].x, y, { align: "right", width: cols[5].w - 4 });
    text(page, pct(l.gstRateBp), cols[5].x, y - 11, { size: 7.5, color: dim, align: "right", width: cols[5].w - 4 });
    text(page, rs(l.amountPaise), cols[6].x, y, { font: bold, align: "right", width: cols[6].w });
    y -= rowH;
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.5, color: line });
  });

  // Totals
  y -= 8;
  const tx = W - M - 220;
  const row = (label: string, value: string, strong = false) => {
    text(page, label, tx, y, { size: strong ? 11 : 9, font: strong ? bold : regular, color: strong ? ink : muted });
    text(page, value, tx + 100, y, { size: strong ? 11 : 9, font: strong ? bold : regular, align: "right", width: 120 });
    y -= strong ? 18 : 14;
  };
  row("Taxable value", rs(invoice.taxablePaise));
  if (invoice.intraState) {
    const cgst = Math.floor(invoice.gstPaise / 2);
    row("CGST", rs(cgst));
    row("SGST", rs(invoice.gstPaise - cgst));
  } else {
    // Without the shop's state on file we can't say which applies, so show plain GST.
    row(shop.state ? "IGST" : "GST", rs(invoice.gstPaise));
  }
  if (invoice.shippingPaise) row("Delivery", rs(invoice.shippingPaise));
  page.drawLine({ start: { x: tx, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: 0.8, color: line });
  y -= 4;
  row("Total paid", rs(invoice.totalPaise), true);

  for (const l of wrap(`Amount in words: ${inWords(invoice.totalPaise)}`, W - 2 * M, 8.5)) {
    text(page, l, M, y, { size: 8.5, color: muted });
    y -= 12;
  }

  // Footer
  text(page, "Prices include GST. This is a computer-generated invoice and needs no signature.", M, M + 10, { size: 7.5, color: dim });
  text(page, `Thank you for shopping with ${site.name}.`, M, M - 2, { size: 7.5, color: dim });

  return pdf.save();
}

const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number) {
  return n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`;
}

function threeDigits(n: number) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ones[h]} Hundred` : "", r ? twoDigits(r) : ""].filter(Boolean).join(" ");
}

/** Indian-system words: 130026.40 → "One Lakh Thirty Thousand Twenty Six Rupees and Forty Paise Only". */
export function inWords(paise: number) {
  let rupees = Math.floor(paise / 100);
  const p = paise % 100;
  const parts: string[] = [];
  const crore = Math.floor(rupees / 1_00_00_000);
  rupees %= 1_00_00_000;
  const lakh = Math.floor(rupees / 1_00_000);
  rupees %= 1_00_000;
  const thousand = Math.floor(rupees / 1000);
  rupees %= 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rupees) parts.push(threeDigits(rupees));
  const words = parts.join(" ") || "Zero";
  return `${words} Rupees${p ? ` and ${twoDigits(p)} Paise` : ""} Only`;
}
