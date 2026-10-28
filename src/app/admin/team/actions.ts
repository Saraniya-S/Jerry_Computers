"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/admin/result";
import { contactSchema, fieldErrors } from "@/lib/customer";
import { attempt } from "@/lib/server/admin/attempt";
import { changeRole, createStaff, mayManage, roleLabel, setDisabled, staffRoles, type Actor } from "@/lib/server/admin/users";
import type { Staff } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { sendInviteEmail } from "@/lib/server/mail";
import { issuePasswordToken } from "@/lib/server/password-tokens";
import { requirePermission } from "@/lib/server/permissions";

export type TeamResult = ActionResult;

const inviteSchema = contactSchema.extend({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  role: z.enum(staffRoles, { error: "Choose a role." }),
});

const actorOf = (s: Staff): Actor => ({ id: s.id, role: s.role, isSuperAdmin: s.isSuperAdmin, firstName: s.firstName });

async function sendInvite(actor: Staff, user: { id: string; email: string; firstName: string; role: string }) {
  const token = await issuePasswordToken(user.id, "invite");
  await sendInviteEmail({
    to: user.email,
    name: user.firstName,
    role: user.role,
    invitedBy: `${actor.firstName} ${actor.lastName}`.trim(),
    link: `${env.APP_URL}/set-password?token=${token}`,
  });
}

export async function inviteStaffAction(input: unknown): Promise<TeamResult> {
  const actor = await requirePermission("staff.manage");
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;
  let user: Awaited<ReturnType<typeof createStaff>> | null = null;
  const res = await attempt(async () => {
    user = await createStaff(actorOf(actor), v);
    return "";
  });
  if (!res.ok) return { ...res, fieldErrors: res.error.includes("email") ? { email: "Already in use." } : undefined };
  try {
    await sendInvite(actor, user!);
  } catch (err) {
    console.error("[team] invite email failed", err);
    refresh();
    return { ok: false, error: `${v.firstName} was added, but the invitation email didn't send. Use Resend invite.` };
  }
  refresh();
  return { ok: true, message: `Invitation sent to ${v.email}.` };
}

async function target(id: string) {
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, z.string().uuid().parse(id)));
  if (!u || u.role === "customer") throw new Error("Not a staff account");
  return u;
}

export async function resendInviteAction(id: string): Promise<TeamResult> {
  const actor = await requirePermission("staff.manage");
  const u = await target(id);
  if (!mayManage(actorOf(actor), u)) return { ok: false, error: "Only the super admin can manage admins." };
  if (u.passwordHash) return { ok: false, error: `${u.firstName} has already set a password. They can use “Forgot password?” if needed.` };
  try {
    await sendInvite(actor, u);
  } catch (err) {
    console.error("[team] invite email failed", err);
    return { ok: false, error: "The email didn't send. Please try again." };
  }
  return { ok: true, message: `Invitation re-sent to ${u.email}.` };
}

export async function changeRoleAction(id: string, role: string): Promise<TeamResult> {
  const actor = await requirePermission("staff.manage");
  const res = await attempt(async () => {
    const newRole = z.enum(staffRoles).parse(role);
    const u = await changeRole(actorOf(actor), z.string().uuid().parse(id), newRole);
    return `${u.firstName} is now ${roleLabel[newRole].toLowerCase()}. They've been signed out to start fresh.`;
  });
  if (res.ok) refresh();
  return res;
}

/** Switches a staff member or customer off (signing them out) or back on. */
export async function setDisabledAction(id: string, disabled: boolean): Promise<TeamResult> {
  const actor = await requirePermission("staff.manage");
  const res = await attempt(async () => {
    const { user, jobs } = await setDisabled(actorOf(actor), z.string().uuid().parse(id), disabled);
    if (!disabled) return `${user.firstName} can sign in again.`;
    const handed = jobs?.total ? ` ${jobs.reassigned} of ${jobs.total} active service job${jobs.total === 1 ? " was" : "s were"} reassigned${jobs.reassigned < jobs.total ? "; the rest are waiting unassigned" : ""}.` : "";
    return `${user.firstName} has been switched off and signed out.${handed}`;
  });
  if (res.ok) refresh();
  return res;
}
