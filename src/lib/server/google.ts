import "server-only";
import { createHash } from "node:crypto";
import { eq, or } from "drizzle-orm";
import { randomToken } from "./crypto";
import { db, schema } from "./db";
import type { User } from "./db/schema";
import { env } from "./env";

export const GOOGLE_STATE_COOKIE = "jc_google";
export const googleRedirectUri = () => `${env.APP_URL}/api/auth/google/callback`;

/** Builds Google's consent URL plus the state/PKCE values to keep in a short-lived cookie. */
export function googleAuthRequest(next: string) {
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url, cookie: JSON.stringify({ state, verifier, next }) };
}

export type GoogleProfile = { sub: string; email: string; emailVerified: boolean; givenName: string; familyName: string };

/** Exchanges the authorization code and reads the profile from Google's userinfo endpoint. */
export async function googleProfile(code: string, verifier: string): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) throw new Error(`Google token exchange failed: ${tokenRes.status}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${access_token}` },
  });
  if (!infoRes.ok) throw new Error(`Google userinfo failed: ${infoRes.status}`);
  const info = (await infoRes.json()) as { sub: string; email?: string; email_verified?: boolean; given_name?: string; family_name?: string; name?: string };
  if (!info.email) throw new Error("Google account has no email");
  return {
    sub: info.sub,
    email: info.email.toLowerCase(),
    emailVerified: info.email_verified === true,
    givenName: info.given_name ?? info.name ?? info.email.split("@")[0],
    familyName: info.family_name ?? "",
  };
}

/** Roles that may use Google sign-in. Engineers sign in with email and password only. */
const GOOGLE_ROLES = new Set<User["role"]>(["customer", "ecommerce_staff", "admin"]);

export type GoogleSignIn = { ok: true; user: User; isNew: boolean } | { ok: false; code: "google_unverified" | "google_staff" | "google_invite" | "google_mismatch" | "account_disabled" };

/**
 * Decides who a verified Google profile signs in as. Customers are matched by Google id or email,
 * and a new one is created if neither exists. Staff and admins must already have an account (made
 * by an admin, invite accepted) with the same email; their first Google sign-in links that Google
 * account, and only that one is accepted afterwards. Google has verified the email, so no code is needed.
 */
export async function googleSignIn(profile: GoogleProfile): Promise<GoogleSignIn> {
  if (!profile.emailVerified) return { ok: false, code: "google_unverified" };
  const matches = await db
    .select()
    .from(schema.users)
    .where(or(eq(schema.users.googleSub, profile.sub), eq(schema.users.email, profile.email)));
  // The account already linked to this Google id wins over one that merely shares the email.
  const existing = matches.find((u) => u.googleSub === profile.sub) ?? matches[0];
  if (existing && !GOOGLE_ROLES.has(existing.role)) return { ok: false, code: "google_staff" };
  if (existing?.disabledAt) return { ok: false, code: "account_disabled" };

  const now = new Date();
  if (existing && existing.role !== "customer") {
    // Not set up yet: the invite link is how a new team member proves the email and joins.
    if (!existing.passwordHash) return { ok: false, code: "google_invite" };
    if (existing.googleSub && existing.googleSub !== profile.sub) return { ok: false, code: "google_mismatch" };
    const [user] = await db
      .update(schema.users)
      .set({ googleSub: profile.sub, emailVerifiedAt: existing.emailVerifiedAt ?? now, lastLoginAt: now })
      .where(eq(schema.users.id, existing.id))
      .returning();
    return { ok: true, user, isNew: false };
  }

  const [user] = existing
    ? await db
        .update(schema.users)
        .set({
          googleSub: profile.sub,
          emailVerifiedAt: existing.emailVerifiedAt ?? now,
          lastLoginAt: now,
          // An unverified sign-up's password was set by someone who never proved they own this
          // email; drop it so it can't be used to get into the now-verified account.
          ...(existing.emailVerifiedAt ? {} : { passwordHash: null }),
        })
        .where(eq(schema.users.id, existing.id))
        .returning()
    : await db
        .insert(schema.users)
        .values({
          role: "customer",
          firstName: profile.givenName,
          lastName: profile.familyName,
          email: profile.email,
          googleSub: profile.sub,
          emailVerifiedAt: now,
          lastLoginAt: now,
        })
        .returning();
  return { ok: true, user, isNew: !existing };
}
