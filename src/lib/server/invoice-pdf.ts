import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { site } from "@/config/site";
import { invoiceNumber, orderNumber, paymentLabel } from "@/lib/money";
import type { ShopSettings } from "@/lib/settings";
import type { AddressSnapshot, Invoice } from "./db/schema";

/**
 * Renders a GST tax invoice as an A4 PDF in the shop's boxed billing layout: seller header, billed-to
 * and invoice details, an item table with GST columns, CGST/SGST (or IGST) totals, a tax summary
 * by rate and terms. Uses the built-in Helvetica, which has
 * no ₹ glyph, so amounts are plain figures and the currency is written "Rs.".
 */

const black = rgb(0, 0, 0);
const grey = rgb(0.35, 0.35, 0.35);

const money = (paise: number) => (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => n.toFixed(2);
const pct = (bp: number) => `${bp / 100}%`;
const part = (d: Date, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...opts }).format(d);
const dated = (d: Date) => `${part(d, { day: "2-digit", month: "2-digit", year: "numeric" }).replaceAll("/", "-")}  ( ${part(d, { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase()} )`;

type Input = {
  invoice: Invoice;
  orderSeq: number;
  orderDate: Date;
  paymentMethod: string;
  paymentReference: string | null;
  shipTo: AddressSnapshot;
  shop: ShopSettings;
  /** Who issued it: the staff member who recorded the payment, or "Online" for Razorpay. */
  billedBy: string;
};

/** The round JR mark from /public/brand-jr.svg (circles and filled paths), drawn as vectors. */
async function logoShapes() {
  try {
    const svg = await readFile(path.join(process.cwd(), "public", "brand-jr.svg"), "utf8");
    const attr = (tag: string, name: string) => new RegExp(`${name}="([^"]+)"`).exec(tag)?.[1];
    const colour = (hex: string | undefined) => {
      const m = /^#([0-9a-f]{6})$/i.exec(hex ?? "");
      if (!m) return undefined;
      const n = parseInt(m[1], 16);
      return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    };
    const circles = [...svg.matchAll(/<circle[^>]*>/g)].map(([t]) => ({
      cx: Number(attr(t, "cx")),
      cy: Number(attr(t, "cy")),
      r: Number(attr(t, "r")),
      fill: colour(attr(t, "fill")),
      stroke: colour(attr(t, "stroke")),
      strokeWidth: Number(attr(t, "stroke-width") ?? 0),
    }));
    const paths = [...svg.matchAll(/<path[^>]*>/g)].map(([t]) => ({ d: attr(t, "d") ?? "", fill: colour(attr(t, "fill")) ?? black }));
    return { circles, paths };
  } catch {
    return null;
  }
}

export async function renderInvoicePdf({ invoice, orderSeq, orderDate, paymentMethod, paymentReference, shipTo, shop, billedBy }: Input) {
  const number = invoiceNumber(invoice.seq);
  const sellerName = (shop.legalName || site.name).toUpperCase();
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Tax invoice ${number}`);
  pdf.setAuthor(sellerName);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const boldItalic = await pdf.embedFont(StandardFonts.HelveticaBoldOblique);
  const logo = await logoShapes();

  const W = 595.28;
  const H = 841.89;
  const L = 28;
  const R = W - 28;
  const TOP = H - 28;
  const BOTTOM = 40;

  type Opts = { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; align?: "left" | "right" | "center"; width?: number };
  const clean = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, "?");
  const text = (p: PDFPage, s: string, x: number, y: number, o: Opts = {}) => {
    const size = o.size ?? 8;
    const font = o.font ?? regular;
    const t = clean(s);
    const w = font.widthOfTextAtSize(t, size);
    const tx = o.align === "right" ? x + (o.width ?? 0) - w : o.align === "center" ? x + ((o.width ?? 0) - w) / 2 : x;
    p.drawText(t, { x: tx, y, size, font, color: o.color ?? black });
  };
  const wrap = (s: string, width: number, size = 8, font = regular) => {
    const out: string[] = [];
    let cur = "";
    for (const w of clean(s).split(/\s+/).filter(Boolean)) {
      const next = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > width && cur) {
        out.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) out.push(cur);
    return out;
  };
  /** Splits at the comma that best evens out two lines (letterhead style); wraps normally if that isn't enough. */
  const balanced = (s: string, width: number, size: number, font: PDFFont) => {
    const t = clean(s).trim();
    if (font.widthOfTextAtSize(t, size) <= width) return [t];
    const parts = t.split(/,\s*/);
    let best: string[] | null = null;
    for (let i = 1; i < parts.length; i++) {
      const pair = [`${parts.slice(0, i).join(", ")},`, parts.slice(i).join(", ")];
      const widest = Math.max(...pair.map((l) => font.widthOfTextAtSize(l, size)));
      if (widest <= width && (!best || widest < Math.max(...best.map((l) => font.widthOfTextAtSize(l, size))))) best = pair;
    }
    return best ?? wrap(t, width, size, font);
  };
  const hline = (p: PDFPage, y: number, x1 = L, x2 = R, thickness = 0.8) => p.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color: black });
  const vline = (p: PDFPage, x: number, y1: number, y2: number, thickness = 0.8) => p.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness, color: black });

  const b = invoice.billedTo;
  const registeredBuyer = Boolean(b.gstin);

  /** Seller header and the billed-to / invoice details boxes. Returns the y where the item table starts. */
  const drawHeader = (p: PDFPage, pageNo: number) => {
    let y = TOP - 13;
    text(p, `GSTIN : ${shop.gstin || "-"}`, L + 6, y, { size: 9.5, font: bold });
    text(p, pageNo === 1 ? "Original Copy" : `Original Copy (page ${pageNo})`, L, y, { size: 10, font: bold, align: "right", width: R - L - 8 });
    y -= 12;
    // Only a buyer registered for GST can claim input tax credit on this invoice.
    if (!registeredBuyer) text(p, "( This copy does not entitle the holder to claim Input Tax Credit )", L, y, { size: 7.5, font: bold, align: "center", width: R - L });

    const logoSize = 74;
    const lx = L + 6;
    const ly = TOP - 22;
    if (logo) {
      const s = logoSize / 1000;
      for (const c of logo.circles) {
        p.drawCircle({ x: lx + c.cx * s, y: ly - c.cy * s, size: c.r * s, ...(c.fill ? { color: c.fill } : {}), ...(c.stroke ? { borderColor: c.stroke, borderWidth: c.strokeWidth * s } : {}) });
      }
      for (const path of logo.paths) p.drawSvgPath(path.d, { x: lx, y: ly, scale: s, color: path.fill });
    }

    y = TOP - 42;
    text(p, sellerName, L, y, { size: 17, font: bold, align: "center", width: R - L });
    y -= 15;
    const place = [shop.city, shop.postalCode ? shop.postalCode.replace(/^(\d{3})(\d{3})$/, "$1 $2") : ""].filter(Boolean).join(" - ");
    const addressLines = [...balanced(shop.address, 330, 10, bold), ...(place ? [`${place}.`] : [])];
    for (const l of addressLines) {
      text(p, l, L, y, { size: 10, font: bold, align: "center", width: R - L });
      y -= 12;
    }
    if (shop.phone) {
      text(p, `Mobile : ${shop.phone}.`, L, y, { size: 8, font: bold, align: "center", width: R - L });
      y -= 10;
    }
    const headerBottom = Math.min(y - 4, TOP - 22 - logoSize - 6);
    hline(p, headerBottom);

    // Billed to (left) and invoice details (right).
    const mid = L + (R - L) * 0.495;
    let by = headerBottom - 12;
    text(p, "Billed to :", L + 6, by, { size: 8, font: boldItalic });
    by -= 12;
    for (const l of wrap((b.companyName ?? b.name).toUpperCase(), mid - L - 12, 8.5, bold)) {
      text(p, l, L + 6, by, { size: 8.5, font: bold });
      by -= 11;
    }
    const addr = [
      b.companyName ? b.name : "",
      shipTo.line1,
      shipTo.line2 ?? "",
      shipTo.landmark ? `Near ${shipTo.landmark.replace(/^near\s+/i, "")}` : "",
      `${shipTo.city}, ${shipTo.state} - ${shipTo.postalCode}`,
    ].filter(Boolean);
    for (const l of addr.flatMap((l) => wrap(l, mid - L - 12, 8))) {
      text(p, l, L + 6, by, { size: 8, color: grey });
      by -= 10;
    }
    by -= 6;
    text(p, "Mobile No", L + 6, by, { size: 8, font: bold });
    text(p, `:  ${shipTo.phone}`, L + 52, by, { size: 8, font: bold });
    by -= 11;

    const meta: [string, string][] = [
      ["Invoice No.", number],
      ["Dated", dated(new Date(invoice.sentAt))],
      ["Order No.", `${orderNumber(orderSeq)} (${part(orderDate, { day: "2-digit", month: "2-digit", year: "numeric" }).replaceAll("/", "-")})`],
      ["Payment", `${paymentLabel[paymentMethod] ?? paymentMethod} - Paid`],
      ...(paymentReference ? ([["Reference", paymentReference]] as [string, string][]) : []),
      ["Place of Supply", shipTo.state],
    ];
    let my = headerBottom - 12;
    for (const [k, v] of meta) {
      text(p, k, mid + 6, my, { size: 8, font: bold });
      const lines = wrap(v, R - mid - 92, 8, bold);
      lines.forEach((l, i) => text(p, `${i === 0 ? ": " : "  "}${l}`, mid + 76, my - i * 10, { size: 8, font: bold }));
      my -= 10 * lines.length + 3;
    }
    const boxBottom = Math.min(by, my) - 6;
    vline(p, mid, headerBottom, boxBottom);
    hline(p, boxBottom);

    // "TAX INVOICE" band
    text(p, "TAX INVOICE", L, boxBottom - 15, { size: 8.5, font: bold, align: "center", width: R - L });
    hline(p, boxBottom - 22);
    return boxBottom - 22;
  };

  // Item table columns, widths after the template (they add up to R - L).
  const colW = [24, 261, 33, 46, 63, 39, 73];
  const colX = colW.reduce<number[]>((xs, w, i) => [...xs, i === 0 ? L : xs[i - 1] + colW[i - 1]], []);
  const heads = ["S.N.", "Particulars", "Qty.", "Rate", "Taxable Amt.", "GST (%)", "Amount (Rs.)"];
  const drawColumns = (p: PDFPage, top: number, bottom: number) => {
    heads.forEach((h, i) => text(p, h, colX[i], top - 14, { size: 7.5, font: bold, align: "center", width: colW[i] }));
    hline(p, top - 21);
    for (let i = 1; i < colX.length; i++) vline(p, colX[i], top, bottom);
  };

  // Bottom block heights, so the table on the last page leaves room for them.
  const termsLines = shop.invoiceTerms.flatMap((t, i) => wrap(`${i + 1}. ${t}`, R - L - 12, 7.5).map((l, j) => (j === 0 ? l : `    ${l}`)));
  const rates = [...new Set(invoice.lines.map((l) => l.gstRateBp))].sort((a, z) => a - z);
  const byRate = rates.map((bp) => {
    const ls = invoice.lines.filter((l) => l.gstRateBp === bp);
    const taxable = ls.reduce((s, l) => s + l.taxablePaise, 0);
    const gst = ls.reduce((s, l) => s + l.gstPaise, 0);
    const cgst = Math.floor(gst / 2);
    return { bp, taxable, gst, cgst, sgst: gst - cgst };
  });
  const totalsH = 22 + (invoice.intraState ? 30 : 18) + (invoice.shippingPaise ? 12 : 0) + 22;
  const summaryH = 30 + 12 * byRate.length + 16;
  const termsH = 36 + 10 * termsLines.length;
  const footH = totalsH + summaryH + termsH;

  // Item rows
  const rows = invoice.lines.map((l, i) => {
    const name = wrap(l.name.toUpperCase(), colW[1] - 6, 7.5);
    return { l, i, name, h: 10 * name.length + 1 };
  });

  // Rows first; each page's column dividers are drawn once its table bottom is known.
  const pages: { page: PDFPage; top: number; bottom: number }[] = [];
  const startPage = (p: PDFPage, top: number) => pages.push({ page: p, top, bottom: BOTTOM });
  let page = pdf.addPage([W, H]);
  let pageNo = 1;
  let tableTop = drawHeader(page, pageNo);
  startPage(page, tableTop);
  let y = tableTop - 33;

  const remaining = (idx: number) => rows.slice(idx).reduce((s, r) => s + r.h, 0);
  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    // Leave room for the totals on the page that ends the table.
    const fitsWithFooter = y - remaining(idx) >= BOTTOM + footH;
    if (y - r.h < BOTTOM + (fitsWithFooter ? footH : 0)) {
      page = pdf.addPage([W, H]);
      pageNo++;
      tableTop = drawHeader(page, pageNo);
      startPage(page, tableTop);
      y = tableTop - 33;
    }
    const { l, i, name } = r;
    const unitTaxable = Math.round(l.taxablePaise / l.quantity);
    text(page, String(i + 1), colX[0], y, { size: 7.5, align: "right", width: colW[0] - 3 });
    name.forEach((n, j) => text(page, n, colX[1] + 3, y - j * 10, { size: 7.5 }));
    text(page, qty(l.quantity), colX[2], y, { size: 7.5, align: "right", width: colW[2] - 3 });
    text(page, money(l.unitPricePaise), colX[3], y, { size: 7.5, align: "right", width: colW[3] - 3 });
    text(page, money(unitTaxable), colX[4], y, { size: 7.5, align: "right", width: colW[4] - 3 });
    text(page, pct(l.gstRateBp), colX[5] + 4, y, { size: 7.5 });
    text(page, money(l.taxablePaise), colX[6], y, { size: 7.5, align: "right", width: colW[6] - 4 });
    y -= r.h;
  }
  const last = pages[pages.length - 1];
  last.bottom = BOTTOM + footH;
  for (const pg of pages) {
    drawColumns(pg.page, pg.top, pg.bottom);
    if (pg !== last) {
      hline(pg.page, pg.bottom);
      text(pg.page, "Continued on next page", L, pg.bottom - 11, { size: 7.5, color: grey, align: "right", width: R - L - 6 });
    }
  }

  // Totals, under the table on the last page.
  const amountX = colX[6];
  let ty = last.bottom;
  hline(page, ty);
  const totalRow = (label: string, value: string, yy: number, strong = false) => {
    text(page, label, L, yy, { size: 8, font: bold, align: "right", width: amountX - L - 12 });
    text(page, value, amountX, yy, { size: strong ? 9 : 8, font: strong ? bold : regular, align: "right", width: colW[6] - 6 });
  };
  const sumC = byRate.reduce((s, r) => s + r.cgst, 0);
  const sumS = byRate.reduce((s, r) => s + r.sgst, 0);
  const totalQty = invoice.lines.reduce((s, l) => s + l.quantity, 0);
  totalRow("Sub Total", money(invoice.taxablePaise), ty - 14);
  hline(page, ty - 22, amountX, R);
  let ry = ty - 36;
  if (invoice.intraState) {
    totalRow("SGST Total", money(sumS), ry);
    totalRow("CGST Total", money(sumC), ry - 12);
    ry -= 24;
  } else {
    totalRow("IGST Total", money(invoice.gstPaise), ry);
    ry -= 12;
  }
  if (invoice.shippingPaise) {
    totalRow("Delivery Charges", money(invoice.shippingPaise), ry);
    ry -= 12;
  }
  const grandTop = ty - totalsH + 22;
  vline(page, amountX, ty, grandTop - 22);
  hline(page, grandTop);
  text(page, `Total Qty.:  ${qty(totalQty)}`, colX[2] - 60, grandTop - 15, { size: 8.5, font: bold });
  totalRow("Grand Total  Rs.", money(invoice.totalPaise), grandTop - 15, true);
  ty = grandTop - 22;
  hline(page, ty);

  // Tax summary by rate, and the amount in words.
  const sx = [L + 6, L + 50, L + 118, L + 176, L + 234];
  const sw = [40, 62, 52, 52, 56];
  const sHeads = invoice.intraState ? ["Tax Rate", "Taxable Amt.", "CGST Amt.", "SGST Amt.", "Total Tax"] : ["Tax Rate", "Taxable Amt.", "IGST Amt.", "", "Total Tax"];
  let yy = ty - 13;
  sHeads.forEach((h, i) => h && text(page, h, sx[i], yy, { size: 7, font: bold, align: i === 0 ? "left" : "right", width: sw[i] }));
  hline(page, yy - 3, L + 6, sx[4] + sw[4], 0.5);
  yy -= 12;
  for (const r of byRate) {
    const cells = invoice.intraState ? [pct(r.bp), money(r.taxable), money(r.cgst), money(r.sgst), money(r.gst)] : [pct(r.bp), money(r.taxable), money(r.gst), "", money(r.gst)];
    cells.forEach((c, i) => c && text(page, c, sx[i], yy, { size: 7.5, align: i === 0 ? "left" : "right", width: sw[i] }));
    yy -= 12;
  }
  text(page, "Rupees", L + 6, yy - 2, { size: 8, font: bold });
  text(page, amountInWords(invoice.totalPaise), L + 42, yy - 2, { size: 10, font: bold });
  ty -= summaryH;
  hline(page, ty);


  // Terms across the full width, with who billed it.
  const termsBottom = ty - termsH;
  text(page, "Terms & Condition", L + 6, ty - 12, { size: 8, font: bold });
  text(page, "E.&.O.E", L, ty - 12, { size: 8, font: bold, align: "right", width: R - L - 8 });
  termsLines.forEach((l, i) => text(page, l, L + 6, ty - 24 - i * 10, { size: 7.5 }));
  text(page, `Billed By :  ${billedBy}`, L, termsBottom + 7, { size: 8, font: bold, align: "right", width: R - L - 8 });

  // Frame every page; the last one ends under the terms.
  for (const pg of pages) {
    const bottom = pg === last ? termsBottom : pg.bottom - 18;
    pg.page.drawRectangle({ x: L, y: bottom, width: R - L, height: TOP - bottom, borderColor: black, borderWidth: 0.8 });
    text(pg.page, "This is a computer-generated invoice.", L, bottom - 11, { size: 6.5, color: grey });
  }

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

/** Indian-system words for the rupee part: 1525000 → "Fifteen Thousand Two Hundred Fifty". */
function rupeeWords(rupees: number) {
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
  return parts.join(" ") || "Zero";
}

/** As printed after "Rupees": 1525040 → "Fifteen Thousand Two Hundred Fifty and Forty Paise Only". */
export function amountInWords(paise: number) {
  const p = paise % 100;
  return `${rupeeWords(Math.floor(paise / 100))}${p ? ` and ${twoDigits(p)} Paise` : ""} Only`;
}

/** 130026.40 → "One Lakh Thirty Thousand Twenty Six Rupees and Forty Paise Only". */
export function inWords(paise: number) {
  const p = paise % 100;
  return `${rupeeWords(Math.floor(paise / 100))} Rupees${p ? ` and ${twoDigits(p)} Paise` : ""} Only`;
}
