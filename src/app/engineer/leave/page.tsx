import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { CalendarOff } from "lucide-react";
import { Suspense } from "react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { Badge } from "@/components/admin/ui";
import { CancelLeaveButton, LeaveRequestForm } from "@/components/engineer/LeaveForms";
import { requireStaff } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { leaveDates, MAX_LEAVE_DAYS, upcomingLeave } from "@/lib/server/engineer/leave";
import { istDay } from "@/lib/service-request-form";

export const metadata: Metadata = { title: "Leave" };

const statusBadge = { pending: <Badge tone="warn">Waiting for approval</Badge>, approved: <Badge tone="good">Approved</Badge>, rejected: <Badge tone="bad">Not approved</Badge> } as const;

export default function LeavePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Leave />
    </Suspense>
  );
}

async function Leave() {
  const me = await requireStaff(["engineer"]);
  const today = istDay();
  const [[profile], leave] = await Promise.all([db.select({ isAvailable: schema.engineerProfiles.isAvailable }).from(schema.engineerProfiles).where(eq(schema.engineerProfiles.userId, me.id)), upcomingLeave(me.id)]);
  return (
    <>
      <PageHeader title="Leave" description="Ask for days you can't take jobs. Once an admin approves, new jobs skip you on those days; the jobs you already have stay with you, so hand any urgent ones over before you go." />
      <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-4">
          {profile && !profile.isAvailable && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">An admin has paused new jobs for you. Ask the shop if that should change.</p>
          )}
          <section className="grid gap-3 rounded-xl border border-line p-4 sm:p-5">
            <h2 className="text-sm font-medium text-fg">Your leave</h2>
            {leave.length ? (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {leave.map((l) => {
                  const started = l.status === "approved" && l.startsOn <= today;
                  return (
                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                          {leaveDates(l)} {started ? <Badge tone="warn">On leave now</Badge> : statusBadge[l.status]}
                        </p>
                        {l.reason && <p className="mt-0.5 text-fg-muted">{l.reason}</p>}
                        {l.status === "rejected" && l.decisionNote && <p className="mt-0.5 text-red-700">Admin: {l.decisionNote}</p>}
                      </div>
                      {l.status !== "rejected" && <CancelLeaveButton leaveId={l.id} dates={leaveDates(l)} status={l.status} started={started} />}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={<CalendarOff className="size-5" aria-hidden />} title="No leave asked for">
                Ask for days off here. Once approved, new jobs won&apos;t be assigned to you on those days.
              </EmptyState>
            )}
          </section>
        </div>
        <section className="grid content-start gap-3 rounded-xl border border-line p-4 sm:p-5">
          <h2 className="text-sm font-medium text-fg">Ask for leave</h2>
          <LeaveRequestForm today={today} maxDays={MAX_LEAVE_DAYS} />
        </section>
      </div>
    </>
  );
}
