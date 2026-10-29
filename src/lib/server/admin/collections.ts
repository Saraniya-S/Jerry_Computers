import "server-only";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { formatPaise, parseRupees } from "@/lib/money";
import { collectionMethodLabel, serviceNumber, type CollectionMethodId } from "@/lib/service-desk";
import { db, schema } from "../db";
import { AdminError, audit } from "./tx";

/**
 * What the shop collected from the customer for a service job. Services aren't paid online; staff
 * record the money they took. Entries are never edited: an admin corrects with a negative entry.
 */
export const collectionInput = z.object({
  requestId: z.string().uuid(),
  amount: z.string().trim().min(1, "Enter the amount."),
  method: z.enum(Object.keys(collectionMethodLabel) as [CollectionMethodId, ...CollectionMethodId[]], { error: "Choose how it was paid." }),
  note: z.string().trim().max(200).default(""),
  /** Admin only: takes the amount off instead of adding it. */
  correction: z.boolean().default(false),
});

const MAX_PAISE = 10_00_000_00; // ₹10 lakh per entry

export async function recordCollection(actor: { id: string; role: string }, input: z.input<typeof collectionInput>) {
  const v = collectionInput.parse(input);
  const paise = parseRupees(v.amount);
  if (!paise || paise <= 0) throw new AdminError("Enter an amount in rupees, e.g. 1500.");
  if (paise > MAX_PAISE) throw new AdminError("That amount is too large for one entry.");
  if (v.correction && actor.role !== "admin") throw new AdminError("Only an admin can correct a collection.");
  if (v.correction && !v.note) throw new AdminError("Say what the correction is for.");

  return db.transaction(async (tx) => {
    const [job] = await tx.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, v.requestId)).for("update");
    if (!job) throw new AdminError("Service request not found.");
    if (actor.role === "engineer") {
      if (job.assignedEngineerId !== actor.id) throw new AdminError("This job isn't assigned to you.");
      if (job.status === "cancelled" || job.status === "open") throw new AdminError("Payments can only be recorded on jobs you're working on.");
    } else if (actor.role !== "admin") {
      throw new AdminError("Not allowed.");
    }
    const amount = v.correction ? -paise : paise;
    if (v.correction) {
      const [{ total }] = await tx
        .select({ total: sql<number>`coalesce(sum(${schema.serviceCollections.amountPaise}), 0)::int` })
        .from(schema.serviceCollections)
        .where(eq(schema.serviceCollections.requestId, job.id));
      if (total + amount < 0) throw new AdminError(`Only ${formatPaise(total)} is recorded on this job.`);
    }
    const [row] = await tx
      .insert(schema.serviceCollections)
      .values({ requestId: job.id, amountPaise: amount, method: v.method, note: v.note || null, recordedById: actor.id })
      .returning();
    const text = `${v.correction ? "Correction: " : "Collected "}${formatPaise(paise)} by ${collectionMethodLabel[v.method]}${v.note ? ` (${v.note})` : ""}`;
    await tx.insert(schema.serviceEvents).values({ requestId: job.id, note: text, actorId: actor.id });
    if (actor.role === "admin") {
      await audit(tx, { actorId: actor.id, action: "service.collection", entityType: "service_request", entityId: job.id, summary: `${serviceNumber(job.seq)}: ${text}` });
    }
    return row;
  });
}

export async function listCollections(requestId: string) {
  const rows = await db
    .select({ c: schema.serviceCollections, first: schema.users.firstName, last: schema.users.lastName })
    .from(schema.serviceCollections)
    .leftJoin(schema.users, eq(schema.users.id, schema.serviceCollections.recordedById))
    .where(eq(schema.serviceCollections.requestId, requestId))
    .orderBy(asc(schema.serviceCollections.createdAt));
  return {
    rows: rows.map((r) => ({ ...r.c, by: r.first ? `${r.first} ${r.last ?? ""}`.trim() : null })),
    totalPaise: rows.reduce((n, r) => n + r.c.amountPaise, 0),
  };
}
export type Collections = Awaited<ReturnType<typeof listCollections>>;

/** Money collected for service jobs between two instants, in total and by method. */
export async function collectionTotals(from: Date, toExclusive: Date) {
  const rows = await db
    .select({ method: schema.serviceCollections.method, total: sql<number>`coalesce(sum(${schema.serviceCollections.amountPaise}), 0)::int`, jobs: sql<number>`count(distinct ${schema.serviceCollections.requestId})::int` })
    .from(schema.serviceCollections)
    .where(and(gte(schema.serviceCollections.createdAt, from), lt(schema.serviceCollections.createdAt, toExclusive)))
    .groupBy(schema.serviceCollections.method);
  const [{ jobs }] = await db
    .select({ jobs: sql<number>`count(distinct ${schema.serviceCollections.requestId})::int` })
    .from(schema.serviceCollections)
    .where(and(gte(schema.serviceCollections.createdAt, from), lt(schema.serviceCollections.createdAt, toExclusive)));
  return { total: rows.reduce((n, r) => n + r.total, 0), jobs, byMethod: rows };
}
