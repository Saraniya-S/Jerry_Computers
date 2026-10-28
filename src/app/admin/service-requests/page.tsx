import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, ClipboardPlus, MapPin, Store } from "lucide-react";
import { Suspense } from "react";
import { primaryButton } from "@/components/account/buttons";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { PriorityBadge, ServiceStatusBadge } from "@/components/admin/ServiceBadges";
import { Badge, DateRange, dateParam, dateTimeFmt, FilterBar, FilterSelect, oneOf, pageParam, Pagination, param, SearchInput, Table, td } from "@/components/admin/ui";
import { engineerWorkloads } from "@/lib/server/admin/assignment";
import { searchServiceRequests } from "@/lib/server/admin/service-requests";
import type { ServiceStatus } from "@/lib/server/db/schema";
import { requirePermission } from "@/lib/server/permissions";
import { deviceTypeLabel, deviceTypes, priorities, priorityLabel, serviceNumber, serviceStatuses, serviceStatusLabel } from "@/lib/service-desk";

export const metadata: Metadata = { title: "Service requests" };

const views = [
  ["active", "Active"],
  ["open", "Unassigned"],
  ["closed", "Completed & cancelled"],
  ["", "All"],
] as const;
const PAGE_SIZE = 25;

export default function ServiceRequestsPage({ searchParams }: PageProps<"/admin/service-requests">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ServiceRequests searchParams={searchParams} />
    </Suspense>
  );
}

async function ServiceRequests({ searchParams }: Pick<PageProps<"/admin/service-requests">, "searchParams">) {
  await requirePermission("service.manage");
  const sp = await searchParams;
  const status = oneOf(sp.status, [...serviceStatuses, "active", "closed"] as (ServiceStatus | "active" | "closed")[]);
  const engineerRaw = param(sp.engineer);
  const f = {
    q: param(sp.q),
    deviceType: oneOf(sp.device, deviceTypes),
    location: oneOf(sp.location, ["in_shop", "on_site"] as const),
    priority: oneOf(sp.priority, priorities),
    engineerId: engineerRaw === "none" || /^[0-9a-f-]{36}$/i.test(engineerRaw) ? engineerRaw : undefined,
    from: dateParam(sp.from),
    to: dateParam(sp.to),
    page: pageParam(sp.page),
  };
  const [{ rows, total }, engineers] = await Promise.all([searchServiceRequests({ ...f, status, pageSize: PAGE_SIZE }), engineerWorkloads()]);
  const params = { status, q: f.q, device: f.deviceType, location: f.location, priority: f.priority, engineer: f.engineerId, from: f.from, to: f.to };
  const tabHref = (s: string) => {
    const qs = new URLSearchParams(Object.entries({ ...params, status: s || undefined }).filter((e): e is [string, string] => Boolean(e[1]))).toString();
    return qs ? `/admin/service-requests?${qs}` : "/admin/service-requests";
  };

  return (
    <>
      <PageHeader
        title="Service requests"
        count={total}
        description="Repairs at the shop and on-site visits. New requests go automatically to the eligible engineer with the fewest active jobs."
        actions={
          <Link href="/admin/service-requests/new" className={primaryButton}>
            <ClipboardPlus className="size-4" aria-hidden /> New request
          </Link>
        }
      />
      <nav aria-label="Filter by status" className="flex gap-1 overflow-x-auto border-b border-line px-3 sm:px-5">
        {views.map(([key, label]) => {
          const active = (status ?? "") === key;
          return (
            <Link key={key || "all"} href={tabHref(key)} aria-current={active ? "page" : undefined} className={`relative shrink-0 px-3 py-3 text-sm ${active ? "font-medium text-fg" : "text-fg-muted hover:text-fg"}`}>
              {label}
              {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" />}
            </Link>
          );
        })}
      </nav>
      <FilterBar resetHref="/admin/service-requests">
        {status && !["active", "open", "closed"].includes(status) ? (
          <FilterSelect name="status" value={status} label="Status" all="Any status" options={serviceStatuses.map((s) => ({ value: s, label: serviceStatusLabel[s] }))} />
        ) : (
          status && <input type="hidden" name="status" value={status} />
        )}
        <SearchInput value={f.q} placeholder="Ticket, name, phone, model, serial" label="Search service requests" />
        <FilterSelect name="device" value={f.deviceType ?? ""} label="Device" all="All devices" options={deviceTypes.map((d) => ({ value: d, label: deviceTypeLabel[d] }))} />
        <FilterSelect name="location" value={f.location ?? ""} label="Location" all="In shop and on-site" options={[{ value: "in_shop", label: "In shop" }, { value: "on_site", label: "On-site" }]} />
        <FilterSelect name="priority" value={f.priority ?? ""} label="Priority" all="Any priority" options={priorities.map((p) => ({ value: p, label: priorityLabel[p] }))} />
        <FilterSelect
          name="engineer"
          value={f.engineerId ?? ""}
          label="Engineer"
          all="Any engineer"
          options={[{ value: "none", label: "Unassigned" }, ...engineers.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}`.trim() }))]}
        />
        <DateRange from={f.from} to={f.to} />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState icon={<ClipboardList className="size-5" aria-hidden />} title="No service requests match" action={<Link href="/admin/service-requests/new" className={primaryButton}>New request</Link>}>
          Log walk-in and phone jobs here; online bookings will appear here too once customer booking is switched on.
        </EmptyState>
      ) : (
        <>
          <Table columns={["Ticket", "Customer", "Device", "Where", "Priority", "Engineer", "Status", "Created"]} minWidth={980}>
            {rows.map((r) => (
              <tr key={r.id} className="group relative hover:bg-ink-950">
                <td className={`${td} font-medium`}>
                  <Link href={`/admin/service-requests/${r.id}`} className="after:absolute after:inset-0 group-hover:text-brand">
                    {serviceNumber(r.seq)}
                  </Link>
                </td>
                <td className={td}>
                  <span className="block text-fg">{r.contactName}</span>
                  <span className="block text-xs text-fg-dim">
                    {r.contactPhone}
                    {!r.customerId && " · walk-in"}
                  </span>
                </td>
                <td className={td}>
                  <span className="block text-fg">{deviceTypeLabel[r.deviceType]}</span>
                  <span className="block max-w-[14rem] truncate text-xs text-fg-dim">{[r.deviceBrand, r.deviceModel].filter(Boolean).join(" ") || r.issue}</span>
                </td>
                <td className={`${td} text-fg-muted`}>
                  {r.location === "on_site" ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" aria-hidden /> {r.serviceAddress?.city ?? "On-site"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Store className="size-3.5" aria-hidden /> In shop
                    </span>
                  )}
                </td>
                <td className={td}>
                  <PriorityBadge priority={r.priority} />
                </td>
                <td className={`${td} text-fg-muted`}>{r.engineerName ?? <Badge tone="warn">Unassigned</Badge>}</td>
                <td className={td}>
                  <ServiceStatusBadge status={r.status} />
                </td>
                <td className={`${td} text-fg-muted`}>{dateTimeFmt.format(r.createdAt)}</td>
              </tr>
            ))}
          </Table>
          <Pagination page={f.page} pageSize={PAGE_SIZE} total={total} params={params} path="/admin/service-requests" />
        </>
      )}
    </>
  );
}
