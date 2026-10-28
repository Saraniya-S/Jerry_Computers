import "server-only";
import type { UserRole } from "./db/schema";
import { requireStaff, type Staff } from "./auth";

/**
 * Which roles may do what in the admin area. Every admin page and server action checks one of
 * these on the server; the sidebar only mirrors them. Managing admins additionally needs the super
 * admin (see admin/team.ts).
 */
export const permissions = {
  "dashboard.view": ["admin"],
  "orders.view": ["admin", "ecommerce_staff"],
  "orders.fulfil": ["admin", "ecommerce_staff"],
  "payments.record": ["admin", "ecommerce_staff"],
  "payments.refund": ["admin"],
  "catalogue.manage": ["admin"],
  "inventory.adjust": ["admin"],
  "customers.manage": ["admin"],
  "service.manage": ["admin"],
  "engineers.manage": ["admin"],
  "staff.manage": ["admin"],
  "reports.view": ["admin"],
  "settings.manage": ["admin"],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof permissions;

export function can(role: UserRole, permission: Permission) {
  return (permissions[permission] as readonly UserRole[]).includes(role);
}

/** The signed-in staff member, if their role has `permission`; anyone else is redirected away. */
export function requirePermission(permission: Permission): Promise<Staff> {
  return requireStaff([...permissions[permission]]);
}
