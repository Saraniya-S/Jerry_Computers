import "server-only";
import { and, count, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "../db";
import type { User, UserRole } from "../db/schema";
import { activeJobCount, ensureEngineerProfile, releaseEngineerJobs } from "./engineers";
import { AdminError, audit } from "./tx";

export const staffRoles = ["admin", "ecommerce_staff", "engineer"] as const;
export type StaffRole = (typeof staffRoles)[number];
export const roleLabel: Record<UserRole, string> = { admin: "Admin", ecommerce_staff: "E-commerce staff", engineer: "Service engineer", customer: "Customer" };

export type Actor = { id: string; role: UserRole; isSuperAdmin: boolean; firstName: string };

/**
 * Who may manage whom: admins manage staff and customers; only the super admin may create, change
 * or switch off admins (or make someone an admin); nobody touches the super admin; nobody changes
 * their own role or switches themselves off.
 */
export function mayManage(actor: Actor, target: { id?: string; role: UserRole; isSuperAdmin: boolean }, newRole?: UserRole) {
  if (actor.role !== "admin") return false;
  if (target.isSuperAdmin) return false;
  if (target.id && target.id === actor.id) return false;
  if ((target.role === "admin" || newRole === "admin") && !actor.isSuperAdmin) return false;
  return true;
}

async function getUser(id: string) {
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (!u) throw new AdminError("Account not found.");
  return u;
}

export async function createStaff(actor: Actor, v: { role: StaffRole; firstName: string; lastName: string; email: string; phone: string }) {
  if (!mayManage(actor, { role: v.role, isSuperAdmin: false }, v.role)) throw new AdminError("Only the super admin can add admins.");
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.email, v.email));
    if (existing) throw new AdminError(existing.role === "customer" ? "That email belongs to a customer account. Use a different email for staff." : "Someone on the team already uses that email.");
    const [user] = await tx.insert(schema.users).values(v).returning();
    if (v.role === "engineer") await ensureEngineerProfile(tx, user.id);
    await audit(tx, { actorId: actor.id, action: "user.create", entityType: "user", entityId: user.id, summary: `Invited ${v.firstName} (${v.email}) as ${roleLabel[v.role]}` });
    return user;
  });
}

export async function changeRole(actor: Actor, userId: string, newRole: StaffRole) {
  const u = await getUser(userId);
  if (u.role === "customer") throw new AdminError("Customer accounts can't be given staff roles. Invite the person with a separate work email.");
  if (u.id === actor.id) throw new AdminError("You can't change your own role.");
  if (!mayManage(actor, u, newRole)) throw new AdminError("Only the super admin can manage admins.");
  if (u.role === newRole) return u;
  if (u.role === "engineer") {
    const n = await activeJobCount(u.id);
    if (n) throw new AdminError(`${u.firstName} has ${n} active service job${n === 1 ? "" : "s"}. Reassign ${n === 1 ? "it" : "them"} before changing their role.`);
  }
  await db.transaction(async (tx) => {
    await tx.update(schema.users).set({ role: newRole }).where(eq(schema.users.id, u.id));
    if (newRole === "engineer") await ensureEngineerProfile(tx, u.id);
    // Sign them out so they start fresh in the new area.
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, u.id));
    await audit(tx, { actorId: actor.id, action: "user.role_change", entityType: "user", entityId: u.id, summary: `Changed ${u.firstName}'s role from ${roleLabel[u.role]} to ${roleLabel[newRole]}`, details: { from: u.role, to: newRole } });
  });
  return u;
}

/** Switches an account off (signing it out) or back on. An engineer's active jobs are handed to others first. */
export async function setDisabled(actor: Actor, userId: string, disabled: boolean) {
  const u = await getUser(userId);
  if (u.id === actor.id) throw new AdminError("You can't switch off your own account.");
  if (!mayManage(actor, u)) throw new AdminError("Only the super admin can manage admins.");
  if (Boolean(u.disabledAt) === disabled) return { user: u, jobs: null };
  return db.transaction(async (tx) => {
    // Lock the account row first so a role change can't slip in between.
    await tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, u.id)).for("update");
    await tx.update(schema.users).set({ disabledAt: disabled ? new Date() : null }).where(eq(schema.users.id, u.id));
    let jobs: { total: number; reassigned: number } | null = null;
    if (disabled) {
      await tx.delete(schema.sessions).where(eq(schema.sessions.userId, u.id));
      if (u.role === "engineer") jobs = await releaseEngineerJobs(tx, u.id, actor.id);
    }
    await audit(tx, {
      actorId: actor.id,
      action: disabled ? "user.disable" : "user.enable",
      entityType: "user",
      entityId: u.id,
      summary: `${disabled ? "Switched off" : "Switched on"} ${roleLabel[u.role].toLowerCase()} ${u.firstName} ${u.lastName}`.trim() + (jobs?.total ? `; ${jobs.reassigned} of ${jobs.total} active jobs reassigned` : ""),
    });
    return { user: u, jobs };
  });
}

export type CustomerQuery = { q?: string; status?: "active" | "disabled" | "unverified"; page?: number; pageSize?: number };

export async function searchCustomers(f: CustomerQuery = {}) {
  const where: SQL[] = [eq(schema.users.role, "customer")];
  if (f.status === "disabled") where.push(isNotNull(schema.users.disabledAt));
  if (f.status === "active") where.push(isNull(schema.users.disabledAt));
  if (f.status === "unverified") where.push(isNull(schema.users.emailVerifiedAt));
  const q = f.q?.trim();
  if (q) {
    const like = `%${q}%`;
    where.push(or(ilike(schema.users.email, like), ilike(schema.users.phone, like), ilike(schema.users.companyName, like), ilike(sql`${schema.users.firstName} || ' ' || ${schema.users.lastName}`, like))!);
  }
  const pageSize = Math.min(f.pageSize ?? 25, 100);
  const page = Math.max(1, f.page ?? 1);
  const [rows, [{ n }]] = await Promise.all([
    db
      .select({
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        email: schema.users.email,
        phone: schema.users.phone,
        customerType: schema.users.customerType,
        companyName: schema.users.companyName,
        createdAt: schema.users.createdAt,
        lastLoginAt: schema.users.lastLoginAt,
        emailVerifiedAt: schema.users.emailVerifiedAt,
        disabledAt: schema.users.disabledAt,
        orders: sql<number>`(select count(*)::int from ${schema.orders} where ${schema.orders.userId} = ${schema.users.id})`,
        serviceJobs: sql<number>`(select count(*)::int from ${schema.serviceRequests} where ${schema.serviceRequests.customerId} = ${schema.users.id})`,
      })
      .from(schema.users)
      .where(and(...where))
      .orderBy(desc(schema.users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(schema.users).where(and(...where)),
  ]);
  return { rows, total: n, page, pageSize };
}

/** Recent audit entries, optionally about or by one user. */
export async function listAudit({ entityType, entityId, actorId, action, page = 1, pageSize = 30 }: { entityType?: string; entityId?: string; actorId?: string; action?: string; page?: number; pageSize?: number } = {}) {
  const where: SQL[] = [];
  if (entityType) where.push(eq(schema.auditLogs.entityType, entityType));
  if (entityId) where.push(eq(schema.auditLogs.entityId, entityId));
  if (actorId) where.push(eq(schema.auditLogs.actorId, actorId));
  if (action) where.push(sql`${schema.auditLogs.action} like ${`${action}%`}`);
  const cond = where.length ? and(...where) : undefined;
  const [rows, [{ n }]] = await Promise.all([
    db
      .select({ log: schema.auditLogs, actorFirst: schema.users.firstName, actorLast: schema.users.lastName, actorRole: schema.users.role })
      .from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.users.id, schema.auditLogs.actorId))
      .where(cond)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(schema.auditLogs).where(cond),
  ]);
  return { rows, total: n, page, pageSize };
}

export type { User };
