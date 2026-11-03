import type { Metadata } from "next";
import Link from "next/link";
import { CalendarOff } from "lucide-react";
import { Suspense } from "react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { LeaveDecision } from "@/components/admin/LeaveDecision";
import { Badge, fullDateTimeFmt, Panel } from "@/components/admin/ui";
import { leaveDates, leaveDays, leaveRequests } from "@/lib/server/engineer/leave";
import { requirePermission } from "@/lib/server/permissions";
import { istDay } from "@/lib/service-request-form";

export const metadata: Metadata = { title: "Leave requests" };

export default function LeaveRequestsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LeaveRequests />
    </Suspense>
  );
}

async function LeaveRequests() {
  await requirePermission("service.manage");
  const { pending, decided } = await leaveRequests();
  const today = istDay();
  const name = (r: { firstName: string; lastName: string }) => `${r.firstName} ${r.lastName}`.trim();

  return (
    <>
      <PageHeader title="Leave requests" count={pending.length} description="Engineers ask for days off. Until an admin approves, they keep getting new jobs. Approved leave stops new jobs on those days; their existing jobs stay with them." />
      <div className="grid gap-6 p-5 sm:p-7">
        {pending.length === 0 ? (
          <EmptyState icon={<CalendarOff className="size-5" aria-hidden />} title="No requests waiting">
            When an engineer asks for leave, it appears here for approval.
          </EmptyState>
        ) : (
          <ul className="grid gap-3">
            {pending.map((r) => {
              const passed = r.leave.endsOn < today;
              return (
                <li key={r.leave.id} className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-line p-4 text-sm">
                  <div className="grid min-w-0 gap-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                      <Link href={`/admin/engineers/${r.leave.engineerId}`} className="hover:text-brand">
                        {name(r)}
                      </Link>
                      <span className="text-fg-muted">·</span> {leaveDates(r.leave)}
                      <span className="text-fg-dim">({leaveDays(r.leave)} day{leaveDays(r.leave) === 1 ? "" : "s"})</span>
                      {passed && <Badge tone="muted">Dates passed</Badge>}
                    </p>
                    {r.leave.reason && <p className="text-fg-muted">“{r.leave.reason}”</p>}
                    <p className={r.jobsInside ? "text-amber-800" : "text-fg-dim"}>
                      {r.jobsInside ? `${r.jobsInside} of their open job${r.jobsInside === 1 ? " is" : "s are"} scheduled in those days.` : "No open jobs scheduled in those days."}
                    </p>
                    <p className="text-xs text-fg-dim">Asked {fullDateTimeFmt.format(r.leave.createdAt)}</p>
                  </div>
                  <LeaveDecision leaveId={r.leave.id} name={r.firstName} dates={leaveDates(r.leave)} jobsInside={r.jobsInside} />
                </li>
              );
            })}
          </ul>
        )}

        <Panel title="Decided in the last 30 days" count={decided.length}>
          {decided.length ? (
            <ul className="divide-y divide-line text-sm">
              {decided.map((r) => (
                <li key={r.leave.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                  <span>
                    <span className="font-medium text-fg">{name(r)}</span> <span className="text-fg-muted">· {leaveDates(r.leave)}</span>
                    {r.leave.decisionNote && <span className="block text-xs text-fg-muted">“{r.leave.decisionNote}”</span>}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-fg-dim">
                    <Badge tone={r.leave.status === "approved" ? "good" : "bad"}>{r.leave.status}</Badge>
                    {r.decidedBy?.trim() ? `by ${r.decidedBy.trim()}` : ""} {r.leave.decidedAt && fullDateTimeFmt.format(r.leave.decidedAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-fg-muted">Nothing decided recently.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
