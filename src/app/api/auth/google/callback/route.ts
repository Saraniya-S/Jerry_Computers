import { eq, or } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { googleEnabled } from "@/lib/server/env";
import { GOOGLE_STATE_COOKIE, googleProfile } from "@/lib/server/google";
import { createSession } from "@/lib/server/session";

/**
 * Finishes Google sign-in. Customers only: Google has verified the email, so no code is needed.
 * Engineers, staff and admins must use email and password.
 */
export async function GET(request: NextRequest) {
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${code}`, request.url));
    res.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/api/auth/google" });
    return res;
  };
  if (!googleEnabled) return fail("google_unavailable");

  const params = request.nextUrl.searchParams;
  let saved: { state: string; verifier: string; next: string } | null = null;
  try {
    saved = JSON.parse(request.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? "null");
  } catch {}
  const code = params.get("code");
  if (!saved || !code || params.get("state") !== saved.state) return fail("google_failed");

  let profile;
  try {
    profile = await googleProfile(code, saved.verifier);
  } catch (err) {
    console.error("[auth] Google sign-in failed", err);
    return fail("google_failed");
  }
  if (!profile.emailVerified) return fail("google_unverified");

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(or(eq(schema.users.googleSub, profile.sub), eq(schema.users.email, profile.email)))
    .limit(1);
  if (existing && existing.role !== "customer") return fail("google_staff");

  const now = new Date();
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

  await createSession(user.id);
  const next = safeNext(saved.next, "/account");
  const res = NextResponse.redirect(new URL(next.startsWith("/account") ? next : "/account", request.url));
  res.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/api/auth/google" });
  return res;
}
