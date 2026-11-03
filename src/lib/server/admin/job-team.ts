import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { isActiveStatus, serviceNumber } from "@/lib/service-desk";
import { db, schema } from "../db";
import { notify, notifyAdmins } from "../notifications";
import { engineerWorkloads, lockAssignments } from "./assignment";
import { AdminError, audit, type Db, type Tx } from "./tx";

/**
 * Job teams: a job has one lead (its assigned engineer) and any number of helpers for work that
 * needs more than one person. Admins and the lead can add or remove helpers; a helper can leave.
 * Helpers count toward their own workload, so automatic assignment doesn't overload them.
 */

type Actor = { id: string; role: string };
const h = schema.serviceJobHelpers;

/** SQL: `engineerId` is an active helper on the service request row `requestId` refers to. */
export const helpingOn = (requestId: unknown, engineerId: string) =>
  sql`exists (select 1 from ${h} where ${h.requestId} = ${requestId} and ${h.engineerId} = ${engineerId} and ${h.removedAt} is null)`;

export async function isHelper(q: Db, requestId: string, engineerId: string) {
  const [row] = await q
    .select({ id: h.id })
    .from(h)
    .where(and(eq(h.requestId, requestId), eq(h.engineerId, engineerId), isNull(h.removedAt)));
  return Boolean(row);
}

/** Current helpers on a job, earliest first. */
export async function jobTeam(requestId: string, q: Db = db) {
  return q
    .select({ id: h.id, engineerId: h.engineerId, reason: h.reason, createdAt: h.createdAt, firstName: schema.users.firstName, lastName: schema.users.lastName, phone: schema.users.phone })
    .from(h)
    .innerJoin(schema.users, eq(schema.users.id, h.engineerId))
    .where(and(eq(h.requestId, requestId), isNull(h.removedAt)))
    .orderBy(asc(h.createdAt));
}
export type TeamMember = Awaited<ReturnType<typeof jobTeam>>[number];

/** Engineers who could join a job: switched on, set up, available and not already on it. */
export async function helperCandidates(job: { id: string; assignedEngineerId: string | null; deviceType: (typeof schema.serviceRequests.$inferSelect)["deviceType"]; location: "in_shop" | "on_site" }) {
  const [team, all] = await Promise.all([jobTeam(job.id), engineerWorkloads(db, job)]);
  const taken = new Set([job.assignedEngineerId, ...team.map((m) => m.engineerId)]);
  return all.filter((e) => !taken.has(e.id) && !e.disabled && e.hasPassword).map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`.trim(), activeJobs: e.activeJobs, note: e.ineligible }));
}

async function lockedJob(tx: Tx, requestId: string) {
  await lockAssignments(tx);
  const [job] = await tx.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, requestId)).for("update");
  if (!job) throw new AdminError("Service request not found.");
  return job;
}

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();

export async function addHelper(actor: Actor, input: { requestId: string; engineerId: string; reason?: string }) {
  const reason = (input.reason ?? "").trim().slice(0, 200);
  return db.transaction(async (tx) => {
    const job = await lockedJob(tx, input.requestId);
    const asLead = actor.role === "engineer" && job.assignedEngineerId === actor.id;
    if (actor.role !== "admin" && !asLead) throw new AdminError("Only an admin or the job's lead engineer can add engineers to it.");
    if (!job.assignedEngineerId || !isActiveStatus(job.status)) throw new AdminError("Engineers can join a job only while it's assigned and open.");
    if (input.engineerId === job.assignedEngineerId) throw new AdminError("That engineer is already leading this job.");
    if (await isHelper(tx, job.id, input.engineerId)) throw new AdminError("That engineer is already on this job.");

    const who = (await engineerWorkloads(tx, job)).find((e) => e.id === input.engineerId);
    if (!who) throw new AdminError("Choose an engineer.");
    if (who.disabled || !who.hasPassword) throw new AdminError(`${fullName(who)} can't take jobs: ${who.ineligible?.toLowerCase()}.`);
    // Admins may override availability (as with assignment); the lead asks only free colleagues.
    if (asLead && who.ineligible) throw new AdminError(`${fullName(who)} can't join right now: ${who.ineligible.toLowerCase()}.`);

    await tx.insert(h).values({ requestId: job.id, engineerId: who.id, addedById: actor.id, reason });
    const ticket = serviceNumber(job.seq);
    const [adder] = await tx.select({ firstName: schema.users.firstName, lastName: schema.users.lastName }).from(schema.users).where(eq(schema.users.id, actor.id));
    await notify(tx, [who.id], { kind: "service.helper_added", title: `You've been added to ${ticket}`, body: `${fullName(adder)} added you to help${reason ? `: ${reason}` : "."}`, href: `/engineer/jobs/${job.id}` });
    if (asLead) await notifyAdmins(tx, { kind: "service.helper_added", title: `${fullName(who)} joined ${ticket}`, body: `Added by the lead engineer${reason ? `: ${reason}` : "."}`, href: `/admin/service-requests/${job.id}` });
    else await notify(tx, [job.assignedEngineerId], { kind: "service.helper_added", title: `${fullName(who)} is helping on ${ticket}`, body: reason || "Added by an admin.", href: `/engineer/jobs/${job.id}` });
    await audit(tx, { actorId: actor.id, action: "service.team", entityType: "service_request", entityId: job.id, summary: `${ticket}: ${fullName(who)} joined the job${reason ? ` (${reason})` : ""}` });
  });
}

/** Takes a helper off a job: by an admin, the lead, or the helper leaving. */
export async function removeHelper(actor: Actor, input: { requestId: string; engineerId: string }) {
  await db.transaction(async (tx) => {
    const job = await lockedJob(tx, input.requestId);
    const self = actor.id === input.engineerId;
    if (actor.role !== "admin" && job.assignedEngineerId !== actor.id && !self) throw new AdminError("Only an admin or the job's lead engineer can change its team.");
    const [row] = await tx
      .update(h)
      .set({ removedAt: new Date() })
      .where(and(eq(h.requestId, job.id), eq(h.engineerId, input.engineerId), isNull(h.removedAt)))
      .returning({ id: h.id });
    if (!row) throw new AdminError("That engineer isn't on this job.");
    const [who] = await tx.select({ firstName: schema.users.firstName, lastName: schema.users.lastName }).from(schema.users).where(eq(schema.users.id, input.engineerId));
    const ticket = serviceNumber(job.seq);
    if (self) {
      if (job.assignedEngineerId) await notify(tx, [job.assignedEngineerId], { kind: "service.helper_left", title: `${fullName(who)} left ${ticket}`, body: "They're no longer helping on this job.", href: `/engineer/jobs/${job.id}` });
    } else {
      await notify(tx, [input.engineerId], { kind: "service.helper_removed", title: `You're off ${ticket}`, body: "You've been taken off this job's team.", href: "/engineer/jobs" });
    }
    await audit(tx, { actorId: actor.id, action: "service.team", entityType: "service_request", entityId: job.id, summary: `${ticket}: ${fullName(who)} ${self ? "left" : "was taken off"} the job` });
  });
}
