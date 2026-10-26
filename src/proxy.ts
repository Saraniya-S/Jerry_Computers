import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic check only: no session cookie on a customer page means straight to sign-in.
 * The real check (session in the database, role) happens in each page via requireCustomer().
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("jc_session")) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/account", "/account/:path*"],
};
