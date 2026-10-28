import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { Suspense } from "react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { Badge, fullDateTimeFmt, Table, td } from "@/components/admin/ui";
import { requireStaff } from "@/lib/server/auth";
import { myTransfers } from "@/lib/server/engineer/jobs";
import { serviceNumber } from "@/lib/service-desk";

export const metadata: Metadata = { title: "Transfer requests" };

const tone = { pending: "warn", approved: "good", rejected: "bad", withdrawn: "muted" } as const;
const label = { pending: "Awaiting approval", approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn" } as const;

export default function TransfersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Transfers />
    </Suspense>
  );
}

async function Transfers() {
  const me = await requireStaff(["engineer"]);
  const rows = await myTransfers(me.id);
  return (
    <>
      <PageHeader title="Transfer requests" count={rows.length} description="Requests you've made to hand a job to a colleague. An admin approves or rejects each one; until then the job stays with you." />
      {rows.length === 0 ? (
        <EmptyState icon={<ArrowLeftRight className="size-5" aria-hidden />} title="No transfer requests">
          Ask for a transfer from a job&apos;s page if someone else should take it.
        </EmptyState>
      ) : (
        <Table columns={["Job", "To", "Reason", "Status", "Asked", "Decision"]} minWidth={860}>
          {rows.map(({ t, seq, stillMine, to }) => (
            <tr key={t.id}>
              <td className={`${td} font-medium`}>
                {stillMine ? (
                  <Link href={`/engineer/jobs/${t.requestId}`} className="text-fg hover:text-brand">
                    {serviceNumber(seq)}
                  </Link>
                ) : (
                  <span className="text-fg-muted">{serviceNumber(seq)}</span>
                )}
              </td>
              <td className={`${td} text-fg`}>{to}</td>
              <td className={`${td} max-w-xs whitespace-normal text-fg-muted`}>{t.reason}</td>
              <td className={td}>
                <Badge tone={tone[t.status]}>{label[t.status]}</Badge>
              </td>
              <td className={`${td} text-fg-muted`}>{fullDateTimeFmt.format(t.createdAt)}</td>
              <td className={`${td} max-w-xs whitespace-normal text-fg-muted`}>
                {t.decidedAt ? fullDateTimeFmt.format(t.decidedAt) : "—"}
                {t.decisionNote && <span className="block text-xs text-fg-dim">{t.decisionNote}</span>}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
