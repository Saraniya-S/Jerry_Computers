"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/admin/result";
import { contactSchema, fieldErrors } from "@/lib/customer";
import { audit } from "@/lib/server/admin/tx";
import { requireStaff } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { sendPasswordResetEmail } from "@/lib/server/mail";
import { markRead } from "@/lib/server/notifications";
import { issuePasswordToken, recentResetCount } from "@/lib/server/password-tokens";

/**
 * Self-service for engineers and e-commerce staff: their own name and mobile, a password link,
 * and their own notifications. Role, access and work settings stay with admins.
 */
const requireSelf = () => requireStaff(["engineer", "ecommerce_staff"]);

export async function updateMyProfileAction(input: unknown): Promise<ActionResult> {
  const me = await requireSelf();
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  await db.transaction(async (tx) => {
    await tx.update(schema.users).set(parsed.data).where(eq(schema.users.id, me.id));
    await audit(tx, { actorId: me.id, action: "user.profile", entityType: "user", entityId: me.id, summary: `${parsed.data.firstName} updated their contact details` });
  });
  refresh();
  return { ok: true, message: "Profile saved." };
}

export async function emailPasswordResetAction(): Promise<ActionResult> {
  const me = await requireSelf();
  if ((await recentResetCount(me.id)) >= 3) return { ok: false, error: "A few links were sent recently. Use the latest one in your inbox, or try again later." };
  try {
    const token = await issuePasswordToken(me.id, "reset");
    await sendPasswordResetEmail({ to: me.email, name: me.firstName, link: `${env.APP_URL}/set-password?token=${token}` });
  } catch (err) {
    console.error("[profile] reset email failed", err);
    return { ok: false, error: "The email didn't send. Please try again." };
  }
  return { ok: true, message: `We've emailed a link to ${me.email} to set a new password.` };
}

export async function markMyNotificationsReadAction(ids?: string[]): Promise<ActionResult> {
  const me = await requireSelf();
  await markRead(me.id, ids ? z.array(z.string().uuid()).max(100).parse(ids) : undefined);
  refresh();
  return { ok: true, message: "Marked as read." };
}
