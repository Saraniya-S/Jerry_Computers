import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";
import { site } from "@/config/site";
import { formatPaise, invoiceNumber, orderNumber } from "@/lib/money";
import type { Invoice, OtpPurpose } from "./db/schema";

const globalForMail = globalThis as unknown as { jerryMail?: Transporter };
const transport =
  globalForMail.jerryMail ??
  nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
if (process.env.NODE_ENV !== "production") globalForMail.jerryMail = transport;

const subjects: Record<OtpPurpose, string> = {
  register: "Verify your Jerry Computers account",
  login: "Your Jerry Computers sign-in code",
};

const intros: Record<OtpPurpose, string> = {
  register: "Use this code to verify your email and finish creating your account.",
  login: "Use this code to finish signing in.",
};

export async function sendOtpEmail({ to, name, code, purpose }: { to: string; name: string; code: string; purpose: OtpPurpose }) {
  const text = `Hi ${name},\n\n${intros[purpose]}\n\n${code}\n\nThe code expires in 10 minutes. If you didn't request it, you can ignore this email.\n\nJerry Computers`;
  const html = `<!doctype html>
<html><body style="margin:0;background:#f7f9f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1938">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e2ebe0;border-radius:20px;padding:32px">
        <tr><td style="font-size:15px;font-weight:600;color:#372f63">Jerry Computers</td></tr>
        <tr><td style="padding-top:24px;font-size:15px;line-height:1.6">Hi ${escapeHtml(name)},<br>${intros[purpose]}</td></tr>
        <tr><td style="padding:24px 0"><div style="font-size:32px;font-weight:700;letter-spacing:10px;text-align:center;background:#eef4ec;border-radius:14px;padding:18px 0;color:#241e47">${code}</div></td></tr>
        <tr><td style="font-size:13px;line-height:1.6;color:#555170">The code expires in 10 minutes. If you didn't request it, you can ignore this email.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  await transport.sendMail({ from: env.MAIL_FROM, to, subject: subjects[purpose], text, html });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Emails the customer their paid invoice as a PDF attachment, with a short summary in the body. */
export async function sendInvoiceEmail({
  invoice,
  orderSeq,
  customerName,
  pdf,
}: {
  invoice: Invoice;
  orderSeq: number;
  customerName: string;
  pdf: Uint8Array;
}) {
  const inv = invoiceNumber(invoice.seq);
  const ord = orderNumber(orderSeq);
  const total = formatPaise(invoice.totalPaise);
  const intro = `Thanks for your payment. Your GST invoice ${inv} for order ${ord} is attached as a PDF.`;
  const text = `Hi ${customerName},\n\n${intro}\n\nTotal paid: ${total}\n\nWe'll email you again when your order ships.\n\n${site.name}`;
  const html = `<!doctype html>
<html><body style="margin:0;background:#f7f9f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1938">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border:1px solid #e2ebe0;border-radius:20px;padding:32px">
      <tr><td style="font-size:15px;font-weight:600;color:#372f63">${escapeHtml(site.name)}</td></tr>
      <tr><td style="padding-top:20px;font-size:15px;line-height:1.6">Hi ${escapeHtml(customerName)},<br>${intro}</td></tr>
      <tr><td style="padding:20px 0"><div style="background:#eef4ec;border-radius:14px;padding:16px 18px;font-size:14px;line-height:1.7">
        <div style="color:#555170">Invoice <strong style="color:#1c1938">${inv}</strong></div>
        <div style="color:#555170">Order <strong style="color:#1c1938">${ord}</strong></div>
        <div style="color:#555170">Total paid <strong style="color:#1c1938;font-size:16px">${total}</strong></div>
      </div></td></tr>
      <tr><td style="font-size:13px;line-height:1.6;color:#555170">You can also download it any time from My account → Orders. We'll email you again when your order ships.</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  await transport.sendMail({
    from: env.MAIL_FROM,
    to: invoice.sentTo,
    subject: `Invoice ${inv} for order ${ord} — ${site.name}`,
    text,
    html,
    attachments: [{ filename: `${inv}.pdf`, content: Buffer.from(pdf), contentType: "application/pdf" }],
  });
}

const roleNames: Record<string, string> = { admin: "an admin", ecommerce_staff: "e-commerce staff", engineer: "a service engineer", customer: "a customer" };

function linkEmail({ heading, body, cta, link, footnote }: { heading: string; body: string; cta: string; link: string; footnote: string }) {
  return `<!doctype html>
<html><body style="margin:0;background:#f7f9f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1938">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border:1px solid #e2ebe0;border-radius:20px;padding:32px">
      <tr><td style="font-size:15px;font-weight:600;color:#372f63">${escapeHtml(site.name)}</td></tr>
      <tr><td style="padding-top:20px;font-size:20px;font-weight:600">${escapeHtml(heading)}</td></tr>
      <tr><td style="padding-top:10px;font-size:15px;line-height:1.6;color:#555170">${body}</td></tr>
      <tr><td style="padding:24px 0"><a href="${link}" style="display:inline-block;background:#372f63;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:999px">${escapeHtml(cta)}</a></td></tr>
      <tr><td style="font-size:12px;line-height:1.6;color:#8b88a0">${footnote}<br><span style="word-break:break-all">${link}</span></td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export async function sendInviteEmail({ to, name, role, invitedBy, link }: { to: string; name: string; role: string; invitedBy: string; link: string }) {
  const body = `Hi ${escapeHtml(name)}, ${escapeHtml(invitedBy)} has added you to ${escapeHtml(site.name)} as ${roleNames[role] ?? role}. Set a password to start using your account.`;
  await transport.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: `You've been invited to ${site.name}`,
    text: `Hi ${name},\n\n${invitedBy} has added you to ${site.name} as ${roleNames[role] ?? role}. Set your password here (the link works for 3 days):\n\n${link}`,
    html: linkEmail({ heading: "Set up your account", body, cta: "Set my password", link, footnote: "The link works once and expires in 3 days." }),
  });
}

export async function sendPasswordResetEmail({ to, name, link }: { to: string; name: string; link: string }) {
  const body = `Hi ${escapeHtml(name)}, we got a request to reset your password. If it wasn't you, ignore this email and nothing will change.`;
  await transport.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: `Reset your ${site.name} password`,
    text: `Hi ${name},\n\nReset your password here (the link works for 1 hour):\n\n${link}\n\nIf you didn't ask for this, ignore this email.`,
    html: linkEmail({ heading: "Reset your password", body, cta: "Choose a new password", link, footnote: "The link works once and expires in 1 hour." }),
  });
}
