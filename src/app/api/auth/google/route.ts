import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/server/auth";
import { googleEnabled } from "@/lib/server/env";
import { GOOGLE_STATE_COOKIE, googleAuthRequest } from "@/lib/server/google";

/** Starts customer Google sign-in. */
export function GET(request: NextRequest) {
  if (!googleEnabled) return NextResponse.redirect(new URL("/login?error=google_unavailable", request.url));
  const { url, cookie } = googleAuthRequest(safeNext(request.nextUrl.searchParams.get("next"), "/account"));
  const res = NextResponse.redirect(url);
  res.cookies.set(GOOGLE_STATE_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
