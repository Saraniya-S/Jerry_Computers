import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { Suspense } from "react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { FilterBar, FilterSelect, fullDateTimeFmt, oneOf, pageParam, Pagination, param, personName, Table, td } from "@/components/admin/ui";
import { listAudit, roleLabel } from "@/lib/server/admin/users";
import { requirePermission } from "@/lib/server/permissions";

export const metadata: Metadata = { title: "Activity log" };

const areas = {
  product: "Products",
  variant: "Variants",
  inventory: "Inventory",
  category: "Categories",
  brand: "Brands",
  order: "Orders and payments",
  shipment: "Shipments",
  service: "Service desk",
  engineer: "Engineer settings",
  user: "Accounts and roles",
} as const;
const PAGE_SIZE = 40;

export default function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Activity searchParams={searchParams} />
    </Suspense>
  );
}

async function Activity({ searchParams }: Pick<PageProps<"/admin/activity">, "searchParams">) {
  await requirePermission("reports.view");
  const sp = await searchParams;
  const area = oneOf(sp.area, Object.keys(areas) as (keyof typeof areas)[]);
  const entity = /^[0-9a-f-]{36}$/i.test(param(sp.entity)) ? param(sp.entity) : undefined;
  const page = pageParam(sp.page);
  const { rows, total } = await listAudit({ action: area ? `${area}.` : undefined, entityId: entity, page, pageSize: PAGE_SIZE });

  return (
    <>
      <PageHeader title="Activity log" count={total} description="Sensitive changes made in the admin area: who, what and when. Entries are written in the same transaction as the change." />
      <FilterBar resetHref="/admin/activity">
        <FilterSelect name="area" value={area ?? ""} label="Area" all="Everything" options={Object.entries(areas).map(([value, label]) => ({ value, label }))} />
        {entity && <input type="hidden" name="entity" value={entity} />}
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState icon={<ScrollText className="size-5" aria-hidden />} title="Nothing logged">
          Changes to products, stock, orders, payments, service jobs and accounts appear here.
        </EmptyState>
      ) : (
        <>
          <Table columns={["When", "Who", "What"]} minWidth={720}>
            {rows.map(({ log, actorFirst, actorLast, actorRole }) => (
              <tr key={log.id}>
                <td className={`${td} align-top text-fg-muted`}>{fullDateTimeFmt.format(log.createdAt)}</td>
                <td className={`${td} align-top`}>
                  <span className="block text-fg">{personName(actorFirst, actorLast) || "System"}</span>
                  {actorRole && <span className="block text-xs text-fg-dim">{roleLabel[actorRole]}</span>}
                </td>
                <td className={`${td} whitespace-normal`}>
                  <span className="block text-fg">{log.summary}</span>
                  <span className="block font-mono text-[11px] text-fg-dim">{log.action}</span>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} params={{ area, entity }} path="/admin/activity" />
        </>
      )}
    </>
  );
}
