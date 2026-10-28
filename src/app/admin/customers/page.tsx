import type { Metadata } from "next";
import { Users } from "lucide-react";
import { Suspense } from "react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { AccountToggle } from "@/components/admin/AccountToggle";
import { Badge, dateFmt, FilterBar, FilterSelect, oneOf, pageParam, Pagination, param, SearchInput, Table, td } from "@/components/admin/ui";
import { searchCustomers } from "@/lib/server/admin/users";
import { requirePermission } from "@/lib/server/permissions";

export const metadata: Metadata = { title: "Customers" };

const PAGE_SIZE = 25;

export default function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Customers searchParams={searchParams} />
    </Suspense>
  );
}

async function Customers({ searchParams }: Pick<PageProps<"/admin/customers">, "searchParams">) {
  await requirePermission("customers.manage");
  const sp = await searchParams;
  const q = param(sp.q);
  const status = oneOf(sp.status, ["active", "disabled", "unverified"] as const);
  const page = pageParam(sp.page);
  const { rows, total } = await searchCustomers({ q, status, page, pageSize: PAGE_SIZE });

  return (
    <>
      <PageHeader title="Customers" count={total} description="Everyone with a customer account. Walk-in service customers without an account are kept on their service jobs only." />
      <FilterBar resetHref="/admin/customers">
        <SearchInput value={q} placeholder="Name, email, mobile or company" label="Search customers" />
        <FilterSelect name="status" value={status ?? ""} label="Status" all="All accounts" options={[{ value: "active", label: "Active" }, { value: "disabled", label: "Switched off" }, { value: "unverified", label: "Email not verified" }]} />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState icon={<Users className="size-5" aria-hidden />} title={q || status ? "No customers match" : "No customers yet"}>
          {q || status ? "Try another search." : "Customers appear here once they register."}
        </EmptyState>
      ) : (
        <>
          <Table columns={["Customer", "Mobile", "Type", "Joined", "Orders", "Service jobs", "Status", ""]} minWidth={940}>
            {rows.map((c) => {
              const name = `${c.firstName} ${c.lastName}`.trim();
              return (
                <tr key={c.id}>
                  <td className={td}>
                    <span className="block text-fg">{name}</span>
                    <span className="block text-xs text-fg-dim">{c.email}</span>
                  </td>
                  <td className={`${td} text-fg-muted`}>{c.phone ?? "—"}</td>
                  <td className={`${td} text-fg-muted`}>{c.customerType === "business" ? (c.companyName ?? "Business") : "Personal"}</td>
                  <td className={`${td} text-fg-muted`}>{dateFmt.format(c.createdAt)}</td>
                  <td className={`${td} tabular-nums text-fg`}>
                    {c.orders ? (
                      <a href={`/admin/orders?q=${encodeURIComponent(c.email)}`} className="hover:text-brand">
                        {c.orders}
                      </a>
                    ) : (
                      0
                    )}
                  </td>
                  <td className={`${td} tabular-nums text-fg`}>{c.serviceJobs}</td>
                  <td className={td}>
                    <span className="flex gap-1.5">
                      {c.disabledAt ? <Badge tone="muted">Switched off</Badge> : <Badge tone="good">Active</Badge>}
                      {!c.emailVerifiedAt && <Badge tone="warn">Unverified</Badge>}
                    </span>
                  </td>
                  <td className={`${td} text-right`}>
                    <AccountToggle userId={c.id} name={c.firstName} disabled={Boolean(c.disabledAt)} />
                  </td>
                </tr>
              );
            })}
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} params={{ q, status }} path="/admin/customers" />
        </>
      )}
    </>
  );
}
