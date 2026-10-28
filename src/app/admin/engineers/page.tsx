import type { Metadata } from "next";
import Link from "next/link";
import { HardHat } from "lucide-react";
import { Suspense } from "react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { InviteEngineer } from "@/components/admin/EngineerForms";
import { Badge, dateTimeFmt, Table, td } from "@/components/admin/ui";
import { listEngineers } from "@/lib/server/admin/engineers";
import { requirePermission } from "@/lib/server/permissions";
import { deviceTypeLabel } from "@/lib/service-desk";

export const metadata: Metadata = { title: "Engineers" };

export default function EngineersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Engineers />
    </Suspense>
  );
}

async function Engineers() {
  await requirePermission("engineers.manage");
  const engineers = await listEngineers();
  return (
    <>
      <PageHeader title="Engineers" count={engineers.length} description="Workload, availability and skills. Listed in the order the automatic rule would pick them for a general job." actions={<InviteEngineer />} />
      {engineers.length === 0 ? (
        <EmptyState icon={<HardHat className="size-5" aria-hidden />} title="No engineers yet">
          Invite your service engineers. They set their own password from the email, then start receiving jobs.
        </EmptyState>
      ) : (
        <Table columns={["Engineer", "Active jobs", "Completed", "Takes", "Last assigned", "Status"]} minWidth={860}>
          {engineers.map((e) => (
            <tr key={e.id} className="group relative hover:bg-ink-950">
              <td className={td}>
                <Link href={`/admin/engineers/${e.id}`} className="font-medium text-fg after:absolute after:inset-0 group-hover:text-brand">
                  {`${e.firstName} ${e.lastName}`.trim()}
                </Link>
                <span className="block text-xs text-fg-dim">{e.phone ?? e.email}</span>
              </td>
              <td className={`${td} font-semibold tabular-nums text-fg`}>
                {e.activeJobs}
                {e.pendingTransfers > 0 && <span className="ml-2 text-xs font-normal text-amber-700">{e.pendingTransfers} transfer pending</span>}
              </td>
              <td className={`${td} tabular-nums text-fg-muted`}>
                {e.completed} <span className="text-xs text-fg-dim">· {e.completedLast30} in 30 days</span>
              </td>
              <td className={`${td} max-w-[16rem] whitespace-normal text-fg-muted`}>
                {e.skills.length ? e.skills.map((s) => deviceTypeLabel[s]).join(", ") : "All devices"}
                {!e.takesOnSite && <span className="block text-xs text-fg-dim">In-shop only</span>}
              </td>
              <td className={`${td} text-fg-muted`}>{e.lastAssignedAt ? dateTimeFmt.format(e.lastAssignedAt) : "Never"}</td>
              <td className={td}>{e.ineligible ? <Badge tone={e.disabled ? "muted" : "warn"}>{e.ineligible}</Badge> : <Badge tone="good">Taking jobs</Badge>}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
