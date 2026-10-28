import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowLeft, Phone } from "lucide-react";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { Badge, dateFmt, Panel } from "@/components/admin/ui";
import { AddressBlock } from "@/components/orders/OrderParts";
import { db, schema } from "@/lib/server/db";
import { searchOrders } from "@/lib/server/orders";
import { requirePermission } from "@/lib/server/permissions";

export const metadata: Metadata = { title: "Customer" };

export default function StaffCustomerPage({ params }: PageProps<"/staff/customers/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Customer params={params} />
    </Suspense>
  );
}

async function Customer({ params }: Pick<PageProps<"/staff/customers/[id]">, "params">) {
  await requirePermission("customers.view", "/staff/customers");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // Only the fields needed to process orders: no password, Google id, OTP or session data.
  const [c] = await db
    .select({
      id: schema.users.id,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      email: schema.users.email,
      phone: schema.users.phone,
      customerType: schema.users.customerType,
      companyName: schema.users.companyName,
      gstin: schema.users.gstin,
      emailVerifiedAt: schema.users.emailVerifiedAt,
      disabledAt: schema.users.disabledAt,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(and(eq(schema.users.id, id), eq(schema.users.role, "customer")));
  if (!c) notFound();
  const [orders, addresses] = await Promise.all([
    searchOrders({ customerId: id, pageSize: 10 }),
    db.select().from(schema.addresses).where(eq(schema.addresses.userId, id)).orderBy(desc(schema.addresses.isDefault), asc(schema.addresses.label)),
  ]);
  const name = `${c.firstName} ${c.lastName}`.trim();

  return (
    <>
      <PageHeader
        title={
          <>
            {name} {c.disabledAt ? <Badge tone="muted">Switched off</Badge> : c.emailVerifiedAt ? <Badge tone="good">Active</Badge> : <Badge tone="warn">Email not verified</Badge>}
          </>
        }
        description={`Customer since ${dateFmt.format(c.createdAt)} · ${orders.total} order${orders.total === 1 ? "" : "s"}`}
        actions={
          <Link href="/staff/customers" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden /> All customers
          </Link>
        }
      />
      <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[1fr_320px]">
        <Panel title="Recent orders" href={orders.total > 10 ? `/staff/orders?q=${encodeURIComponent(c.email)}` : undefined}>
          {orders.rows.length ? <OrdersTable orders={orders.rows} basePath="/staff/orders" /> : <p className="px-5 py-4 text-sm text-fg-muted">No orders yet.</p>}
        </Panel>
        <div className="grid content-start gap-4">
          <section className="rounded-xl border border-line p-4 text-sm">
            <h2 className="mb-2 font-medium text-fg">Contact</h2>
            <p className="text-fg-muted">{c.email}</p>
            {c.phone && (
              <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 text-fg-muted hover:text-brand">
                <Phone className="size-3.5" aria-hidden /> {c.phone}
              </a>
            )}
            {c.customerType === "business" && (
              <p className="mt-2 text-fg-muted">
                {c.companyName}
                {c.gstin && <span className="block">GSTIN {c.gstin}</span>}
              </p>
            )}
          </section>
          <section className="rounded-xl border border-line p-4 text-sm">
            <h2 className="mb-2 font-medium text-fg">Delivery addresses</h2>
            {addresses.length ? (
              <ul className="grid gap-3">
                {addresses.map((a) => (
                  <li key={a.id}>
                    <p className="mb-1 text-xs text-fg-dim">
                      {a.label}
                      {a.isDefault && " · default"}
                    </p>
                    <AddressBlock a={a} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-fg-muted">No saved addresses.</p>
            )}
          </section>
          <p className="text-xs text-fg-dim">Account changes (switching an account off, details) are made by an admin.</p>
        </div>
      </div>
    </>
  );
}
