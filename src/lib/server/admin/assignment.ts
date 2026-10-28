import "server-only";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { ACTIVE_SERVICE_STATUSES, OPEN_FOR_ADMIN_STATUSES, serviceNumber } from "@/lib/service-desk";
import { db, schema } from "../db";
import type { DeviceType } from "../db/schema";
import { notify } from "../notifications";
import { AdminError, audit, type Db, type Tx } from "./tx";

/**
 * Automatic engineer assignment.
 *
 * Eligible: an engineer account that is switched on, has set its password (so it can sign in),
 * is marked available, takes this device type (no skills listed = takes everything) and, for
 * on-site jobs, takes on-site work.
 *
 * Choice: fewest active jobs (ACTIVE_SERVICE_STATUSES); ties go to whoever was assigned a job
 * least recently (never assigned counts as longest ago), then the longest-standing account, then
 * user id, so the same inputs always pick the same engineer.
 *
 * Every assignment decision takes one transaction-scoped advisory lock first, so two requests
 * created at the same moment are decided one after the other, each seeing the other's result.
 */
const ASSIGNMENT_LOCK = 0x4a43_0001; // "JC" + 1

export async function lockAssignments(tx: Tx) {
  await tx.execute(sql`select pg_advisory_xact_lock(${ASSIGNMENT_LOCK})`);
}

const activeJobs = sql<number>`(select count(*)::int from ${schema.serviceRequests} r
  where r.assigned_engineer_id = ${schema.users.id} and r.status in (${sql.join(ACTIVE_SERVICE_STATUSES.map((s) => sql`${s}`), sql`, `)}))`;
const lastAssignedAt = sql<Date | null>`(select max(a.created_at) from ${schema.serviceAssignments} a
  where a.engineer_id = ${schema.users.id} and a.method <> 'unassigned')`;

/** All engineers with their workload and, for a given job, whether they're eligible and why not. */
export async function engineerWorkloads(q: Db = db, job?: { deviceType: DeviceType; location: "in_shop" | "on_site" }) {
  const rows = await q
    .select({
      id: schema.users.id,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      email: schema.users.email,
      phone: schema.users.phone,
      createdAt: schema.users.createdAt,
      disabled: sql<boolean>`${schema.users.disabledAt} is not null`,
      hasPassword: sql<boolean>`${schema.users.passwordHash} is not null`,
      isAvailable: sql<boolean>`coalesce(${schema.engineerProfiles.isAvailable}, true)`,
      skills: sql<DeviceType[]>`coalesce(${schema.engineerProfiles.skills}, '{}')`,
      takesOnSite: sql<boolean>`coalesce(${schema.engineerProfiles.takesOnSite}, true)`,
      activeJobs,
      lastAssignedAt,
    })
    .from(schema.users)
    .leftJoin(schema.engineerProfiles, eq(schema.engineerProfiles.userId, schema.users.id))
    .where(eq(schema.users.role, "engineer"));

  return rows
    .map((r) => {
      const skills = (r.skills ?? []) as DeviceType[];
      let ineligible: string | null = null;
      if (r.disabled) ineligible = "Account switched off";
      else if (!r.hasPassword) ineligible = "Hasn't accepted the invitation yet";
      else if (!r.isAvailable) ineligible = "Marked unavailable";
      else if (job && skills.length && !skills.includes(job.deviceType)) ineligible = "Doesn't take this device type";
      else if (job?.location === "on_site" && !r.takesOnSite) ineligible = "Doesn't take on-site jobs";
      return { ...r, skills, lastAssignedAt: r.lastAssignedAt ? new Date(r.lastAssignedAt) : null, ineligible };
    })
    .sort(compareForAssignment);
}
export type EngineerWorkload = Awaited<ReturnType<typeof engineerWorkloads>>[number];

/** The tie-breaking order described above. */
type Ranked = { activeJobs: number; lastAssignedAt: Date | null; createdAt: Date; id: string };
export function compareForAssignment(a: Ranked, b: Ranked) {
  return (
    a.activeJobs - b.activeJobs ||
    (a.lastAssignedAt?.getTime() ?? 0) - (b.lastAssignedAt?.getTime() ?? 0) ||
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
    a.id.localeCompare(b.id)
  );
}

/** The engineer the policy picks for a job, or null if nobody is eligible. Call after lockAssignments. */
export async function pickEngineer(tx: Tx, job: { deviceType: DeviceType; location: "in_shop" | "on_site" }, exclude: string[] = []) {
  const candidates = (await engineerWorkloads(tx, job)).filter((e) => !e.ineligible && !exclude.includes(e.id));
  return candidates[0] ?? null;
}

type AssignOpts = {
  engineerId: string | null;
  method: "auto" | "manual" | "transfer" | "unassigned";
  reason: string | null;
  decidedById: string | null;
  activeJobsBefore?: number | null;
};

/**
 * Points a locked job at an engineer (or nobody) and records it in the assignment history and the
 * job's progress log. A job that changes hands starts again at "assigned" for the new engineer to
 * accept. Any pending transfer request is withdrawn, since it no longer describes the current
 * assignment. Both engineers are notified. Call inside a transaction after lockAssignments.
 */
export async function applyAssignment(tx: Tx, requestId: string, opts: AssignOpts) {
  const [job] = await tx.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, requestId)).for("update");
  if (!job) throw new AdminError("Service request not found.");
  if (!(OPEN_FOR_ADMIN_STATUSES as readonly string[]).includes(job.status)) throw new AdminError("This job is closed.");
  if (job.assignedEngineerId === opts.engineerId) throw new AdminError("The job is already assigned that way.");

  const status = opts.engineerId ? "assigned" : "open";
  await tx
    .update(schema.serviceRequests)
    .set({ assignedEngineerId: opts.engineerId, assignedAt: opts.engineerId ? new Date() : null, acceptedAt: null, status })
    .where(eq(schema.serviceRequests.id, requestId));
  await tx.insert(schema.serviceAssignments).values({
    requestId,
    engineerId: opts.engineerId,
    previousEngineerId: job.assignedEngineerId,
    method: opts.method,
    activeJobsBefore: opts.activeJobsBefore ?? null,
    reason: opts.reason,
    decidedById: opts.decidedById,
  });

  const names = await engineerNames(tx, [opts.engineerId, job.assignedEngineerId]);
  const to = opts.engineerId ? names.get(opts.engineerId) : null;
  const note =
    opts.method === "auto"
      ? `Automatically assigned to ${to} (${opts.activeJobsBefore ?? 0} active job${opts.activeJobsBefore === 1 ? "" : "s"})`
      : opts.method === "transfer"
        ? `Transferred from ${names.get(job.assignedEngineerId!)} to ${to}`
        : opts.engineerId
          ? `Assigned to ${to} by an admin`
          : "Unassigned";
  await tx.insert(schema.serviceEvents).values({
    requestId,
    fromStatus: job.status,
    toStatus: status,
    note: opts.reason ? `${note}: ${opts.reason}` : note,
    actorId: opts.decidedById,
  });
  await tx
    .update(schema.transferRequests)
    .set({ status: "withdrawn", decidedAt: new Date(), decisionNote: "Assignment changed before a decision" })
    .where(and(eq(schema.transferRequests.requestId, requestId), eq(schema.transferRequests.status, "pending")));

  const ticket = serviceNumber(job.seq);
  if (opts.engineerId) {
    await notify(tx, [opts.engineerId], {
      kind: "service.assigned",
      title: `New job ${ticket}`,
      body: opts.method === "transfer" ? `Transferred to you from ${names.get(job.assignedEngineerId!)}.` : "Assigned to you. Open it to accept.",
      href: `/engineer/jobs/${requestId}`,
    });
  }
  if (job.assignedEngineerId) {
    await notify(tx, [job.assignedEngineerId], {
      kind: "service.unassigned",
      title: `${ticket} moved off your list`,
      body: opts.engineerId ? `Now with ${to}.` : "It is waiting to be reassigned.",
    });
  }

  if (opts.decidedById && opts.method !== "auto") {
    await audit(tx, {
      actorId: opts.decidedById,
      action: opts.method === "transfer" ? "service.transfer" : "service.assign",
      entityType: "service_request",
      entityId: requestId,
      summary: `${serviceNumber(job.seq)}: ${note}${opts.reason ? ` (${opts.reason})` : ""}`,
      details: { from: job.assignedEngineerId, to: opts.engineerId },
    });
  }
  return { ...job, status, assignedEngineerId: opts.engineerId };
}

async function engineerNames(q: Db, ids: (string | null)[]) {
  const real = ids.filter((x): x is string => Boolean(x));
  if (!real.length) return new Map<string, string>();
  const rows = await q.select({ id: schema.users.id, f: schema.users.firstName, l: schema.users.lastName }).from(schema.users).where(inArray(schema.users.id, real));
  return new Map(rows.map((r) => [r.id, `${r.f} ${r.l}`.trim()]));
}

/** Assigns an unassigned job by the policy. Returns the engineer, or null if nobody was eligible (the job stays unassigned). */
export async function autoAssign(tx: Tx, requestId: string, decidedById: string | null, reason: string | null = null, exclude: string[] = []) {
  await lockAssignments(tx);
  const [job] = await tx.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, requestId));
  const pick = await pickEngineer(tx, { deviceType: job.deviceType, location: job.location }, exclude);
  if (!pick) {
    await tx.insert(schema.serviceEvents).values({ requestId, note: "No eligible engineer is available; the job is waiting to be assigned.", actorId: decidedById });
    return null;
  }
  await applyAssignment(tx, requestId, { engineerId: pick.id, method: "auto", reason, decidedById, activeJobsBefore: pick.activeJobs });
  return pick;
}

/** Makes sure the target can take jobs at all (admin overrides may ignore availability and skills). */
export async function assertAssignableEngineer(q: Db, engineerId: string) {
  const [u] = await q
    .select({ role: schema.users.role, firstName: schema.users.firstName })
    .from(schema.users)
    .where(and(eq(schema.users.id, engineerId), isNull(schema.users.disabledAt), isNotNull(schema.users.passwordHash)));
  if (!u || u.role !== "engineer") throw new AdminError("Choose an engineer whose account is active.");
  return u;
}
