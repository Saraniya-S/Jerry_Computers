"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { roleHome, safeNext } from "@/lib/server/auth";
import { dummyPasswordHash, hashPassword, verifyPassword } from "@/lib/server/crypto";
import { db, schema } from "@/lib/server/db";
import { issueChallenge, OtpError, resendChallenge, verifyChallenge } from "@/lib/server/otp";
import { clearChallengeCookie, createSession, deleteSession, getChallengeCookie, setChallengeCookie } from "@/lib/server/session";

export type FormState = {
  error?: string;
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  /** Echoed back so fields keep what was typed (never the password). */
  values?: Record<string, string>;
};

const MAX_FAILED_LOGINS = 10;
const LOCK_MS = 15 * 60 * 1000;

const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);

const registerSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(60),
  lastName: z.string().trim().min(1, "Enter your last name.").max(60),
  email,
  password: z.string().min(8, "Use at least 8 characters.").max(128, "Use 128 characters or fewer."),
  terms: z.literal("on", { error: "Please accept the Terms and Privacy policy." }),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(128),
});

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

function sendFailure(err: unknown): FormState {
  if (err instanceof OtpError) return { error: err.message };
  console.error("[auth] could not send verification email", err);
  return { error: "We couldn't send the verification email. Please try again in a moment." };
}

/** Customer self-registration. Staff accounts are created by admins. */
export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const values = { firstName: raw.firstName ?? "", lastName: raw.lastName ?? "", email: raw.email ?? "" };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const input = parsed.data;

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, input.email)).limit(1);
  if (existing && (existing.emailVerifiedAt || existing.role !== "customer")) {
    return { fieldErrors: { email: "An account with this email already exists. Log in instead." }, values };
  }

  const passwordHash = await hashPassword(input.password);
  // An unverified sign-up can be retried: nobody has proved they own this email yet.
  const [user] = existing
    ? await db
        .update(schema.users)
        .set({ firstName: input.firstName, lastName: input.lastName, passwordHash })
        .where(eq(schema.users.id, existing.id))
        .returning()
    : await db
        .insert(schema.users)
        .values({ firstName: input.firstName, lastName: input.lastName, email: input.email, passwordHash, role: "customer" })
        .returning();

  let challenge;
  try {
    challenge = await issueChallenge(user, "register");
  } catch (err) {
    return { ...sendFailure(err), values };
  }
  await setChallengeCookie(challenge.id, challenge.expiresAt);
  redirect(`/verify?next=${encodeURIComponent(safeNext(raw.next, "/account"))}`);
}

/** Password check for every role, then a one-time code by email. */
export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const values = { email: raw.email ?? "" };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const input = parsed.data;

  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, input.email)).limit(1);
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    return { error: "Too many failed attempts. Try again in 15 minutes.", values };
  }

  // Always run a hash comparison so response time doesn't reveal whether the email exists.
  const ok = await verifyPassword(input.password, user?.passwordHash ?? (await dummyPasswordHash()));
  if (!user || !user.passwordHash || !ok) {
    if (user) {
      const failed = user.failedLogins + 1;
      await db
        .update(schema.users)
        .set(
          failed >= MAX_FAILED_LOGINS
            ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) }
            : { failedLogins: sql`${schema.users.failedLogins} + 1` },
        )
        .where(eq(schema.users.id, user.id));
    }
    return { error: "That email and password don't match an account.", values };
  }

  await db.update(schema.users).set({ failedLogins: 0, lockedUntil: null }).where(eq(schema.users.id, user.id));

  let challenge;
  try {
    // A customer who never finished registering verifies their email on the way in.
    challenge = await issueChallenge(user, user.emailVerifiedAt ? "login" : "register");
  } catch (err) {
    return { ...sendFailure(err), values };
  }
  await setChallengeCookie(challenge.id, challenge.expiresAt);
  const remember = raw.remember === "on" ? "" : "&remember=0";
  redirect(`/verify?next=${encodeURIComponent(safeNext(raw.next, roleHome[user.role]))}${remember}`);
}

export async function verifyCode(_: FormState, formData: FormData): Promise<FormState> {
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { fieldErrors: { code: "Enter the 6-digit code from the email." } };

  const challengeId = await getChallengeCookie();
  if (!challengeId) return { error: "This sign-in has expired. Start again." };

  let result;
  try {
    result = await verifyChallenge(challengeId, code);
  } catch (err) {
    if (err instanceof OtpError) return { fieldErrors: { code: err.message } };
    throw err;
  }

  const now = new Date();
  await db
    .update(schema.users)
    .set({ lastLoginAt: now, ...(result.user.emailVerifiedAt ? {} : { emailVerifiedAt: now }) })
    .where(eq(schema.users.id, result.user.id));
  await clearChallengeCookie();
  await createSession(result.user.id, { remember: formData.get("remember") !== "0" });

  const home = roleHome[result.user.role];
  const next = safeNext(formData.get("next"), home);
  // Customers can't be sent into staff areas and vice versa.
  redirect(result.user.role === "customer" && next.startsWith("/account") ? next : home);
}

export async function resendCode(): Promise<FormState> {
  const challengeId = await getChallengeCookie();
  if (!challengeId) return { error: "This sign-in has expired. Start again." };
  try {
    const { expiresAt } = await resendChallenge(challengeId);
    await setChallengeCookie(challengeId, expiresAt);
    return { message: "We've sent a new code." };
  } catch (err) {
    return sendFailure(err);
  }
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
