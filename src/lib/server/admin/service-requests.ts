import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  ACTIVE_SERVICE_STATUSES,
  engineerFlow,
  isActiveStatus,
  isClosedStatus,
  noteKindLabel,
  notePrompt,
  noteRequiredFor,
  OPEN_FOR_ADMIN_STATUSES,
  serviceFlow,
  serviceNumber,
  serviceRequestInput,
  serviceStatusLabel,
  type ServiceRequestInput,
} from "@/lib/service-desk";
import { db, schema } from "../db";
import type { DeviceType, ServiceNoteKind, ServicePriority, ServiceStatus } from "../db/schema";
import { notify, notifyAdmins } from "../notifications";
import { applyAssignment, assertAssignableEngineer, autoAssign, engineerWorkloads, lockAssignments, pickEngineer } from "./assignment";
import { FieldError } from "./catalogue";
import { AdminError, audit, isUniqueViolation } from "./tx";

/**
 * Creates a service request and assigns it in the same transaction (see assignment.ts).
 * customerId links an account; otherwise the walk-in's contact details are stored on the job only.
 */
/** Fields only the customer request page sets; validated by its own module before they get here. */
export type OnlineRequestExtras = { serviceId: string; problemType: string | null; preferredDate: string | null; preferredWindow: string | null; clientRequestId: string };

export async function createServiceRequest(actorId: string, input: ServiceRequestInput, extras?: OnlineRequestExtras) {
  const parsed = serviceRequestInput.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[i.path.join(".")] ??= i.message;
    throw new FieldError(fields);
  }
  const v = parsed.data;

  return db.transaction(async (tx) => {
    let contact = { name: "", phone: "", email: null as string | null };
    if (v.customerId) {
      const [c] = await tx.select().from(schema.users).where(and(eq(schema.users.id, v.customerId), eq(schema.users.role, "customer")));
      if (!c) throw new FieldError({ customerId: "Customer not found." });
      if (!c.phone && !v.contact?.phone) throw new FieldError({ "contact.phone": "This customer has no mobile number on file. Enter one." });
      contact = { name: `${c.firstName} ${c.lastName}`.trim(), phone: v.contact?.phone ?? c.phone!, email: c.email };
    } else {
      contact = { name: `${v.contact!.firstName} ${v.contact!.lastName}`.trim(), phone: v.contact!.phone, email: v.contact!.email };
    }

    const [job] = await tx
      .insert(schema.serviceRequests)
      .values({
        customerId: v.customerId,
        contactName: contact.name,
        contactPhone: contact.phone,
        contactEmail: contact.email,
        source: v.source,
        location: v.location,
        serviceAddress: v.location === "on_site" ? v.address! : null,
        deviceType: v.deviceType,
        deviceBrand: v.deviceBrand,
        deviceModel: v.deviceModel,
        serialNumber: v.serialNumber,
        accessories: v.accessories,
        issue: v.issue,
        priority: v.priority,
        createdById: actorId,
        ...extras,
      })
      .returning();
    await tx.insert(schema.serviceEvents).values({ requestId: job.id, toStatus: "open", note: `Request created (${v.source.replace("_", "-")}, ${v.location === "on_site" ? "on-site" : "in shop"})`, actorId });
    const engineer = await autoAssign(tx, job.id, actorId);
    await audit(tx, {
      actorId,
      action: "service.create",
      entityType: "service_request",
      entityId: job.id,
      summary: `Created ${serviceNumber(job.seq)} for ${contact.name}${engineer ? `, assigned to ${engineer.firstName}` : ", unassigned"}`,
    });
    return { id: job.id, seq: job.seq, engineer };
  });
}

export const statusChangeInput = z.object({
  requestId: z.string().uuid(),
  to: z.enum(Object.keys(serviceStatusLabel) as [ServiceStatus, ...ServiceStatus[]]),
  note: z.string().trim().max(2000).default(""),
});

type Actor = { id: string; role: string };

/** Only admins and the job's current engineer may touch it. */
function assertCanWork(actor: Actor, job: { assignedEngineerId: string | null }) {
  if (actor.role === "admin") return "admin" as const;
  if (actor.role === "engineer" && job.assignedEngineerId === actor.id) return "engineer" as const;
  throw new AdminError("This job isn't assigned to you.");
}

/**
 * Moves a job along the workflow (serviceFlow for admins, engineerFlow for the assigned engineer).
 * Waiting, giving up, completing and cancelling need a note. The row is locked, so a second
 * "complete" from a double click finds the job already completed and is refused.
 */
export async function changeServiceStatus(actor: Actor, input: z.input<typeof statusChangeInput>) {
  const v = statusChangeInput.parse(input);
  return db.transaction(async (tx) => {
    // Status changes alter workloads, so they queue behind assignment decisions.
    await lockAssignments(tx);
    const [job] = await tx.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, v.requestId)).for("update");
    if (!job) throw new AdminError("Service request not found.");
    const as = assertCanWork(actor, job);
    const allowed = as === "engineer" ? engineerFlow(job.status) : serviceFlow[job.status];
    if (!allowed.includes(v.to)) throw new AdminError(`A job that is "${serviceStatusLabel[job.status]}" can't become "${serviceStatusLabel[v.to]}".`);
    if (noteRequiredFor(v.to) && !v.note) throw new AdminError(`${notePrompt[v.to]}: add a note to continue.`);

    const now = new Date();
    await tx
      .update(schema.serviceRequests)
      .set({
        status: v.to,
        ...(v.to === "accepted" ? { acceptedAt: now } : {}),
        ...(v.to === "completed" ? { completedAt: now, resolution: v.note } : {}),
        ...(v.to === "cancelled" ? { cancelledAt: now } : {}),
      })
      .where(eq(schema.serviceRequests.id, job.id));
    await tx.insert(schema.serviceEvents).values({
      requestId: job.id,
      fromStatus: job.status,
      toStatus: v.to,
      kind: v.to === "completed" ? "completion" : v.to === "awaiting_parts" ? "parts_required" : "note",
      note: v.note || null,
      actorId: actor.id,
    });
    if (v.to === "completed" || v.to === "cancelled" || v.to === "unable_to_complete") {
      await tx
        .update(schema.transferRequests)
        .set({ status: "withdrawn", decidedAt: now, decisionNote: `Job ${serviceStatusLabel[v.to].toLowerCase()}` })
        .where(and(eq(schema.transferRequests.requestId, job.id), eq(schema.transferRequests.status, "pending")));
    }

    const ticket = serviceNumber(job.seq);
    if (as === "admin") {
      await audit(tx, {
        actorId: actor.id,
        action: "service.status",
        entityType: "service_request",
        entityId: job.id,
        summary: `${ticket}: ${serviceStatusLabel[job.status]} → ${serviceStatusLabel[v.to]}${v.note ? ` (${v.note})` : ""}`,
      });
      if (job.assignedEngineerId && (v.to === "cancelled" || v.to === "completed")) {
        await notify(tx, [job.assignedEngineerId], { kind: `service.${v.to}`, title: `${ticket} was ${v.to} by an admin`, body: v.note, href: `/engineer/jobs/${job.id}` });
      }
    } else if (v.to === "unable_to_complete") {
      await notifyAdmins(tx, { kind: "service.unable", title: `${ticket} handed back: unable to complete`, body: v.note, href: `/admin/service-requests/${job.id}` });
    }
  });
}

export const workNoteInput = z.object({
  requestId: z.string().uuid(),
  kind: z.enum(Object.keys(noteKindLabel) as [ServiceNoteKind, ...ServiceNoteKind[]]),
  note: z.string().trim().min(1, "Write something first.").max(2000),
});

/** Adds a progress or work-report entry. Entries are append-only, so earlier reports are never overwritten. */
export async function addServiceNote(actor: Actor, input: z.input<typeof workNoteInput>) {
  const v = workNoteInput.parse(input);
  if (v.kind === "completion") throw new AdminError("The completion report is written by completing the job.");
  await db.transaction(async (tx) => {
    const [job] = await tx.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, v.requestId)).for("update");
    if (!job) throw new AdminError("Service request not found.");
    assertCanWork(actor, job);
    if (isClosedStatus(job.status) && v.kind !== "follow_up" && v.kind !== "customer_feedback") throw new AdminError("This job is closed. Only follow-up notes and customer feedback can be added.");
    await tx.insert(schema.serviceEvents).values({ requestId: job.id, kind: v.kind, note: v.note, actorId: actor.id });
  });
}

export const scheduleInput = z.object({
  requestId: z.string().uuid(),
  /** ISO date-time, or null to clear. */
  scheduledAt: z.union([z.coerce.date(), z.null()]),
  note: z.string().trim().max(300).default(""),
});

/** Sets or clears the visit/bench time. The assigned engineer may schedule their own open jobs; admins any open job. */
export async function setSchedule(actor: Actor, input: z.input<typeof scheduleInput>) {
  const v = scheduleInput.parse(input);
  await db.transaction(async (tx) => {
    const [job] = await tx.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, v.requestId)).for("update");
    if (!job) throw new AdminError("Service request not found.");
    const as = assertCanWork(actor, job);
    if (!isActiveStatus(job.status) && !(as === "admin" && job.status === "open")) throw new AdminError("Only open jobs can be scheduled.");
    if (v.scheduledAt && Number.isNaN(v.scheduledAt.getTime())) throw new AdminError("Choose a valid date and time.");
    if (v.scheduledAt && v.scheduledAt.getTime() < Date.now() - 60 * 60 * 1000) throw new AdminError("Choose a time that hasn't passed.");
    await tx.update(schema.serviceRequests).set({ scheduledAt: v.scheduledAt }).where(eq(schema.serviceRequests.id, job.id));
    const when = v.scheduledAt ? scheduleFmt.format(v.scheduledAt) : null;
    await tx.insert(schema.serviceEvents).values({ requestId: job.id, note: `${when ? `Scheduled for ${when}` : "Schedule cleared"}${v.note ? `: ${v.note}` : ""}`, actorId: actor.id });
    if (as === "admin" && job.assignedEngineerId) {
      await notify(tx, [job.assignedEngineerId], { kind: "service.scheduled", title: `${serviceNumber(job.seq)} ${when ? `scheduled for ${when}` : "schedule cleared"}`, href: `/engineer/jobs/${job.id}` });
    }
  });
}

const scheduleFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/**
 * Admin override: assign to a chosen engineer (even one marked unavailable or without the skill),
 * re-run the automatic choice, or unassign. Always needs a reason, which goes into the history.
 */
export async function overrideAssignment(adminId: string, requestId: string, target: { engineerId: string } | { auto: true } | { unassign: true }, reason: string) {
  const why = reason.trim();
  if (!why) throw new AdminError("Give a reason for changing the assignment.");
  return db.transaction(async (tx) => {
    await lockAssignments(tx);
    const [job] = await tx.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, requestId)).for("update");
    if (!job) throw new AdminError("Service request not found.");
    if (!(OPEN_FOR_ADMIN_STATUSES as readonly string[]).includes(job.status)) throw new AdminError("This job is closed.");

    if ("unassign" in target) {
      if (!job.assignedEngineerId) throw new AdminError("The job is already unassigned.");
      await applyAssignment(tx, requestId, { engineerId: null, method: "unassigned", reason: why, decidedById: adminId });
      return null;
    }
    if ("auto" in target) {
      const pick = await pickEngineer(tx, { deviceType: job.deviceType, location: job.location }, job.assignedEngineerId ? [job.assignedEngineerId] : []);
      if (!pick) throw new AdminError("No other eligible engineer is available right now.");
      await applyAssignment(tx, requestId, { engineerId: pick.id, method: "manual", reason: `Re-assigned automatically: ${why}`, decidedById: adminId, activeJobsBefore: pick.activeJobs });
      return pick.id;
    }
    await assertAssignableEngineer(tx, target.engineerId);
    const [{ n }] = await tx
      .select({ n: count() })
      .from(schema.serviceRequests)
      .where(and(eq(schema.serviceRequests.assignedEngineerId, target.engineerId), inArray(schema.serviceRequests.status, ACTIVE_SERVICE_STATUSES)));
    await applyAssignment(tx, requestId, { engineerId: target.engineerId, method: "manual", reason: why, decidedById: adminId, activeJobsBefore: n });
    return target.engineerId;
  });
}

/* Transfers */

export async function requestTransfer(engineerId: string, requestId: string, toEngineerId: string, reason: string) {
  const why = z.string().trim().min(5, "Explain why the job should move.").max(500).parse(reason);
  if (toEngineerId === engineerId) throw new AdminError("Choose another engineer.");
  try {
    return await db.transaction(async (tx) => {
      const [job] = await tx.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, requestId)).for("update");
      if (!job) throw new AdminError("Service request not found.");
      if (job.assignedEngineerId !== engineerId) throw new AdminError("You can only ask to transfer jobs assigned to you.");
      if (!isActiveStatus(job.status)) throw new AdminError("This job is closed.");
      const target = await assertAssignableEngineer(tx, toEngineerId);
      // Same eligibility as automatic assignment: available, takes this device and location.
      const candidate = (await engineerWorkloads(tx, { deviceType: job.deviceType, location: job.location })).find((e) => e.id === toEngineerId);
      if (candidate?.ineligible) throw new AdminError(`${target.firstName} can't take this job: ${candidate.ineligible.toLowerCase()}.`);
      const [t] = await tx.insert(schema.transferRequests).values({ requestId, fromEngineerId: engineerId, toEngineerId, reason: why }).returning();
      await tx.insert(schema.serviceEvents).values({ requestId, note: `Transfer to ${target.firstName} requested: ${why}`, actorId: engineerId });
      await notifyAdmins(tx, { kind: "transfer.requested", title: `Transfer requested for ${serviceNumber(job.seq)}`, body: why, href: "/admin/transfers" });
      return t;
    });
  } catch (err) {
    if (isUniqueViolation(err, "transfer_requests_one_pending_key")) throw new AdminError("There's already a transfer request waiting for this job.");
    throw err;
  }
}

export async function withdrawTransfer(engineerId: string, transferId: string) {
  const [t] = await db
    .update(schema.transferRequests)
    .set({ status: "withdrawn", decidedAt: new Date(), decisionNote: "Withdrawn by the engineer" })
    .where(and(eq(schema.transferRequests.id, transferId), eq(schema.transferRequests.fromEngineerId, engineerId), eq(schema.transferRequests.status, "pending")))
    .returning();
  if (!t) throw new AdminError("That request is no longer pending.");
}

/**
 * Approves or rejects a transfer. Approval re-checks that the job is still with the requesting
 * engineer and the target can still take jobs, then moves it; rejection leaves the assignment alone.
 */
export async function decideTransfer(adminId: string, transferId: string, approve: boolean, note: string) {
  const decisionNote = note.trim().slice(0, 500) || null;
  if (!approve && !decisionNote) throw new AdminError("Give the engineer a reason for rejecting the transfer.");
  return db.transaction(async (tx) => {
    await lockAssignments(tx);
    const [t] = await tx.select().from(schema.transferRequests).where(eq(schema.transferRequests.id, transferId)).for("update");
    if (!t) throw new AdminError("Transfer request not found.");
    if (t.status !== "pending") throw new AdminError(`This request was already ${t.status}.`);
    const [job] = await tx.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, t.requestId)).for("update");

    if (approve) {
      if (job.assignedEngineerId !== t.fromEngineerId || !isActiveStatus(job.status)) {
        throw new AdminError("The job has changed since this was requested (reassigned or closed). Reject it instead.");
      }
      await assertAssignableEngineer(tx, t.toEngineerId);
      const [{ n }] = await tx
        .select({ n: count() })
        .from(schema.serviceRequests)
        .where(and(eq(schema.serviceRequests.assignedEngineerId, t.toEngineerId), inArray(schema.serviceRequests.status, ACTIVE_SERVICE_STATUSES)));
      // Mark it decided first: applyAssignment withdraws any request still pending.
      await tx.update(schema.transferRequests).set({ status: "approved", decidedById: adminId, decidedAt: new Date(), decisionNote }).where(eq(schema.transferRequests.id, t.id));
      await applyAssignment(tx, job.id, { engineerId: t.toEngineerId, method: "transfer", reason: t.reason, decidedById: adminId, activeJobsBefore: n });
      await notify(tx, [t.fromEngineerId], { kind: "transfer.approved", title: `Transfer of ${serviceNumber(job.seq)} approved`, body: decisionNote ?? "", href: "/engineer/transfers" });
    } else {
      await tx.update(schema.transferRequests).set({ status: "rejected", decidedById: adminId, decidedAt: new Date(), decisionNote }).where(eq(schema.transferRequests.id, t.id));
      await tx.insert(schema.serviceEvents).values({ requestId: job.id, note: `Transfer request rejected: ${decisionNote}`, actorId: adminId });
      await notify(tx, [t.fromEngineerId], { kind: "transfer.rejected", title: `Transfer of ${serviceNumber(job.seq)} rejected`, body: decisionNote ?? "", href: `/engineer/jobs/${job.id}` });
      await audit(tx, { actorId: adminId, action: "service.transfer_reject", entityType: "service_request", entityId: job.id, summary: `${serviceNumber(job.seq)}: rejected transfer request (${decisionNote})` });
    }
  });
}

const fromEng = alias(schema.users, "from_eng");
const toEng = alias(schema.users, "to_eng");
const decider = alias(schema.users, "decider");

export async function listTransfers({ status, engineerId, requestId, limit = 50 }: { status?: "pending" | "approved" | "rejected" | "withdrawn"; engineerId?: string; requestId?: string; limit?: number }) {
  const where: SQL[] = [];
  if (status) where.push(eq(schema.transferRequests.status, status));
  if (engineerId) where.push(or(eq(schema.transferRequests.fromEngineerId, engineerId), eq(schema.transferRequests.toEngineerId, engineerId))!);
  if (requestId) where.push(eq(schema.transferRequests.requestId, requestId));
  return db
    .select({
      t: schema.transferRequests,
      job: {
        id: schema.serviceRequests.id,
        seq: schema.serviceRequests.seq,
        status: schema.serviceRequests.status,
        deviceType: schema.serviceRequests.deviceType,
        issue: schema.serviceRequests.issue,
        contactName: schema.serviceRequests.contactName,
        location: schema.serviceRequests.location,
        priority: schema.serviceRequests.priority,
        assignedEngineerId: schema.serviceRequests.assignedEngineerId,
      },
      from: sql<string>`${fromEng.firstName} || ' ' || ${fromEng.lastName}`,
      to: sql<string>`${toEng.firstName} || ' ' || ${toEng.lastName}`,
      decidedBy: sql<string | null>`${decider.firstName} || ' ' || ${decider.lastName}`,
    })
    .from(schema.transferRequests)
    .innerJoin(schema.serviceRequests, eq(schema.serviceRequests.id, schema.transferRequests.requestId))
    .innerJoin(fromEng, eq(fromEng.id, schema.transferRequests.fromEngineerId))
    .innerJoin(toEng, eq(toEng.id, schema.transferRequests.toEngineerId))
    .leftJoin(decider, eq(decider.id, schema.transferRequests.decidedById))
    .where(where.length ? and(...where) : undefined)
    .orderBy(status === "pending" ? asc(schema.transferRequests.createdAt) : desc(schema.transferRequests.createdAt))
    .limit(limit);
}

/* Reads */

export type ServiceQuery = {
  q?: string;
  status?: ServiceStatus | "active" | "closed";
  deviceType?: DeviceType;
  location?: "in_shop" | "on_site";
  priority?: ServicePriority;
  engineerId?: string | "none";
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

const engineer = alias(schema.users, "engineer");
const istDay = (d: string) => new Date(`${d}T00:00:00+05:30`);

export async function searchServiceRequests(f: ServiceQuery = {}) {
  const where: SQL[] = [];
  if (f.status === "active") where.push(inArray(schema.serviceRequests.status, OPEN_FOR_ADMIN_STATUSES));
  else if (f.status === "closed") where.push(inArray(schema.serviceRequests.status, ["completed", "cancelled"]));
  else if (f.status) where.push(eq(schema.serviceRequests.status, f.status));
  if (f.deviceType) where.push(eq(schema.serviceRequests.deviceType, f.deviceType));
  if (f.location) where.push(eq(schema.serviceRequests.location, f.location));
  if (f.priority) where.push(eq(schema.serviceRequests.priority, f.priority));
  if (f.engineerId === "none") where.push(sql`${schema.serviceRequests.assignedEngineerId} is null`);
  else if (f.engineerId) where.push(eq(schema.serviceRequests.assignedEngineerId, f.engineerId));
  if (f.from) where.push(gte(schema.serviceRequests.createdAt, istDay(f.from)));
  if (f.to) where.push(lt(schema.serviceRequests.createdAt, new Date(istDay(f.to).getTime() + 86_400_000)));
  const q = f.q?.trim();
  if (q) {
    const seq = /^(sr-?)?0*(\d{1,9})$/i.exec(q);
    const like = `%${q}%`;
    where.push(
      or(
        seq ? eq(schema.serviceRequests.seq, Number(seq[2])) : undefined,
        ilike(schema.serviceRequests.contactName, like),
        ilike(schema.serviceRequests.contactPhone, like),
        ilike(schema.serviceRequests.contactEmail, like),
        ilike(schema.serviceRequests.deviceModel, like),
        ilike(schema.serviceRequests.serialNumber, like),
        ilike(schema.serviceRequests.issue, like),
      )!,
    );
  }
  const cond = where.length ? and(...where) : undefined;
  const pageSize = Math.min(f.pageSize ?? 25, 100);
  const page = Math.max(1, f.page ?? 1);
  const [rows, [{ n }]] = await Promise.all([
    db
      .select({ r: schema.serviceRequests, engineerName: sql<string | null>`${engineer.firstName} || ' ' || ${engineer.lastName}` })
      .from(schema.serviceRequests)
      .leftJoin(engineer, eq(engineer.id, schema.serviceRequests.assignedEngineerId))
      .where(cond)
      .orderBy(desc(schema.serviceRequests.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(schema.serviceRequests).where(cond),
  ]);
  return { rows: rows.map((r) => ({ ...r.r, engineerName: r.engineerName })), total: n, page, pageSize };
}

export async function getServiceRequest(id: string) {
  const [row] = await db
    .select({ r: schema.serviceRequests, engineerName: sql<string | null>`${engineer.firstName} || ' ' || ${engineer.lastName}`, engineerPhone: engineer.phone })
    .from(schema.serviceRequests)
    .leftJoin(engineer, eq(engineer.id, schema.serviceRequests.assignedEngineerId))
    .where(eq(schema.serviceRequests.id, id));
  if (!row) return null;
  const actor = alias(schema.users, "actor");
  const prev = alias(schema.users, "prev");
  const [events, assignments, customer] = await Promise.all([
    db
      .select({ e: schema.serviceEvents, by: sql<string | null>`${actor.firstName} || ' ' || ${actor.lastName}`, byRole: actor.role })
      .from(schema.serviceEvents)
      .leftJoin(actor, eq(actor.id, schema.serviceEvents.actorId))
      .where(eq(schema.serviceEvents.requestId, id))
      .orderBy(asc(schema.serviceEvents.createdAt)),
    db
      .select({
        a: schema.serviceAssignments,
        to: sql<string | null>`${engineer.firstName} || ' ' || ${engineer.lastName}`,
        from: sql<string | null>`${prev.firstName} || ' ' || ${prev.lastName}`,
        by: sql<string | null>`${actor.firstName} || ' ' || ${actor.lastName}`,
      })
      .from(schema.serviceAssignments)
      .leftJoin(engineer, eq(engineer.id, schema.serviceAssignments.engineerId))
      .leftJoin(prev, eq(prev.id, schema.serviceAssignments.previousEngineerId))
      .leftJoin(actor, eq(actor.id, schema.serviceAssignments.decidedById))
      .where(eq(schema.serviceAssignments.requestId, id))
      .orderBy(desc(schema.serviceAssignments.createdAt)),
    row.r.customerId
      ? db
          .select({ id: schema.users.id, email: schema.users.email, phone: schema.users.phone, companyName: schema.users.companyName, createdAt: schema.users.createdAt })
          .from(schema.users)
          .where(eq(schema.users.id, row.r.customerId))
          .then((r) => r[0] ?? null)
      : null,
  ]);
  return { ...row.r, engineerName: row.engineerName, engineerPhone: row.engineerPhone, events, assignments, customer };
}
export type ServiceRequestDetail = NonNullable<Awaited<ReturnType<typeof getServiceRequest>>>;
