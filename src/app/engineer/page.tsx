import type { Metadata } from "next";
import { and, desc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ClipboardList } from "lucide-react";
import { Suspense } from "react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { fullDateTimeFmt } from "@/components/admin/ui";
import { EngineerJobCard } from "@/components/engineer/EngineerJobCard";
import { requireStaff } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { ACTIVE_SERVICE_STATUSES, deviceTypeLabel, serviceNumber } from "@/lib/service-desk";

export const metadata: Metadata = { title: "My jobs" };

const priorityRank = { urgent: 0, high: 1, normal: 2, low: 3 } as const;

export default function EngineerPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Jobs />
    </Suspense>
  );
}

async function Jobs() {
  const me = await requireStaff(["engineer"]);
  const r = schema.serviceRequests;
  const toEng = alias(schema.users, "to_eng");
  const [active, pending, colleagues, recent] = await Promise.all([
    db.select().from(r).where(and(eq(r.assignedEngineerId, me.id), inArray(r.status, ACTIVE_SERVICE_STATUSES))).orderBy(r.createdAt),
    db
      .select({ id: schema.transferRequests.id, requestId: schema.transferRequests.requestId, toFirst: toEng.firstName, toLast: toEng.lastName })
      .from(schema.transferRequests)
      .innerJoin(toEng, eq(toEng.id, schema.transferRequests.toEngineerId))
      .where(and(eq(schema.transferRequests.fromEngineerId, me.id), eq(schema.transferRequests.status, "pending"))),
    db
      .select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName })
      .from(schema.users)
      .where(and(eq(schema.users.role, "engineer"), ne(schema.users.id, me.id), isNull(schema.users.disabledAt), isNotNull(schema.users.passwordHash))),
    db.select().from(r).where(and(eq(r.assignedEngineerId, me.id), eq(r.status, "completed"))).orderBy(desc(r.completedAt)).limit(10),
  ]);
  active.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

  return (
    <>
      <PageHeader title={`Hi ${me.firstName}`} count={active.length} description="Your open jobs, most urgent first. Call the customer before an on-site visit." />
      <div className="grid gap-6 p-5 sm:p-7">
        {active.length === 0 ? (
          <EmptyState icon={<ClipboardList className="size-5" aria-hidden />} title="No open jobs">
            New jobs are assigned to you automatically and appear here.
          </EmptyState>
        ) : (
          <ul className="grid gap-3">
            {active.map((j) => {
              const t = pending.find((p) => p.requestId === j.id);
              return (
                <EngineerJobCard
                  key={j.id}
                  colleagues={colleagues.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`.trim() }))}
                  job={{ ...j, pendingTransfer: t ? { id: t.id, to: `${t.toFirst} ${t.toLast}`.trim() } : null }}
                />
              );
            })}
          </ul>
        )}
        {recent.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-medium text-fg">Recently completed</h2>
            <ul className="divide-y divide-line rounded-xl border border-line text-sm">
              {recent.map((j) => (
                <li key={j.id} className="px-4 py-2.5">
                  <span className="font-medium text-fg">{serviceNumber(j.seq)}</span> <span className="text-fg-muted">{deviceTypeLabel[j.deviceType]} for {j.contactName}</span>
                  <span className="block text-xs text-fg-dim">{j.completedAt && fullDateTimeFmt.format(j.completedAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
