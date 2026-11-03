import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, CalendarClock, CalendarOff, CircleCheck, ClipboardList, Hourglass, Inbox, TriangleAlert, Wrench } from "lucide-react";
import { Suspense } from "react";
import { outlineButton } from "@/components/account/buttons";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { dateTimeFmt, Kpi, Panel } from "@/components/admin/ui";
import { JobList } from "@/components/engineer/JobList";
import { requireStaff } from "@/lib/server/auth";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/server/db";
import { engineerSummary, recentActivity, searchMyJobs } from "@/lib/server/engineer/jobs";
import { leaveDates, upcomingLeave } from "@/lib/server/engineer/leave";
import { istDay } from "@/lib/service-request-form";
import { noteKindLabel, serviceNumber, serviceStatusLabel } from "@/lib/service-desk";

export const metadata: Metadata = { title: "Dashboard" };

export default function EngineerDashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const me = await requireStaff(["engineer"]);
  const [s, toAccept, activity, leave, [profile]] = await Promise.all([
    engineerSummary(me.id),
    searchMyJobs(me.id, { status: "assigned", sort: "priority", pageSize: 5 }),
    recentActivity(me.id),
    upcomingLeave(me.id),
    db.select({ isAvailable: schema.engineerProfiles.isAvailable }).from(schema.engineerProfiles).where(eq(schema.engineerProfiles.userId, me.id)),
  ]);
  const today = istDay();
  const approved = leave.filter((l) => l.status === "approved");
  const onLeave = approved.find((l) => l.startsOn <= today);
  const asked = leave.find((l) => l.status === "pending");
  const away = onLeave
    ? `You're on leave (${leaveDates(onLeave)}), so no new jobs are assigned to you.`
    : profile && !profile.isAvailable
      ? "An admin has paused new jobs for you."
      : approved[0]
        ? `Leave approved: ${leaveDates(approved[0])}.`
        : asked
          ? `Leave request waiting for approval: ${leaveDates(asked)}.`
          : null;

  return (
    <>
      <PageHeader
        title={`Hi ${me.firstName}`}
        description="Your workload right now. New jobs are assigned automatically; transfers need an admin's approval."
        actions={
          <Link href="/engineer/jobs" className={outlineButton}>
            <ClipboardList className="size-4" aria-hidden /> All my jobs
          </Link>
        }
      />
      {away && (
        <div className="mx-5 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:mx-7">
          <span className="inline-flex items-center gap-2">
            <CalendarOff className="size-4 shrink-0" aria-hidden /> {away}
          </span>
          <Link href="/engineer/leave" className="font-medium underline underline-offset-4">
            Manage leave
          </Link>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 p-5 sm:p-7 lg:grid-cols-4">
        <Kpi icon={<ClipboardList className="size-4" aria-hidden />} label="Active jobs" value={s.active} hint={s.helping ? `+ helping on ${s.helping}` : "your workload"} href="/engineer/jobs?status=active" />
        <Kpi icon={<Inbox className="size-4" aria-hidden />} label="New, to accept" value={s.unaccepted} href="/engineer/jobs?status=assigned" tone={s.unaccepted ? "warn" : undefined} />
        <Kpi icon={<CalendarClock className="size-4" aria-hidden />} label="Scheduled today" value={s.scheduledToday} href="/engineer/jobs?status=active&sort=scheduled" />
        <Kpi icon={<Wrench className="size-4" aria-hidden />} label="In progress" value={s.inProgress} href="/engineer/jobs?status=in_progress" />
        <Kpi icon={<Hourglass className="size-4" aria-hidden />} label="Waiting" value={s.waiting} hint={`${s.awaitingParts} parts · ${s.awaitingCustomer} customer`} href="/engineer/jobs?status=awaiting_parts" />
        <Kpi icon={<CircleCheck className="size-4" aria-hidden />} label="Completed" value={s.completed} hint={`${s.completedLast30} in 30 days`} href="/engineer/jobs?status=completed" />
        <Kpi icon={<ArrowLeftRight className="size-4" aria-hidden />} label="Transfers pending" value={s.pendingTransfers} href="/engineer/transfers" />
        <Kpi icon={<TriangleAlert className="size-4" aria-hidden />} label="Handed back" value={s.handedBack} hint="waiting for an admin" href="/engineer/jobs?status=unable_to_complete" />
      </div>

      <div className="grid gap-4 px-5 pb-7 sm:px-7 xl:grid-cols-[1.5fr_1fr]">
        <div className="grid content-start gap-4">
          <Panel title="Today's schedule" count={s.scheduledToday}>
            {s.todayJobs.length ? (
              <JobList jobs={s.todayJobs} />
            ) : (
              <p className="px-5 py-4 text-sm text-fg-muted">Nothing scheduled for today. Set a visit time on a job once you&apos;ve agreed it with the customer.</p>
            )}
          </Panel>
          <Panel title="New assignments to accept" count={s.unaccepted} href="/engineer/jobs?status=assigned">
            {toAccept.rows.length ? (
              <JobList jobs={toAccept.rows} />
            ) : (
              <EmptyState icon={<Inbox className="size-5" aria-hidden />} title="All caught up">
                New jobs assigned to you appear here until you accept them.
              </EmptyState>
            )}
          </Panel>
        </div>
        <Panel title="Recent activity on your jobs">
          {activity.length ? (
            <ul className="divide-y divide-line text-sm">
              {activity.map(({ e, seq, by }) => (
                <li key={e.id} className="px-4 py-2.5 sm:px-5">
                  <Link href={`/engineer/jobs/${e.requestId}`} className="font-medium text-fg hover:text-brand">
                    {serviceNumber(seq)}
                  </Link>{" "}
                  <span className="text-fg-muted">
                    {e.toStatus && e.fromStatus !== e.toStatus ? serviceStatusLabel[e.toStatus] : noteKindLabel[e.kind]}
                    {e.note && `: ${e.note}`}
                  </span>
                  <span className="block text-xs text-fg-dim">
                    {dateTimeFmt.format(e.createdAt)} · {by?.trim() || "System"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-fg-muted">No activity yet.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
