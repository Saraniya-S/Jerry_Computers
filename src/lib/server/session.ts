import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import { randomToken, sha256 } from "./crypto";
import { db, schema } from "./db";

export const SESSION_COOKIE = "jc_session";
const SESSION_DAYS = 30;
/** Without "keep me signed in": a browser-session cookie, and the server forgets it after a day. */
const SHORT_SESSION_HOURS = 24;

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/** Starts a database session and sets its cookie. The cookie holds a random token; the DB keeps its hash. */
export async function createSession(userId: string, { remember = true }: { remember?: boolean } = {}) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + (remember ? SESSION_DAYS * 24 : SHORT_SESSION_HOURS) * 60 * 60 * 1000);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await db.insert(schema.sessions).values({ id: sha256(token), userId, expiresAt, userAgent });
  (await cookies()).set(SESSION_COOKIE, token, remember ? { ...cookieBase, expires: expiresAt } : cookieBase);
}

/** The signed-in user for this request, or null. Deduplicated per request. */
export const getSessionUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // The expiry check below compares against the current time, so it must run per request.
  await connection();
  const [row] = await db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return row?.user ?? null;
});

export async function deleteSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  store.delete(SESSION_COOKIE);
}

/* Pending one-time-code challenge between the password step and the code step. */

export const CHALLENGE_COOKIE = "jc_otp";

export async function setChallengeCookie(challengeId: string, expiresAt: Date) {
  (await cookies()).set(CHALLENGE_COOKIE, challengeId, { ...cookieBase, expires: expiresAt });
}

export async function getChallengeCookie() {
  return (await cookies()).get(CHALLENGE_COOKIE)?.value ?? null;
}

export async function clearChallengeCookie() {
  (await cookies()).delete(CHALLENGE_COOKIE);
}
