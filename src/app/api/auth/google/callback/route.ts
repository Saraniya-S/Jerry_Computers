import { NextResponse, type NextRequest } from "next/server";
import { returnTo } from "@/lib/server/auth";
import { googleEnabled, siteUrl } from "@/lib/server/env";
import { GOOGLE_STATE_COOKIE, googleProfile, googleSignIn } from "@/lib/server/google";
import { createSession } from "@/lib/server/session";

/** Finishes Google sign-in for customers, e-commerce staff and admins (googleSignIn has the rules). */
export async function GET(request: NextRequest) {
  const fail = (code: string) => {
    const res = NextResponse.redirect(siteUrl(`/login?error=${code}`));
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
  const result = await googleSignIn(profile);
  if (!result.ok) return fail(result.code);
  const { user, isNew } = result;

  await createSession(user.id);
  const next = returnTo(user.role, saved.next);
  // New Google sign-ups go through the welcome steps first, then on to where they were going.
  const dest = !user.onboardedAt && isNew ? (next === "/account" ? "/onboarding" : `/onboarding?next=${encodeURIComponent(next)}`) : next;
  const res = NextResponse.redirect(siteUrl(dest));
  res.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/api/auth/google" });
  return res;
}
