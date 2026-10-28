import "server-only";
import { redirect } from "next/navigation";
import type { User, UserRole } from "./db/schema";
import { getSessionUser } from "./session";

/** Where each role lands after signing in. The engineer area isn't built yet. */
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
  customerType: "personal" | "business";
  companyName: string | null;
  gstin: string | null;
  whatsappUpdates: boolean;
  interests: string[];
  onboardedAt: Date | null;
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
    customerType: u.customerType,
    companyName: u.companyName,
    gstin: u.gstin,
    whatsappUpdates: u.whatsappUpdates,
    interests: u.interests,
    onboardedAt: u.onboardedAt,
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

export type Staff = { id: string; role: UserRole; firstName: string; lastName: string; email: string; isSuperAdmin: boolean };

/** A signed-in staff member (admin, e-commerce or engineer) whose role is in `allowed`. */
export async function requireStaff(allowed: UserRole[] = ["admin", "ecommerce_staff"], signInNext?: string): Promise<Staff> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${signInNext ?? (allowed.length === 1 && allowed[0] === "engineer" ? "/engineer" : "/admin")}`);
  if (!allowed.includes(user.role)) redirect(roleHome[user.role]);
  return { id: user.id, role: user.role, firstName: user.firstName, lastName: user.lastName, email: user.email, isSuperAdmin: user.isSuperAdmin };
}
