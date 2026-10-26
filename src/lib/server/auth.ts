import "server-only";
import { redirect } from "next/navigation";
import type { User, UserRole } from "./db/schema";
import { getSessionUser } from "./session";

/** Where each role lands after signing in. Only the customer area exists so far. */
export const roleHome: Record<UserRole, string> = {
  customer: "/account",
  engineer: "/engineer",
  ecommerce_staff: "/staff",
  admin: "/admin",
};

/** Narrow, client-safe view of the signed-in user. */
export type Viewer = {
  id: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  emailVerifiedAt: Date | null;
  hasPassword: boolean;
  hasGoogle: boolean;
  createdAt: Date;
};

export function toViewer(u: User): Viewer {
  return {
    id: u.id,
    role: u.role,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phone: u.phone,
    emailVerifiedAt: u.emailVerifiedAt,
    hasPassword: Boolean(u.passwordHash),
    hasGoogle: Boolean(u.googleSub),
    createdAt: u.createdAt,
  };
}

/** The signed-in, verified customer. Anyone else is sent to sign in or to their own area. */
export async function requireCustomer(): Promise<Viewer> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account");
  if (user.role !== "customer") redirect(roleHome[user.role]);
  return toViewer(user);
}

/** On /login and /register: a signed-in user goes straight to their area. */
export async function redirectIfSignedIn() {
  const user = await getSessionUser();
  if (user) redirect(roleHome[user.role]);
}

/** Only same-site paths are allowed as post-login destinations. */
export function safeNext(next: unknown, fallback: string) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
