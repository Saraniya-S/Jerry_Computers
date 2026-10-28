import type { Metadata } from "next";
import Link from "next/link";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { EngineerAccountToggle, EngineerSettingsForm } from "@/components/admin/EngineerForms";
import { PriorityBadge, ServiceStatusBadge } from "@/components/admin/ServiceBadges";
import { Badge, dateTimeFmt, fullDateTimeFmt, Panel, Table, td } from "@/components/admin/ui";
import { engineerWorkloads } from "@/lib/server/admin/assignment";
import { listTransfers } from "@/lib/server/admin/service-requests";
import { db, schema } from "@/lib/server/db";
import { requirePermission } from "@/lib/server/permissions";
import { ACTIVE_SERVICE_STATUSES, deviceTypeLabel, serviceNumber } from "@/lib/service-desk";

export const metadata: Metadata = { title: "Engineer" };

const methodLabel = { auto: "Automatic", manual: "Admin override", transfer: "Transfer", unassigned: "Unassigned" } as const;

export default function EngineerPage({ params }: PageProps<"/admin/engineers/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Engineer params={params} />
    </Suspense>
  );
}

async function Engineer({ params }: Pick<PageProps<"/admin/engineers/[id]">, "params">) {
  await requirePermission("engineers.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const e = (await engineerWorkloads()).find((x) => x.id === id);
  if (!e) notFound();
  const r = schema.serviceRequests;
  const job = alias(schema.serviceRequests, "job");
  const [[profile], active, completed, transfers, history] = await Promise.all([
    db.select().from(schema.engineerProfiles).where(eq(schema.engineerProfiles.userId, id)),
    db.select().from(r).where(and(eq(r.assignedEngineerId, id), inArray(r.status, ACTIVE_SERVICE_STATUSES))).orderBy(desc(r.priority), r.createdAt),
    db.select().from(r).where(and(eq(r.assignedEngineerId, id), eq(r.status, "completed"))).orderBy(desc(r.completedAt)).limit(20),
    listTransfers({ engineerId: id, limit: 20 }),
    db
      .select({ a: schema.serviceAssignments, seq: job.seq, requestId: job.id })
      .from(schema.serviceAssignments)
      .innerJoin(job, eq(job.id, schema.serviceAssignments.requestId))
      .where(or(eq(schema.serviceAssignments.engineerId, id), eq(schema.serviceAssignments.previousEngineerId, id)))
      .orderBy(desc(schema.serviceAssignments.createdAt))
      .limit(20),
  ]);
  const name = `${e.firstName} ${e.lastName}`.trim();
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(r).where(and(eq(r.assignedEngineerId, id), eq(r.status, "completed")));

  return (
    <>
      <PageHeader
        title={
          <>
            {name} {e.ineligible ? <Badge tone={e.disabled ? "muted" : "warn"}>{e.ineligible}</Badge> : <Badge tone="good">Taking jobs</Badge>}
          </>
        }
        description={`${e.email}${e.phone ? ` · ${e.phone}` : ""} · ${e.activeJobs} active · ${total} completed`}
        actions={
          <Link href="/admin/engineers" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden /> All engineers
          </Link>
        }
      />
      <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-4">
          <Panel title={`Active jobs (${active.length})`} href={`/admin/service-requests?engineer=${id}&status=active`}>
            {active.length ? (
              <Table columns={["Ticket", "Customer", "Device", "Priority", "Status", "Since"]} minWidth={640}>
                {active.map((j) => (
                  <tr key={j.id} className="group relative hover:bg-ink-950">
                    <td className={`${td} font-medium`}>
                      <Link href={`/admin/service-requests/${j.id}`} className="after:absolute after:inset-0 group-hover:text-brand">
                        {serviceNumber(j.seq)}
                      </Link>
                    </td>
                    <td className={`${td} text-fg`}>{j.contactName}</td>
                    <td className={`${td} text-fg-muted`}>
                      {deviceTypeLabel[j.deviceType]} · {j.location === "on_site" ? "on-site" : "in shop"}
                    </td>
                    <td className={td}>
                      <PriorityBadge priority={j.priority} />
                    </td>
                    <td className={td}>
                      <ServiceStatusBadge status={j.status} />
                    </td>
                    <td className={`${td} text-fg-muted`}>{j.assignedAt ? dateTimeFmt.format(j.assignedAt) : "—"}</td>
                  </tr>
                ))}
              </Table>
            ) : (
              <p className="px-5 py-4 text-sm text-fg-muted">No active jobs.</p>
            )}
          </Panel>
          <Panel title="Recently completed" href={`/admin/service-requests?engineer=${id}&status=completed`}>
            {completed.length ? (
              <ul className="divide-y divide-line text-sm">
                {completed.map((j) => (
                  <li key={j.id} className="px-4 py-2.5 sm:px-5">
                    <Link href={`/admin/service-requests/${j.id}`} className="font-medium text-fg hover:text-brand">
                      {serviceNumber(j.seq)}
                    </Link>{" "}
                    <span className="text-fg-muted">
                      {deviceTypeLabel[j.deviceType]} for {j.contactName}
                    </span>
                    <span className="block text-xs text-fg-dim">
                      Completed {j.completedAt ? fullDateTimeFmt.format(j.completedAt) : ""}
                      {j.resolution && ` · ${j.resolution}`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-fg-muted">No completed jobs yet.</p>
            )}
          </Panel>
          <Panel title="Transfer requests" href="/admin/transfers">
            {transfers.length ? (
              <ul className="divide-y divide-line text-sm">
                {transfers.map(({ t, job: j, from, to }) => (
                  <li key={t.id} className="px-4 py-2.5 sm:px-5">
                    <Link href={`/admin/service-requests/${j.id}`} className="font-medium text-fg hover:text-brand">
                      {serviceNumber(j.seq)}
                    </Link>{" "}
                    <span className="text-fg-muted">
                      {from} → {to}
                    </span>{" "}
                    <Badge tone={t.status === "pending" ? "warn" : t.status === "approved" ? "good" : t.status === "rejected" ? "bad" : "muted"}>{t.status}</Badge>
                    <span className="block text-xs text-fg-dim">
                      {fullDateTimeFmt.format(t.createdAt)} · {t.reason}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-fg-muted">No transfer requests.</p>
            )}
          </Panel>
          <Panel title="Assignment history">
            {history.length ? (
              <ul className="divide-y divide-line text-sm">
                {history.map(({ a, seq, requestId }) => (
                  <li key={a.id} className="px-4 py-2.5 sm:px-5">
                    <Link href={`/admin/service-requests/${requestId}`} className="font-medium text-fg hover:text-brand">
                      {serviceNumber(seq)}
                    </Link>{" "}
                    <span className="text-fg-muted">
                      {a.engineerId === id ? "assigned to them" : "moved away from them"} · {methodLabel[a.method]}
                    </span>
                    <span className="block text-xs text-fg-dim">
                      {fullDateTimeFmt.format(a.createdAt)}
                      {a.reason && ` · ${a.reason}`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-fg-muted">No assignments yet.</p>
            )}
          </Panel>
        </div>
        <div className="grid content-start gap-4">
          <section className="rounded-xl border border-line p-4">
            <h2 className="mb-3 text-sm font-medium text-fg">Job settings</h2>
            <EngineerSettingsForm userId={id} initial={{ isAvailable: profile?.isAvailable ?? true, skills: profile?.skills ?? [], takesOnSite: profile?.takesOnSite ?? true, notes: profile?.notes ?? "" }} />
          </section>
          <section className="grid gap-3 rounded-xl border border-line p-4 text-sm">
            <h2 className="font-medium text-fg">Account</h2>
            <p className="text-fg-muted">{e.disabled ? "Switched off: can't sign in." : e.hasPassword ? "Active." : "Invited; hasn't set a password yet. Resend the invite from Staff accounts."}</p>
            <EngineerAccountToggle userId={id} name={e.firstName} disabled={e.disabled} activeJobs={e.activeJobs} />
            <Link href={`/admin/activity?entity=${id}`} className="text-xs text-brand hover:underline">
              Activity about this account
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}
