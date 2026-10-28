import "server-only";
import { db, schema } from "../db";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Db = typeof db | Tx;

/** A business rule was broken; the message is safe to show to staff. */
export class AdminError extends Error {}

/** Postgres unique_violation, optionally on a specific constraint. */
export function isUniqueViolation(err: unknown, constraint?: string) {
  const e = (err as { cause?: { code?: string; constraint_name?: string } })?.cause ?? (err as { code?: string; constraint_name?: string });
  return e?.code === "23505" && (!constraint || e.constraint_name === constraint);
}

type AuditEntry = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  details?: Record<string, unknown>;
};

/** Records a sensitive change. Pass the transaction so the log entry commits with the change. */
export async function audit(q: Db, entry: AuditEntry) {
  await q.insert(schema.auditLogs).values({ ...entry, entityId: entry.entityId ?? null, details: entry.details ?? null });
}
