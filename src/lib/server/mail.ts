import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";
import type { OtpPurpose } from "./db/schema";

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
