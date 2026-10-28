import Link from "next/link";
import { CalendarClock, ChevronRight, MapPin, Store } from "lucide-react";
import { PriorityBadge, ServiceStatusBadge } from "@/components/admin/ServiceBadges";
import { Badge, dateTimeFmt, Table, td } from "@/components/admin/ui";
import type { ServiceRequest } from "@/lib/server/db/schema";
import { deviceTypeLabel, serviceNumber } from "@/lib/service-desk";

type Job = ServiceRequest & { transferPending?: boolean };

const device = (j: Job) => [deviceTypeLabel[j.deviceType], [j.deviceBrand, j.deviceModel].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
const where = (j: Job) => (j.location === "on_site" ? (j.serviceAddress ? `${j.serviceAddress.city} ${j.serviceAddress.postalCode}` : "On-site") : "In shop");

/** Jobs as a table on wider screens and as tappable cards on phones. */
export function JobList({ jobs }: { jobs: Job[] }) {
  return (
    <>
      <div className="hidden md:block">
        <Table columns={["Ticket", "Customer", "Device and problem", "Where", "Priority", "Status", "Scheduled", "Assigned"]} minWidth={1000}>
          {jobs.map((j) => (
            <tr key={j.id} className="group relative hover:bg-ink-950">
              <td className={`${td} font-medium`}>
                <Link href={`/engineer/jobs/${j.id}`} className="after:absolute after:inset-0 group-hover:text-brand">
                  {serviceNumber(j.seq)}
                </Link>
              </td>
              <td className={td}>
                <span className="block text-fg">{j.contactName}</span>
                <span className="block text-xs text-fg-dim">{j.contactPhone}</span>
              </td>
              <td className={td}>
                <span className="block text-fg">{device(j)}</span>
                <span className="block max-w-[16rem] truncate text-xs text-fg-dim">{j.issue}</span>
              </td>
              <td className={`${td} text-fg-muted`}>{where(j)}</td>
              <td className={td}>
                <PriorityBadge priority={j.priority} />
              </td>
              <td className={td}>
                <span className="flex gap-1.5">
                  <ServiceStatusBadge status={j.status} />
                  {j.transferPending && <Badge tone="warn">Transfer requested</Badge>}
                </span>
              </td>
              <td className={`${td} text-fg-muted`}>{j.scheduledAt ? dateTimeFmt.format(j.scheduledAt) : "—"}</td>
              <td className={`${td} text-fg-muted`}>{j.assignedAt ? dateTimeFmt.format(j.assignedAt) : "—"}</td>
            </tr>
          ))}
        </Table>
      </div>
      <ul className="divide-y divide-line md:hidden">
        {jobs.map((j) => (
          <li key={j.id}>
            <Link href={`/engineer/jobs/${j.id}`} className="flex items-start gap-3 px-5 py-4 active:bg-ink-950">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-fg">{serviceNumber(j.seq)}</span>
                  <ServiceStatusBadge status={j.status} />
                  <PriorityBadge priority={j.priority} />
                  {j.transferPending && <Badge tone="warn">Transfer requested</Badge>}
                </p>
                <p className="mt-1 text-sm text-fg">
                  {device(j)} · {j.contactName}
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm text-fg-muted">{j.issue}</p>
                <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-dim">
                  <span className="inline-flex items-center gap-1">
                    {j.location === "on_site" ? <MapPin className="size-3.5" aria-hidden /> : <Store className="size-3.5" aria-hidden />} {where(j)}
                  </span>
                  {j.scheduledAt && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3.5" aria-hidden /> {dateTimeFmt.format(j.scheduledAt)}
                    </span>
                  )}
                </p>
              </div>
              <ChevronRight className="mt-1 size-4 shrink-0 text-fg-dim" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
