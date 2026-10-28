import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, ArrowRight } from "lucide-react";
import { Suspense } from "react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { PriorityBadge, ServiceStatusBadge } from "@/components/admin/ServiceBadges";
import { TransferDecision } from "@/components/admin/TransferDecision";
import { Badge, fullDateTimeFmt, oneOf } from "@/components/admin/ui";
import { listTransfers } from "@/lib/server/admin/service-requests";
import { requirePermission } from "@/lib/server/permissions";
import { deviceTypeLabel, serviceNumber } from "@/lib/service-desk";

export const metadata: Metadata = { title: "Transfer approvals" };

const tabs = ["pending", "approved", "rejected", "withdrawn"] as const;
const tone = { pending: "warn", approved: "good", rejected: "bad", withdrawn: "muted" } as const;

export default function TransfersPage({ searchParams }: PageProps<"/admin/transfers">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Transfers searchParams={searchParams} />
    </Suspense>
  );
}

async function Transfers({ searchParams }: Pick<PageProps<"/admin/transfers">, "searchParams">) {
  await requirePermission("service.manage");
  const sp = await searchParams;
  const status = oneOf(sp.status, tabs) ?? "pending";
  const rows = await listTransfers({ status, limit: 100 });

  return (
    <>
      <PageHeader title="Transfer approvals" count={status === "pending" ? rows.length : undefined} description="Engineers ask to hand a job to a colleague. Nothing moves until an admin approves." />
      <nav aria-label="Filter by status" className="flex gap-1 overflow-x-auto border-b border-line px-3 sm:px-5">
        {tabs.map((t) => (
          <Link key={t} href={t === "pending" ? "/admin/transfers" : `/admin/transfers?status=${t}`} aria-current={status === t ? "page" : undefined} className={`relative shrink-0 px-3 py-3 text-sm capitalize ${status === t ? "font-medium text-fg" : "text-fg-muted hover:text-fg"}`}>
            {t}
            {status === t && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" />}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState icon={<ArrowLeftRight className="size-5" aria-hidden />} title={status === "pending" ? "No requests waiting" : `No ${status} requests`}>
          {status === "pending" ? "When an engineer asks to transfer a job, it appears here for approval." : "Decided requests are kept here for reference."}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 p-5 sm:p-7">
          {rows.map(({ t, job, from, to, decidedBy }) => {
            const ticket = serviceNumber(job.seq);
            return (
              <li key={t.id} className="grid gap-3 rounded-xl border border-line p-4 text-sm sm:grid-cols-[1fr_auto] sm:items-start">
                <div className="grid gap-2">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/service-requests/${job.id}`} className="font-medium text-fg hover:text-brand">
                      {ticket}
                    </Link>
                    <ServiceStatusBadge status={job.status} />
                    <PriorityBadge priority={job.priority} />
                    {status !== "pending" && <Badge tone={tone[t.status]}>{t.status}</Badge>}
                  </p>
                  <p className="text-fg-muted">
                    {deviceTypeLabel[job.deviceType]} for {job.contactName} · {job.location === "on_site" ? "on-site" : "in shop"} · <span className="line-clamp-1 inline">{job.issue}</span>
                  </p>
                  <p className="flex items-center gap-2 text-fg">
                    <span>{from}</span>
                    <ArrowRight className="size-4 text-fg-dim" aria-label="to" />
                    <span className="font-medium">{to}</span>
                  </p>
                  <blockquote className="border-l-2 border-line-strong pl-3 text-fg-muted">{t.reason}</blockquote>
                  <p className="text-xs text-fg-dim">
                    Requested {fullDateTimeFmt.format(t.createdAt)}
                    {t.decidedAt && ` · ${t.status} ${fullDateTimeFmt.format(t.decidedAt)}${decidedBy?.trim() ? ` by ${decidedBy}` : ""}`}
                    {t.decisionNote && ` · “${t.decisionNote}”`}
                  </p>
                  {t.status === "pending" && job.assignedEngineerId !== t.fromEngineerId && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">The job has been reassigned since this was requested. It can only be rejected.</p>
                  )}
                </div>
                {t.status === "pending" && <TransferDecision transferId={t.id} from={from} to={to} ticket={ticket} />}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
