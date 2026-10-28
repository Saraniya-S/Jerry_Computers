import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ACTIVE_SERVICE_STATUSES, CLOSED_SERVICE_STATUSES } from "@/lib/service-desk";
import { engineerWorkloads } from "../admin/assignment";
import { db, schema } from "../db";
import type { ServicePriority, ServiceStatus } from "../db/schema";

/**
 * Reads for the engineer area. Every query is scoped to jobs currently assigned to the engineer in
 * SQL, so another engineer's job (or customer) is simply not found.
 */

const r = schema.serviceRequests;
const mine = (engineerId: string) => eq(r.assignedEngineerId, engineerId);
const priorityRank = sql`case ${r.priority} when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end`;

/** Start of today and tomorrow in shop time (IST). */
export function istToday(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
  const start = new Date(`${day}T00:00:00+05:30`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export async function engineerSummary(engineerId: string) {
  const { start, end } = istToday();
  const [byStatus, [completed], [today], [transfers], todayJobs] = await Promise.all([
    db.select({ status: r.status, n: count() }).from(r).where(mine(engineerId)).groupBy(r.status),
    db
      .select({ n: count(), last30: sql<number>`count(*) filter (where ${r.completedAt} >= now() - interval '30 days')::int` })
      .from(r)
      .where(and(mine(engineerId), eq(r.status, "completed"))),
    db
      .select({ n: count() })
      .from(r)
      .where(and(mine(engineerId), inArray(r.status, ACTIVE_SERVICE_STATUSES), gte(r.scheduledAt, start), lt(r.scheduledAt, end))),
    db
      .select({ n: count() })
      .from(schema.transferRequests)
      .where(and(eq(schema.transferRequests.fromEngineerId, engineerId), eq(schema.transferRequests.status, "pending"))),
    db
      .select()
      .from(r)
      .where(and(mine(engineerId), inArray(r.status, ACTIVE_SERVICE_STATUSES), gte(r.scheduledAt, start), lt(r.scheduledAt, end)))
      .orderBy(asc(r.scheduledAt)),
  ]);
  const s = Object.fromEntries(byStatus.map((x) => [x.status, x.n])) as Partial<Record<ServiceStatus, number>>;
  return {
    active: ACTIVE_SERVICE_STATUSES.reduce((n, k) => n + (s[k] ?? 0), 0),
    unaccepted: s.assigned ?? 0,
    inProgress: s.in_progress ?? 0,
    waiting: (s.awaiting_parts ?? 0) + (s.awaiting_customer ?? 0),
    awaitingParts: s.awaiting_parts ?? 0,
    awaitingCustomer: s.awaiting_customer ?? 0,
    handedBack: s.unable_to_complete ?? 0,
    completed: completed.n,
    completedLast30: completed.last30,
    scheduledToday: today.n,
    todayJobs,
    pendingTransfers: transfers.n,
  };
}

/** Latest progress entries on jobs currently assigned to the engineer. */
export async function recentActivity(engineerId: string, limit = 8) {
  const actor = alias(schema.users, "actor");
  return db
    .select({ e: schema.serviceEvents, seq: r.seq, by: sql<string | null>`${actor.firstName} || ' ' || ${actor.lastName}` })
    .from(schema.serviceEvents)
    .innerJoin(r, eq(r.id, schema.serviceEvents.requestId))
    .leftJoin(actor, eq(actor.id, schema.serviceEvents.actorId))
    .where(mine(engineerId))
    .orderBy(desc(schema.serviceEvents.createdAt))
    .limit(limit);
}

export type MyJobQuery = {
  q?: string;
  status?: ServiceStatus | "active" | "closed";
  location?: "in_shop" | "on_site";
  priority?: ServicePriority;
  sort?: "priority" | "scheduled" | "assigned_desc" | "assigned_asc";
  page?: number;
  pageSize?: number;
};

export async function searchMyJobs(engineerId: string, f: MyJobQuery = {}) {
  const where: SQL[] = [mine(engineerId)];
  if (f.status === "active") where.push(inArray(r.status, ACTIVE_SERVICE_STATUSES));
  else if (f.status === "closed") where.push(inArray(r.status, [...CLOSED_SERVICE_STATUSES, "unable_to_complete"]));
  else if (f.status) where.push(eq(r.status, f.status));
  if (f.location) where.push(eq(r.location, f.location));
  if (f.priority) where.push(eq(r.priority, f.priority));
  const q = f.q?.trim();
  if (q) {
    const seq = /^(sr-?)?0*(\d{1,9})$/i.exec(q);
    const like = `%${q}%`;
    where.push(
      or(
        seq ? eq(r.seq, Number(seq[2])) : undefined,
        ilike(r.contactName, like),
        ilike(r.contactPhone, like),
        ilike(r.deviceBrand, like),
        ilike(r.deviceModel, like),
        ilike(r.serialNumber, like),
        ilike(r.issue, like),
      )!,
    );
  }
  const order = {
    priority: [asc(priorityRank), sql`${r.scheduledAt} asc nulls last`, asc(r.assignedAt)],
    scheduled: [sql`${r.scheduledAt} asc nulls last`, asc(priorityRank)],
    assigned_desc: [desc(r.assignedAt)],
    assigned_asc: [asc(r.assignedAt)],
  }[f.sort ?? "priority"];
  const pageSize = Math.min(f.pageSize ?? 20, 100);
  const page = Math.max(1, f.page ?? 1);
  const cond = and(...where);
  const [rows, [{ n }], pending] = await Promise.all([
    db
      .select()
      .from(r)
      .where(cond)
      .orderBy(...order)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(r).where(cond),
    db
      .select({ requestId: schema.transferRequests.requestId })
      .from(schema.transferRequests)
      .where(and(eq(schema.transferRequests.fromEngineerId, engineerId), eq(schema.transferRequests.status, "pending"))),
  ]);
  const pendingIds = new Set(pending.map((p) => p.requestId));
  return { rows: rows.map((j) => ({ ...j, transferPending: pendingIds.has(j.id) })), total: n, page, pageSize };
}

/** One job, only if it is currently assigned to this engineer. */
export async function getMyJob(engineerId: string, id: string) {
  const [job] = await db
    .select()
    .from(r)
    .where(and(eq(r.id, id), mine(engineerId)));
  if (!job) return null;
  const actor = alias(schema.users, "actor");
  const to = alias(schema.users, "to_eng");
  const prev = alias(schema.users, "prev_eng");
  const [events, assignments, transfers] = await Promise.all([
    db
      .select({ e: schema.serviceEvents, by: sql<string | null>`${actor.firstName} || ' ' || ${actor.lastName}`, byRole: actor.role })
      .from(schema.serviceEvents)
      .leftJoin(actor, eq(actor.id, schema.serviceEvents.actorId))
      .where(eq(schema.serviceEvents.requestId, id))
      .orderBy(desc(schema.serviceEvents.createdAt)),
    db
      .select({ a: schema.serviceAssignments, to: sql<string | null>`${to.firstName} || ' ' || ${to.lastName}`, from: sql<string | null>`${prev.firstName} || ' ' || ${prev.lastName}` })
      .from(schema.serviceAssignments)
      .leftJoin(to, eq(to.id, schema.serviceAssignments.engineerId))
      .leftJoin(prev, eq(prev.id, schema.serviceAssignments.previousEngineerId))
      .where(eq(schema.serviceAssignments.requestId, id))
      .orderBy(desc(schema.serviceAssignments.createdAt)),
    db
      .select({ t: schema.transferRequests, to: sql<string>`${to.firstName} || ' ' || ${to.lastName}` })
      .from(schema.transferRequests)
      .innerJoin(to, eq(to.id, schema.transferRequests.toEngineerId))
      .where(and(eq(schema.transferRequests.requestId, id), eq(schema.transferRequests.fromEngineerId, engineerId)))
      .orderBy(desc(schema.transferRequests.createdAt)),
  ]);
  return { ...job, events, assignments, transfers };
}
export type MyJob = NonNullable<Awaited<ReturnType<typeof getMyJob>>>;

/** Colleagues who could take this job under the assignment rules (names only). */
export async function transferCandidates(engineerId: string, job: { deviceType: MyJob["deviceType"]; location: MyJob["location"] }) {
  return (await engineerWorkloads(db, job)).filter((e) => e.id !== engineerId && !e.ineligible).map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`.trim() }));
}

/** Transfer requests this engineer made. Job details are shown only while the job is still theirs. */
export async function myTransfers(engineerId: string) {
  const to = alias(schema.users, "to_eng");
  return db
    .select({
      t: schema.transferRequests,
      seq: r.seq,
      stillMine: sql<boolean>`${r.assignedEngineerId} = ${engineerId}`,
      to: sql<string>`${to.firstName} || ' ' || ${to.lastName}`,
    })
    .from(schema.transferRequests)
    .innerJoin(r, eq(r.id, schema.transferRequests.requestId))
    .innerJoin(to, eq(to.id, schema.transferRequests.toEngineerId))
    .where(eq(schema.transferRequests.fromEngineerId, engineerId))
    .orderBy(desc(schema.transferRequests.createdAt))
    .limit(100);
}
