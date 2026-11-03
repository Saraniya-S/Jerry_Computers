import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, count, eq, gte, inArray, isNotNull, lt, ne, sql } from "drizzle-orm";
import { OPEN_FOR_ADMIN_STATUSES } from "@/lib/service-desk";
import { db, schema } from "../db";
import type { DeviceType, ServicePriority, ServiceStatus } from "../db/schema";
import { leaveDaysInRange } from "../engineer/leave";
import { collectionTotals } from "./collections";
import { listEngineers } from "./engineers";
import type { Range } from "./reports";

/**
 * The service desk report: how many jobs came in and got done in a period, how fast, what kind,
 * where the backlog stands now, and how each engineer did. Periods are whole days in shop time.
 * "Completed" counts jobs whose completion fell in the period, whenever they were created.
 */

const r = schema.serviceRequests;
const start = (d: string) => new Date(`${d}T00:00:00+05:30`);
const endExclusive = (d: string) => new Date(start(d).getTime() + 86_400_000);
const hours = (from: unknown, to: unknown) => sql<number | null>`round(avg(extract(epoch from (${to} - ${from})) / 3600)::numeric, 1)::float`;
const openStatuses = sql.join(OPEN_FOR_ADMIN_STATUSES.map((s) => sql`${s}`), sql`, `);

export async function serviceDeskReport(range: Range) {
  const from = start(range.from);
  const to = endExclusive(range.to);
  const inRange = (col: Parameters<typeof gte>[0]) => and(gte(col, from), lt(col, to));
  const createdIn = inRange(r.createdAt);
  const completedIn = and(eq(r.status, "completed"), inRange(r.completedAt));
  // Raw SQL fragments below take the bounds as timestamps; the driver doesn't serialise Date there.
  const f = sql`${from.toISOString()}::timestamptz`;
  const t = sql`${to.toISOString()}::timestamptz`;

  const [[headline], [backlog], [handedBack], byDay, byDeviceCreated, byDeviceDone, byPriority, byChannel, problems, oldest, collected] = await Promise.all([
    db
      .select({
        created: sql<number>`count(*) filter (where ${r.createdAt} >= ${f} and ${r.createdAt} < ${t})::int`,
        completed: sql<number>`count(*) filter (where ${r.status} = 'completed' and ${r.completedAt} >= ${f} and ${r.completedAt} < ${t})::int`,
        cancelled: sql<number>`count(*) filter (where ${r.status} = 'cancelled' and ${r.cancelledAt} >= ${f} and ${r.cancelledAt} < ${t})::int`,
        hoursToComplete: sql<number | null>`round((avg(extract(epoch from (${r.completedAt} - ${r.createdAt}))) filter (where ${r.status} = 'completed' and ${r.completedAt} >= ${f} and ${r.completedAt} < ${t}) / 3600)::numeric, 1)::float`,
        hoursToAccept: sql<number | null>`round((avg(extract(epoch from (${r.acceptedAt} - ${r.assignedAt}))) filter (where ${r.acceptedAt} >= ${f} and ${r.acceptedAt} < ${t} and ${r.assignedAt} is not null) / 3600)::numeric, 1)::float`,
        onSiteCompleted: sql<number>`count(*) filter (where ${r.status} = 'completed' and ${r.location} = 'on_site' and ${r.completedAt} >= ${f} and ${r.completedAt} < ${t})::int`,
      })
      .from(r),
    // Right now, whatever the period.
    db
      .select({
        open: count(),
        unassigned: sql<number>`count(*) filter (where ${r.status} = 'open')::int`,
        handedBack: sql<number>`count(*) filter (where ${r.status} = 'unable_to_complete')::int`,
        waiting: sql<number>`count(*) filter (where ${r.status} in ('awaiting_parts', 'awaiting_customer'))::int`,
        urgent: sql<number>`count(*) filter (where ${r.priority} in ('urgent', 'high'))::int`,
        under1d: sql<number>`count(*) filter (where ${r.createdAt} > now() - interval '1 day')::int`,
        d1to3: sql<number>`count(*) filter (where ${r.createdAt} <= now() - interval '1 day' and ${r.createdAt} > now() - interval '3 days')::int`,
        d3to7: sql<number>`count(*) filter (where ${r.createdAt} <= now() - interval '3 days' and ${r.createdAt} > now() - interval '7 days')::int`,
        over7d: sql<number>`count(*) filter (where ${r.createdAt} <= now() - interval '7 days')::int`,
      })
      .from(r)
      .where(sql`${r.status} in (${openStatuses})`),
    db
      .select({ n: count() })
      .from(schema.serviceEvents)
      .where(and(eq(schema.serviceEvents.toStatus, "unable_to_complete"), inRange(schema.serviceEvents.createdAt))),
    // Day by day in shop time: jobs received and jobs completed.
    db.execute<{ day: string; created: number; completed: number }>(sql`
      select d::date::text as day,
        (select count(*)::int from ${r} where (${r.createdAt} at time zone 'Asia/Kolkata')::date = d::date) as created,
        (select count(*)::int from ${r} where ${r.status} = 'completed' and (${r.completedAt} at time zone 'Asia/Kolkata')::date = d::date) as completed
      from generate_series(${range.from}::date, ${range.to}::date, interval '1 day') d
      order by d`),
    db.select({ device: r.deviceType, n: count() }).from(r).where(createdIn).groupBy(r.deviceType),
    db.select({ device: r.deviceType, n: count(), hours: hours(r.createdAt, r.completedAt) }).from(r).where(completedIn).groupBy(r.deviceType),
    db.select({ priority: r.priority, n: count() }).from(r).where(createdIn).groupBy(r.priority),
    db.select({ location: r.location, source: r.source, n: count() }).from(r).where(createdIn).groupBy(r.location, r.source),
    db
      .select({ problem: r.problemType, n: count() })
      .from(r)
      .where(and(createdIn, eq(r.source, "online"), isNotNull(r.problemType)))
      .groupBy(r.problemType)
      .orderBy(sql`count(*) desc`)
      .limit(8),
    oldestOpen(),
    collectionTotals(from, to),
  ]);

  const devices = [...new Set([...byDeviceCreated.map((d) => d.device), ...byDeviceDone.map((d) => d.device)])] as DeviceType[];
  return {
    headline: { ...headline, handedBack: handedBack.n, collected },
    backlog,
    byDay: [...byDay],
    byDevice: devices
      .map((device) => {
        const done = byDeviceDone.find((d) => d.device === device);
        return { device, created: byDeviceCreated.find((d) => d.device === device)?.n ?? 0, completed: done?.n ?? 0, hours: done?.hours ?? null };
      })
      .sort((a, b) => b.created - a.created || b.completed - a.completed),
    byPriority: byPriority as { priority: ServicePriority; n: number }[],
    byChannel,
    problems: problems as { problem: string; n: number }[],
    oldest,
    engineers: await engineerPerformance(range, from, to),
  };
}
export type ServiceDeskReport = Awaited<ReturnType<typeof serviceDeskReport>>;

/** The ten open jobs waiting longest. */
async function oldestOpen() {
  const eng = alias(schema.users, "eng");
  return db
    .select({ id: r.id, seq: r.seq, contactName: r.contactName, deviceType: r.deviceType, status: r.status, priority: r.priority, createdAt: r.createdAt, engineer: sql<string | null>`${eng.firstName} || ' ' || ${eng.lastName}` })
    .from(r)
    .leftJoin(eng, eq(eng.id, r.assignedEngineerId))
    .where(sql`${r.status} in (${openStatuses})`)
    .orderBy(asc(r.createdAt))
    .limit(10) as Promise<{ id: string; seq: number; contactName: string; deviceType: DeviceType; status: ServiceStatus; priority: ServicePriority; createdAt: Date; engineer: string | null }[]>;
}

/** Per engineer, for the period: jobs given to them, completed as lead, helped on, handed back, transfers asked, money collected, leave days. */
async function engineerPerformance(range: Range, from: Date, to: Date) {
  const a = schema.serviceAssignments;
  const h = schema.serviceJobHelpers;
  const ev = schema.serviceEvents;
  const t = schema.transferRequests;
  const c = schema.serviceCollections;
  const [engineers, assigned, completed, helped, handed, transfers, collected, leave] = await Promise.all([
    listEngineers(),
    db.select({ id: a.engineerId, n: count() }).from(a).where(and(ne(a.method, "unassigned"), gte(a.createdAt, from), lt(a.createdAt, to))).groupBy(a.engineerId),
    db
      .select({ id: r.assignedEngineerId, n: count(), hours: hours(r.createdAt, r.completedAt) })
      .from(r)
      .where(and(eq(r.status, "completed"), gte(r.completedAt, from), lt(r.completedAt, to)))
      .groupBy(r.assignedEngineerId),
    db.select({ id: h.engineerId, n: sql<number>`count(distinct ${h.requestId})::int` }).from(h).where(and(gte(h.createdAt, from), lt(h.createdAt, to))).groupBy(h.engineerId),
    db.select({ id: ev.actorId, n: count() }).from(ev).where(and(eq(ev.toStatus, "unable_to_complete"), gte(ev.createdAt, from), lt(ev.createdAt, to))).groupBy(ev.actorId),
    db.select({ id: t.fromEngineerId, n: count() }).from(t).where(and(gte(t.createdAt, from), lt(t.createdAt, to))).groupBy(t.fromEngineerId),
    db
      .select({ id: c.recordedById, total: sql<number>`coalesce(sum(${c.amountPaise}), 0)::int` })
      .from(c)
      .innerJoin(schema.users, and(eq(schema.users.id, c.recordedById), inArray(schema.users.role, ["engineer"])))
      .where(and(gte(c.createdAt, from), lt(c.createdAt, to)))
      .groupBy(c.recordedById),
    leaveDaysInRange(range.from, range.to),
  ]);
  const pick = <T extends { id: string | null }>(rows: T[], id: string) => rows.find((x) => x.id === id);
  return engineers
    .map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`.trim(),
      activeNow: e.activeJobs,
      status: e.ineligible,
      assigned: pick(assigned, e.id)?.n ?? 0,
      completed: pick(completed, e.id)?.n ?? 0,
      hoursToComplete: pick(completed, e.id)?.hours ?? null,
      helped: pick(helped, e.id)?.n ?? 0,
      handedBack: pick(handed, e.id)?.n ?? 0,
      transfers: pick(transfers, e.id)?.n ?? 0,
      collectedPaise: pick(collected, e.id)?.total ?? 0,
      leaveDays: leave.get(e.id) ?? 0,
    }))
    .sort((x, y) => y.completed - x.completed || y.assigned - x.assigned || x.name.localeCompare(y.name));
}

/** Every job created in the period, one row each, for the CSV download. */
export async function serviceDeskRows(range: Range) {
  const eng = alias(schema.users, "eng");
  const from = start(range.from);
  const to = endExclusive(range.to);
  return db
    .select({
      seq: r.seq,
      createdAt: r.createdAt,
      status: r.status,
      priority: r.priority,
      deviceType: r.deviceType,
      device: sql<string>`trim(coalesce(${r.deviceBrand}, '') || ' ' || coalesce(${r.deviceModel}, ''))`,
      location: r.location,
      source: r.source,
      problemType: r.problemType,
      contactName: r.contactName,
      contactPhone: r.contactPhone,
      engineer: sql<string | null>`${eng.firstName} || ' ' || ${eng.lastName}`,
      helpers: sql<number>`(select count(*)::int from ${schema.serviceJobHelpers} h where h.request_id = ${r.id})`,
      acceptedAt: r.acceptedAt,
      completedAt: r.completedAt,
      collectedPaise: sql<number>`(select coalesce(sum(c.amount_paise), 0)::int from ${schema.serviceCollections} c where c.request_id = ${r.id})`,
    })
    .from(r)
    .leftJoin(eng, eq(eng.id, r.assignedEngineerId))
    .where(and(gte(r.createdAt, from), lt(r.createdAt, to)))
    .orderBy(asc(r.createdAt));
}
