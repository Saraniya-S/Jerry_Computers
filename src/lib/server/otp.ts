import "server-only";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { generateOtp, hashOtp, safeEqualHex } from "./crypto";
import { db, schema } from "./db";
import type { OtpPurpose, User } from "./db/schema";
import { sendOtpEmail } from "./mail";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_SENDS_PER_CHALLENGE = 5;
const OTP_MAX_CHALLENGES_PER_HOUR = 6;

export class OtpError extends Error {}

/** Emails a fresh code and returns the challenge. Earlier open challenges for the same purpose are closed. */
export async function issueChallenge(user: Pick<User, "id" | "email" | "firstName">, purpose: OtpPurpose) {
  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(schema.otpChallenges)
    .where(and(eq(schema.otpChallenges.userId, user.id), gt(schema.otpChallenges.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
  if (recent >= OTP_MAX_CHALLENGES_PER_HOUR) throw new OtpError("Too many codes requested. Try again in an hour.");

  await db
    .update(schema.otpChallenges)
    .set({ consumedAt: new Date() })
    .where(and(eq(schema.otpChallenges.userId, user.id), eq(schema.otpChallenges.purpose, purpose), isNull(schema.otpChallenges.consumedAt)));

  const id = crypto.randomUUID();
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await db.insert(schema.otpChallenges).values({ id, userId: user.id, purpose, codeHash: hashOtp(id, code), expiresAt });
  await sendOtpEmail({ to: user.email, name: user.firstName, code, purpose });
  return { id, expiresAt };
}

async function openChallenge(challengeId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(challengeId)) return null;
  const [row] = await db
    .select({ challenge: schema.otpChallenges, user: schema.users })
    .from(schema.otpChallenges)
    .innerJoin(schema.users, eq(schema.users.id, schema.otpChallenges.userId))
    .where(and(eq(schema.otpChallenges.id, challengeId), isNull(schema.otpChallenges.consumedAt)))
    .limit(1);
  return row ?? null;
}

/** Public details of a pending challenge for the code screen, or null if it is gone. */
export async function describeChallenge(challengeId: string) {
  const row = await openChallenge(challengeId);
  if (!row || row.challenge.expiresAt < new Date()) return null;
  return {
    purpose: row.challenge.purpose,
    email: row.user.email,
    resendAvailableAt: new Date(row.challenge.lastSentAt.getTime() + OTP_RESEND_COOLDOWN_MS),
  };
}

/** Checks a code. Returns the user on success; throws OtpError with a message for the form otherwise. */
export async function verifyChallenge(challengeId: string, code: string) {
  const row = await openChallenge(challengeId);
  if (!row) throw new OtpError("This code is no longer valid. Start again.");
  const { challenge, user } = row;
  if (challenge.expiresAt < new Date()) throw new OtpError("This code has expired. Send a new one.");
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) throw new OtpError("Too many wrong attempts. Send a new code.");

  // Count the attempt before comparing so parallel guesses can't skip the limit.
  const [updated] = await db
    .update(schema.otpChallenges)
    .set({ attempts: sql`${schema.otpChallenges.attempts} + 1` })
    .where(and(eq(schema.otpChallenges.id, challenge.id), sql`${schema.otpChallenges.attempts} < ${OTP_MAX_ATTEMPTS}`))
    .returning({ attempts: schema.otpChallenges.attempts });
  if (!updated) throw new OtpError("Too many wrong attempts. Send a new code.");

  if (!safeEqualHex(hashOtp(challenge.id, code), challenge.codeHash)) {
    const left = OTP_MAX_ATTEMPTS - updated.attempts;
    throw new OtpError(left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong attempts. Send a new code.");
  }

  const [consumed] = await db
    .update(schema.otpChallenges)
    .set({ consumedAt: new Date() })
    .where(and(eq(schema.otpChallenges.id, challenge.id), isNull(schema.otpChallenges.consumedAt)))
    .returning({ id: schema.otpChallenges.id });
  if (!consumed) throw new OtpError("This code was already used. Start again.");

  return { user, purpose: challenge.purpose };
}

/** Sends a new code on the same challenge, after a cooldown. */
export async function resendChallenge(challengeId: string) {
  const row = await openChallenge(challengeId);
  if (!row) throw new OtpError("This sign-in has expired. Start again.");
  const { challenge, user } = row;
  const wait = challenge.lastSentAt.getTime() + OTP_RESEND_COOLDOWN_MS - Date.now();
  if (wait > 0) throw new OtpError(`You can request a new code in ${Math.ceil(wait / 1000)} seconds.`);
  if (challenge.sendCount >= OTP_MAX_SENDS_PER_CHALLENGE) throw new OtpError("Too many codes requested. Start again.");

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await db
    .update(schema.otpChallenges)
    .set({
      codeHash: hashOtp(challenge.id, code),
      attempts: 0,
      sendCount: challenge.sendCount + 1,
      lastSentAt: new Date(),
      expiresAt,
    })
    .where(eq(schema.otpChallenges.id, challenge.id));
  await sendOtpEmail({ to: user.email, name: user.firstName, code, purpose: challenge.purpose });
  return { expiresAt };
}
