"use server";

import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/admin/result";
import { attempt } from "@/lib/server/admin/attempt";
import { engineerProfileInput, updateEngineerProfile } from "@/lib/server/admin/engineers";
import { addServiceNote, changeServiceStatus, createServiceRequest, decideTransfer, overrideAssignment, type statusChangeInput } from "@/lib/server/admin/service-requests";
import { db, schema } from "@/lib/server/db";
import { requirePermission } from "@/lib/server/permissions";
import type { ServiceRequestInput } from "@/lib/service-desk";

const id = z.string().uuid();

export async function createServiceRequestAction(input: ServiceRequestInput): Promise<ActionResult> {
  const admin = await requirePermission("service.manage");
  let created: { id: string } | null = null;
  const res = await attempt(async () => {
    created = await createServiceRequest(admin.id, input);
    return "Created.";
  });
  if (!res.ok || !created) return res;
  redirect(`/admin/service-requests/${(created as { id: string }).id}?created=1`);
}

/** Account customers matching a name, email or phone, for linking a service request. */
export async function findCustomersAction(query: string) {
  await requirePermission("service.manage");
  const q = z.string().trim().max(60).parse(query);
  if (q.length < 2) return [];
  const like = `%${q}%`;
  return db
    .select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName, email: schema.users.email, phone: schema.users.phone })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.role, "customer"),
        or(ilike(schema.users.email, like), ilike(schema.users.phone, like), ilike(sql`${schema.users.firstName} || ' ' || ${schema.users.lastName}`, like)),
      ),
    )
    .orderBy(asc(schema.users.firstName))
    .limit(8);
}

export async function changeServiceStatusAction(input: z.input<typeof statusChangeInput>): Promise<ActionResult> {
  const admin = await requirePermission("service.manage");
  const res = await attempt(async () => {
    await changeServiceStatus(admin, input);
    return "Status updated.";
  });
  if (res.ok) refresh();
  return res;
}

export async function addServiceNoteAction(requestId: string, note: string): Promise<ActionResult> {
  const admin = await requirePermission("service.manage");
  const res = await attempt(async () => {
    await addServiceNote(admin, id.parse(requestId), note);
    return "Note added.";
  });
  if (res.ok) refresh();
  return res;
}

export async function overrideAssignmentAction(requestId: string, target: string, reason: string): Promise<ActionResult> {
  const admin = await requirePermission("service.manage");
  const res = await attempt(async () => {
    const t = target === "auto" ? { auto: true as const } : target === "none" ? { unassign: true as const } : { engineerId: id.parse(target) };
    const engineerId = await overrideAssignment(admin.id, id.parse(requestId), t, reason);
    return engineerId ? "Assignment changed and recorded." : "Job unassigned.";
  });
  if (res.ok) refresh();
  return res;
}

export async function decideTransferAction(transferId: string, approve: boolean, note: string): Promise<ActionResult> {
  const admin = await requirePermission("service.manage");
  const res = await attempt(async () => {
    await decideTransfer(admin.id, id.parse(transferId), approve, note);
    return approve ? "Transfer approved. The job has moved to the new engineer." : "Transfer rejected. The job stays with its engineer.";
  });
  if (res.ok) refresh();
  return res;
}

export async function updateEngineerProfileAction(userId: string, input: z.input<typeof engineerProfileInput>): Promise<ActionResult> {
  const admin = await requirePermission("engineers.manage");
  const res = await attempt(async () => {
    await updateEngineerProfile(admin.id, id.parse(userId), input);
    return "Engineer settings saved.";
  });
  if (res.ok) refresh();
  return res;
}

