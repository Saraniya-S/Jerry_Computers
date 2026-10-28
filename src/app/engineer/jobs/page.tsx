import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { Suspense } from "react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { FilterBar, FilterSelect, oneOf, pageParam, Pagination, param, SearchInput } from "@/components/admin/ui";
import { JobList } from "@/components/engineer/JobList";
import { requireStaff } from "@/lib/server/auth";
import type { ServiceStatus } from "@/lib/server/db/schema";
import { searchMyJobs } from "@/lib/server/engineer/jobs";
import { priorities, priorityLabel, serviceStatusLabel } from "@/lib/service-desk";

export const metadata: Metadata = { title: "My jobs" };

const statuses: ServiceStatus[] = ["assigned", "accepted", "in_progress", "awaiting_parts", "awaiting_customer", "unable_to_complete", "completed", "cancelled"];
const sorts = { priority: "Most urgent first", scheduled: "Scheduled time", assigned_desc: "Newest assignment", assigned_asc: "Oldest assignment" } as const;
const PAGE_SIZE = 20;

export default function MyJobsPage({ searchParams }: PageProps<"/engineer/jobs">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MyJobs searchParams={searchParams} />
    </Suspense>
  );
}

async function MyJobs({ searchParams }: Pick<PageProps<"/engineer/jobs">, "searchParams">) {
  const me = await requireStaff(["engineer"]);
  const sp = await searchParams;
  const f = {
    q: param(sp.q),
    status: oneOf(sp.status, [...statuses, "active", "closed"] as (ServiceStatus | "active" | "closed")[]) ?? (sp.status === "all" ? undefined : "active"),
    location: oneOf(sp.location, ["in_shop", "on_site"] as const),
    priority: oneOf(sp.priority, priorities),
    sort: oneOf(sp.sort, Object.keys(sorts) as (keyof typeof sorts)[]),
    page: pageParam(sp.page),
  };
  const { rows, total } = await searchMyJobs(me.id, { ...f, pageSize: PAGE_SIZE });
  const params = { q: f.q, status: sp.status === "all" ? "all" : f.status === "active" ? undefined : f.status, location: f.location, priority: f.priority, sort: f.sort };

  return (
    <>
      <PageHeader title="My jobs" count={total} description="Jobs currently assigned to you. Jobs moved to another engineer leave this list." />
      <FilterBar resetHref="/engineer/jobs">
        <SearchInput value={f.q} placeholder="Ticket, customer, model, serial" label="Search my jobs" />
        <select name="status" defaultValue={sp.status === "all" ? "all" : (f.status ?? "")} aria-label="Status" className="h-9 rounded-lg border border-line-strong bg-ink-850 px-2.5 text-sm text-fg">
          <option value="">Active</option>
          <option value="all">All</option>
          <option value="closed">Completed, cancelled and handed back</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {serviceStatusLabel[s]}
            </option>
          ))}
        </select>
        <FilterSelect name="location" value={f.location ?? ""} label="Service type" all="In shop and on-site" options={[{ value: "in_shop", label: "In shop" }, { value: "on_site", label: "On-site" }]} />
        <FilterSelect name="priority" value={f.priority ?? ""} label="Priority" all="Any priority" options={priorities.map((p) => ({ value: p, label: priorityLabel[p] }))} />
        <FilterSelect name="sort" value={f.sort ?? ""} label="Sort" all={sorts.priority} options={Object.entries(sorts).filter(([k]) => k !== "priority").map(([value, label]) => ({ value, label }))} />
      </FilterBar>
      {rows.length ? (
        <>
          <JobList jobs={rows} />
          <Pagination page={f.page} pageSize={PAGE_SIZE} total={total} params={params} path="/engineer/jobs" />
        </>
      ) : (
        <EmptyState icon={<ClipboardList className="size-5" aria-hidden />} title={f.q || f.location || f.priority ? "No jobs match" : "No jobs here"}>
          {f.q || f.location || f.priority ? "Try clearing a filter." : "New jobs are assigned to you automatically and show up here."}
        </EmptyState>
      )}
    </>
  );
}
