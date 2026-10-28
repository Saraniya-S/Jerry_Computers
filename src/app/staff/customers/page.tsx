import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { Suspense } from "react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { Badge, dateFmt, FilterBar, pageParam, Pagination, param, SearchInput, Table, td } from "@/components/admin/ui";
import { searchCustomers } from "@/lib/server/admin/users";
import { requirePermission } from "@/lib/server/permissions";

export const metadata: Metadata = { title: "Customers" };

const PAGE_SIZE = 25;

export default function StaffCustomersPage({ searchParams }: PageProps<"/staff/customers">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Customers searchParams={searchParams} />
    </Suspense>
  );
}

/** Read-only customer lookup for processing orders. Account changes stay with admins. */
async function Customers({ searchParams }: Pick<PageProps<"/staff/customers">, "searchParams">) {
  await requirePermission("customers.view", "/staff/customers");
  const sp = await searchParams;
  const q = param(sp.q);
  const page = pageParam(sp.page);
  const { rows, total } = await searchCustomers({ q, page, pageSize: PAGE_SIZE });
  return (
    <>
      <PageHeader title="Customers" count={total} description="Find a customer to check their orders and delivery details." />
      <FilterBar resetHref="/staff/customers">
        <SearchInput value={q} placeholder="Name, email, mobile or company" label="Search customers" />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState icon={<Users className="size-5" aria-hidden />} title={q ? "No customers match" : "No customers yet"}>
          {q ? "Try part of the name, email or mobile number." : "Customers appear here once they register."}
        </EmptyState>
      ) : (
        <>
          <Table columns={["Customer", "Mobile", "Orders", "Joined", "Account"]} minWidth={720}>
            {rows.map((c) => (
              <tr key={c.id} className="group relative hover:bg-ink-950">
                <td className={td}>
                  <Link href={`/staff/customers/${c.id}`} className="block font-medium text-fg after:absolute after:inset-0 group-hover:text-brand">
                    {`${c.firstName} ${c.lastName}`.trim()}
                  </Link>
                  <span className="block text-xs text-fg-dim">{c.companyName ?? c.email}</span>
                </td>
                <td className={`${td} text-fg-muted`}>{c.phone ?? "—"}</td>
                <td className={`${td} tabular-nums text-fg`}>{c.orders}</td>
                <td className={`${td} text-fg-muted`}>{dateFmt.format(c.createdAt)}</td>
                <td className={td}>{c.disabledAt ? <Badge tone="muted">Switched off</Badge> : c.emailVerifiedAt ? <Badge tone="good">Active</Badge> : <Badge tone="warn">Email not verified</Badge>}</td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} params={{ q }} path="/staff/customers" />
        </>
      )}
    </>
  );
}
