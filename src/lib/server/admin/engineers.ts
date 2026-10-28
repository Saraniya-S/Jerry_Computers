import "server-only";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { ACTIVE_SERVICE_STATUSES, deviceTypes, serviceNumber } from "@/lib/service-desk";
import { db, schema } from "../db";
import type { DeviceType } from "../db/schema";
import { applyAssignment, autoAssign, engineerWorkloads, lockAssignments } from "./assignment";
import { AdminError, audit, type Tx } from "./tx";

export const engineerProfileInput = z.object({
  isAvailable: z.boolean(),
  skills: z.array(z.enum(deviceTypes as [DeviceType, ...DeviceType[]])).max(deviceTypes.length),
  takesOnSite: z.boolean(),
  notes: z.string().trim().max(500),
});

/** Engineers with workload, completed-job count and pending transfers. */
export async function listEngineers() {
  const [loads, completed, pending] = await Promise.all([
    engineerWorkloads(),
    db
      .select({ id: schema.serviceRequests.assignedEngineerId, n: count(), last30: sql<number>`count(*) filter (where ${schema.serviceRequests.completedAt} >= now() - interval '30 days')::int` })
      .from(schema.serviceRequests)
      .where(eq(schema.serviceRequests.status, "completed"))
      .groupBy(schema.serviceRequests.assignedEngineerId),
    db
      .select({ id: schema.transferRequests.fromEngineerId, n: count() })
      .from(schema.transferRequests)
      .where(eq(schema.transferRequests.status, "pending"))
      .groupBy(schema.transferRequests.fromEngineerId),
  ]);
  return loads.map((e) => ({
    ...e,
    completed: completed.find((c) => c.id === e.id)?.n ?? 0,
    completedLast30: completed.find((c) => c.id === e.id)?.last30 ?? 0,
    pendingTransfers: pending.find((p) => p.id === e.id)?.n ?? 0,
  }));
}

export async function ensureEngineerProfile(q: Tx | typeof db, userId: string) {
  await q.insert(schema.engineerProfiles).values({ userId }).onConflictDoNothing();
}

export async function updateEngineerProfile(adminId: string, userId: string, input: z.input<typeof engineerProfileInput>) {
  const v = engineerProfileInput.parse(input);
  await db.transaction(async (tx) => {
    const [u] = await tx.select().from(schema.users).where(eq(schema.users.id, userId));
    if (!u || u.role !== "engineer") throw new AdminError("Not an engineer account.");
    await tx
      .insert(schema.engineerProfiles)
      .values({ userId, ...v })
      .onConflictDoUpdate({ target: schema.engineerProfiles.userId, set: v });
    await audit(tx, {
      actorId: adminId,
      action: "engineer.profile",
      entityType: "user",
      entityId: userId,
      summary: `Updated ${u.firstName}'s engineer settings: ${v.isAvailable ? "available" : "unavailable"}, ${v.skills.length ? v.skills.join(", ") : "all devices"}${v.takesOnSite ? ", on-site" : ", in-shop only"}`,
    });
  });
}

export async function activeJobCount(engineerId: string, q: Tx | typeof db = db) {
  const [{ n }] = await q
    .select({ n: count() })
    .from(schema.serviceRequests)
    .where(and(eq(schema.serviceRequests.assignedEngineerId, engineerId), inArray(schema.serviceRequests.status, ACTIVE_SERVICE_STATUSES)));
  return n;
}

/**
 * Hands an engineer's active jobs to others by the normal policy (used when their account is
 * switched off). Jobs nobody else can take go back to unassigned. Returns how many moved.
 */
export async function releaseEngineerJobs(tx: Tx, engineerId: string, adminId: string) {
  await lockAssignments(tx);
  const jobs = await tx
    .select({ id: schema.serviceRequests.id, seq: schema.serviceRequests.seq })
    .from(schema.serviceRequests)
    .where(and(eq(schema.serviceRequests.assignedEngineerId, engineerId), inArray(schema.serviceRequests.status, ACTIVE_SERVICE_STATUSES)));
  let moved = 0;
  for (const j of jobs) {
    // Unassign, then let the policy choose someone else.
    await applyAssignment(tx, j.id, { engineerId: null, method: "unassigned", reason: "Engineer's account switched off", decidedById: adminId });
    const pick = await autoAssign(tx, j.id, adminId, `previous engineer's account switched off (${serviceNumber(j.seq)})`, [engineerId]);
    if (pick) moved++;
  }
  // Their own open transfer requests no longer make sense.
  await tx
    .update(schema.transferRequests)
    .set({ status: "withdrawn", decidedAt: new Date(), decisionNote: "Engineer's account switched off" })
    .where(and(eq(schema.transferRequests.status, "pending"), sql`(${schema.transferRequests.fromEngineerId} = ${engineerId} or ${schema.transferRequests.toEngineerId} = ${engineerId})`));
  return { total: jobs.length, reassigned: moved };
}
