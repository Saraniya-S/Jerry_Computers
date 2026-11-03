import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { ACTIVE_SERVICE_STATUSES } from "@/lib/service-desk";
import { istDay } from "@/lib/service-request-form";
import { AdminError, audit } from "../admin/tx";
import { db, schema } from "../db";
import { notify, notifyAdmins } from "../notifications";

/**
 * Engineer leave. An engineer asks for days off; an admin approves or rejects the request. While
 * approved leave covers today, automatic assignment passes them over (see engineerWorkloads); jobs
 * they already have stay with them, so the admin can reassign any that fall on those days.
 */

export const MAX_LEAVE_DAYS = 60;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");
const l = schema.engineerLeave;

export const leaveInput = z
  .object({
    startsOn: day,
    endsOn: day,
    reason: z.string().trim().max(200).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.endsOn < v.startsOn) ctx.addIssue({ code: "custom", path: ["endsOn"], message: "The last day can't be before the first." });
    if (v.startsOn < istDay()) ctx.addIssue({ code: "custom", path: ["startsOn"], message: "Choose today or a later day." });
    if (spanDays(v.startsOn, v.endsOn) > MAX_LEAVE_DAYS) ctx.addIssue({ code: "custom", path: ["endsOn"], message: `Ask for up to ${MAX_LEAVE_DAYS} days at a time.` });
  });

const spanDays = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
const shortDay = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
/** "5 Nov" or "5 Nov – 7 Nov" for a leave's dates. */
export const leaveDates = (x: { startsOn: string; endsOn: string }) => {
  const a = shortDay.format(new Date(`${x.startsOn}T00:00:00Z`));
  return x.startsOn === x.endsOn ? a : `${a} – ${shortDay.format(new Date(`${x.endsOn}T00:00:00Z`))}`;
};
export const leaveDays = (x: { startsOn: string; endsOn: string }) => spanDays(x.startsOn, x.endsOn);
const yesterday = () => istDay(new Date(Date.parse(`${istDay()}T00:00:00+05:30`) - 86_400_000));
const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();

async function engineer(id: string) {
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (!u || u.role !== "engineer") throw new AdminError("Not an engineer account.");
  return u;
}

/** The engineer's leave that hasn't finished yet (today included), soonest first, in any state. */
export async function upcomingLeave(engineerId: string) {
  return db
    .select()
    .from(l)
    .where(and(eq(l.engineerId, engineerId), gte(l.endsOn, istDay())))
    .orderBy(asc(l.startsOn));
}

/** Asks for leave. It takes effect only once an admin approves it. */
export async function requestLeave(engineerId: string, input: z.input<typeof leaveInput>) {
  const v = leaveInput.parse(input);
  const u = await engineer(engineerId);
  return db.transaction(async (tx) => {
    // Serialise this engineer's requests so two at once can't overlap.
    await tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, engineerId)).for("update");
    const [clash] = await tx
      .select({ id: l.id })
      .from(l)
      .where(and(eq(l.engineerId, engineerId), inArray(l.status, ["pending", "approved"]), lte(l.startsOn, v.endsOn), gte(l.endsOn, v.startsOn)));
    if (clash) throw new AdminError("You already have leave asked for or approved on some of those days.");
    const [leave] = await tx.insert(l).values({ engineerId, ...v }).returning();
    const when = leaveDates(leave);
    await audit(tx, { actorId: engineerId, action: "engineer.leave", entityType: "user", entityId: engineerId, summary: `${u.firstName} asked for leave: ${when}${v.reason ? ` (${v.reason})` : ""}` });
    await notifyAdmins(tx, { kind: "engineer.leave_requested", title: `${fullName(u)} asked for leave ${when}`, body: v.reason || "Approve or reject it in Leave requests.", href: "/admin/leave" });
    return leave;
  });
}

/**
 * The engineer withdraws a request or cancels approved leave. Approved leave that has started ends
 * yesterday, so today is a working day again.
 */
export async function cancelLeave(engineerId: string, leaveId: string) {
  const u = await engineer(engineerId);
  const today = istDay();
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(l)
      .where(and(eq(l.id, leaveId), eq(l.engineerId, engineerId)))
      .for("update");
    if (!row || row.endsOn < today || row.status === "rejected") throw new AdminError("That leave isn't there any more.");
    const when = leaveDates(row);
    if (row.status === "pending" || row.startsOn >= today) await tx.delete(l).where(eq(l.id, row.id));
    else await tx.update(l).set({ endsOn: yesterday() }).where(eq(l.id, row.id));
    await audit(tx, { actorId: engineerId, action: "engineer.leave", entityType: "user", entityId: engineerId, summary: `${u.firstName} ${row.status === "pending" ? "withdrew a leave request" : "cancelled leave"}: ${when}` });
    if (row.status === "approved") await notifyAdmins(tx, { kind: "engineer.leave_cancelled", title: `${fullName(u)} cancelled leave ${when}`, body: "They're back to taking new jobs on those days.", href: "/admin/leave" });
  });
}

/** An admin approves or rejects a pending request; a rejection needs a reason the engineer sees. */
export async function decideLeave(adminId: string, leaveId: string, approve: boolean, note = "") {
  const why = note.trim().slice(0, 300);
  if (!approve && !why) throw new AdminError("Say why the leave is rejected; the engineer will see it.");
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(l).where(eq(l.id, leaveId)).for("update");
    if (!row) throw new AdminError("Leave request not found.");
    if (row.status !== "pending") throw new AdminError(`This request was already ${row.status}.`);
    if (approve && row.endsOn < istDay()) throw new AdminError("Those days have already passed. Reject the request instead.");
    await tx.update(l).set({ status: approve ? "approved" : "rejected", decidedById: adminId, decidedAt: new Date(), decisionNote: why || null }).where(eq(l.id, row.id));
    const [u] = await tx.select().from(schema.users).where(eq(schema.users.id, row.engineerId));
    const when = leaveDates(row);
    await notify(tx, [row.engineerId], {
      kind: approve ? "engineer.leave_approved" : "engineer.leave_rejected",
      title: approve ? `Leave approved: ${when}` : `Leave not approved: ${when}`,
      body: why || (approve ? "No new jobs will be assigned to you on those days." : ""),
      href: "/engineer/leave",
    });
    await audit(tx, { actorId: adminId, action: "engineer.leave", entityType: "user", entityId: row.engineerId, summary: `${approve ? "Approved" : "Rejected"} ${u.firstName}'s leave: ${when}${why ? ` (${why})` : ""}` });
  });
}

/**
 * Requests for the admin: every pending one (oldest first), then decisions from the last 30 days.
 * Each carries how many of the engineer's open jobs are scheduled inside those dates.
 */
export async function leaveRequests() {
  const decider = alias(schema.users, "decider");
  const r = schema.serviceRequests;
  const cols = {
    leave: l,
    firstName: schema.users.firstName,
    lastName: schema.users.lastName,
    decidedBy: sql<string | null>`${decider.firstName} || ' ' || ${decider.lastName}`,
    jobsInside: sql<number>`(select count(*)::int from ${r} where ${r.assignedEngineerId} = ${l.engineerId}
      and ${r.status} in (${sql.join(ACTIVE_SERVICE_STATUSES.map((s) => sql`${s}`), sql`, `)})
      and (${r.scheduledAt} at time zone 'Asia/Kolkata')::date between ${l.startsOn} and ${l.endsOn})`,
  };
  const base = () =>
    db
      .select(cols)
      .from(l)
      .innerJoin(schema.users, eq(schema.users.id, l.engineerId))
      .leftJoin(decider, eq(decider.id, l.decidedById));
  const [pending, decided] = await Promise.all([
    base().where(eq(l.status, "pending")).orderBy(asc(l.startsOn)),
    base()
      .where(and(inArray(l.status, ["approved", "rejected"]), gte(l.decidedAt, new Date(Date.now() - 30 * 86_400_000))))
      .orderBy(desc(l.decidedAt))
      .limit(50),
  ]);
  return { pending, decided };
}

export async function pendingLeaveCount() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(l).where(and(eq(l.status, "pending"), gte(l.endsOn, istDay())));
  return n;
}

/** Approved leave days per engineer that fall inside a date range, for the service desk report. */
export async function leaveDaysInRange(from: string, to: string) {
  const rows = await db
    .select({ engineerId: l.engineerId, startsOn: l.startsOn, endsOn: l.endsOn })
    .from(l)
    .where(and(eq(l.status, "approved"), lte(l.startsOn, to), gte(l.endsOn, from)));
  const days = new Map<string, number>();
  for (const x of rows) {
    const a = x.startsOn < from ? from : x.startsOn;
    const b = x.endsOn > to ? to : x.endsOn;
    days.set(x.engineerId, (days.get(x.engineerId) ?? 0) + spanDays(a, b));
  }
  return days;
}

