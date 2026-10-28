import { NextResponse } from "next/server";
import { roleHome } from "@/lib/server/auth";
import { getCart } from "@/lib/server/cart";
import { getSessionUser } from "@/lib/server/session";

/**
 * Who is signed in, for client chrome on otherwise static pages (navbar account menu and cart).
 * Returns only what that UI shows.
 */
export async function GET() {
  const user = await getSessionUser();
  const body = !user
    ? { viewer: null, cart: [] }
    : {
        viewer: {
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          home: roleHome[user.role],
          onboarded: Boolean(user.onboardedAt),
        },
        cart: user.role === "customer" ? await getCart(user.id) : [],
      };
  return NextResponse.json(body, { headers: { "cache-control": "private, no-store" } });
}
