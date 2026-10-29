import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { DateRange, dateParam, FilterBar, Panel, Table, td } from "@/components/admin/ui";
import { formatPaise, orderStatusLabel } from "@/lib/money";
import { inventoryReport, salesReport, serviceReport } from "@/lib/server/admin/reports";
import type { InventoryReason } from "@/lib/server/db/schema";
import { requirePermission } from "@/lib/server/permissions";
import { collectionMethodLabel, deviceTypeLabel, serviceStatusLabel } from "@/lib/service-desk";

export const metadata: Metadata = { title: "Reports" };

const reasonLabel: Record<InventoryReason, string> = {
  opening_balance: "Opening balance",
  restock: "Restocks",
  correction: "Corrections",
  damaged: "Damaged / written off",
  customer_return: "Customer returns",
  order_placed: "Sold (orders placed)",
  order_cancelled: "Returned by cancellations",
};

/** yyyy-mm-dd in shop time. */
const istDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);

export default function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Reports searchParams={searchParams} />
    </Suspense>
  );
}

async function Reports({ searchParams }: Pick<PageProps<"/admin/reports">, "searchParams">) {
  await requirePermission("reports.view");
  const sp = await searchParams;
  const now = new Date();
  const today = istDate(now);
  const daysAgo = (n: number) => istDate(new Date(now.getTime() - n * 86_400_000));
  let from = dateParam(sp.from) || daysAgo(29);
  let to = dateParam(sp.to) || today;
  if (from > to) [from, to] = [to, from];
  const range = { from, to };
  const [sales, inventory, service] = await Promise.all([salesReport(range), inventoryReport(range), serviceReport(range)]);
  const presets = [
    ["Last 7 days", daysAgo(6), today],
    ["Last 30 days", daysAgo(29), today],
    ["Last 90 days", daysAgo(89), today],
    ["This month", `${today.slice(0, 8)}01`, today],
  ] as const;

  return (
    <>
      <PageHeader title="Reports" description={`${from} to ${to} (shop time). Money figures come from recorded payments and refunds; order figures from orders placed in the period.`} />
      <FilterBar>
        <DateRange from={from} to={to} />
        <span className="flex flex-wrap gap-1.5">
          {presets.map(([label, f, t]) => (
            <Link key={label} href={`/admin/reports?from=${f}&to=${t}`} aria-current={f === from && t === to ? "true" : undefined} className={`h-9 rounded-lg px-2.5 text-sm leading-9 ${f === from && t === to ? "bg-brand/10 font-medium text-brand" : "text-fg-muted hover:bg-ink-900 hover:text-fg"}`}>
              {label}
            </Link>
          ))}
        </span>
      </FilterBar>

      <div className="grid gap-6 p-5 sm:p-7">
        <Section title="Money in the period" note="Collected = payments recorded in the period, whatever day the order was placed. Refunds are money sent back.">
          <Stats>
            <Stat label="Gross collected" value={formatPaise(sales.gross.amount)} hint={`${sales.gross.n} payment${sales.gross.n === 1 ? "" : "s"}`} />
            <Stat label="Refunds paid" value={formatPaise(sales.refunds.amount)} hint={`${sales.refunds.n} refund${sales.refunds.n === 1 ? "" : "s"}`} tone={sales.refunds.amount ? "bad" : undefined} />
            <Stat label="Net collected" value={formatPaise(sales.net)} strong />
            <Stat label="Cash on delivery collected" value={formatPaise(sales.cod.amount)} hint={`${sales.cod.n} order${sales.cod.n === 1 ? "" : "s"}`} />
            <Stat label="Online payments received" value={formatPaise(sales.online.amount)} hint={`${sales.online.n} order${sales.online.n === 1 ? "" : "s"}`} />
          </Stats>
        </Section>

        <Section title="Outstanding now" note="Current position, not limited to the period.">
          <Stats>
            <Stat label="COD to collect" value={formatPaise(sales.outstanding.codDue)} hint={`${sales.outstanding.codDueN} open order${sales.outstanding.codDueN === 1 ? "" : "s"}`} href="/admin/orders?method=cod&paymentStatus=pending" />
            <Stat label="Online payments not yet confirmed" value={formatPaise(sales.outstanding.onlineDue)} hint={`${sales.outstanding.onlineDueN} order${sales.outstanding.onlineDueN === 1 ? "" : "s"}`} href="/admin/orders?method=online&paymentStatus=pending" />
            <Stat label="Refunds due" value={formatPaise(sales.outstanding.refundDue)} hint={`${sales.outstanding.refundDueN} cancelled paid order${sales.outstanding.refundDueN === 1 ? "" : "s"}`} href="/admin/orders?paymentStatus=refund_pending" tone={sales.outstanding.refundDueN ? "bad" : undefined} />
          </Stats>
        </Section>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Orders placed in the period">
            <div className="grid grid-cols-2 gap-px bg-line text-sm">
              <Cell label="Orders (not cancelled)" value={sales.booked.n} sub={formatPaise(sales.booked.value)} />
              <Cell label="Cancelled" value={sales.booked.cancelled} sub={formatPaise(sales.booked.cancelledValue)} />
            </div>
            <Table columns={["Status", "Orders", "Value"]} minWidth={360}>
              {sales.statuses.length ? (
                sales.statuses.map((s) => (
                  <tr key={s.status}>
                    <td className={`${td} text-fg`}>{orderStatusLabel[s.status]}</td>
                    <td className={`${td} tabular-nums`}>{s.n}</td>
                    <td className={`${td} tabular-nums text-fg-muted`}>{formatPaise(s.value)}</td>
                  </tr>
                ))
              ) : (
                <Empty cols={3} />
              )}
            </Table>
          </Panel>

          <Panel title="Best sellers in the period">
            <Table columns={["Product", "Units", "Value"]} minWidth={360}>
              {sales.topProducts.length ? (
                sales.topProducts.map((p) => (
                  <tr key={p.slug}>
                    <td className={`${td} max-w-[16rem] truncate text-fg`}>{p.name}</td>
                    <td className={`${td} tabular-nums`}>{p.units}</td>
                    <td className={`${td} tabular-nums text-fg-muted`}>{formatPaise(p.value)}</td>
                  </tr>
                ))
              ) : (
                <Empty cols={3} />
              )}
            </Table>
          </Panel>

          <Panel title="Inventory" href="/admin/inventory">
            <div className="grid grid-cols-2 gap-px bg-line text-sm sm:grid-cols-4">
              <Cell label="Products" value={inventory.stock.products} />
              <Cell label="Units available" value={inventory.stock.units} />
              <Cell label="Out of stock" value={inventory.stock.out} />
              <Cell label="Low stock" value={inventory.stock.low} />
            </div>
            <p className="border-t border-line px-4 py-3 text-sm text-fg-muted sm:px-5">
              Available stock at selling price: <span className="font-medium tabular-nums text-fg">{formatPaise(inventory.stock.value)}</span>
              {inventory.stock.unpricedUnits > 0 && ` (plus ${inventory.stock.unpricedUnits} units with no price set)`}
            </p>
            <Table columns={["Stock movements in the period", "Entries", "Units"]} minWidth={360}>
              {inventory.movements.length ? (
                inventory.movements.map((m) => (
                  <tr key={m.reason}>
                    <td className={`${td} text-fg`}>{reasonLabel[m.reason]}</td>
                    <td className={`${td} tabular-nums`}>{m.n}</td>
                    <td className={`${td} tabular-nums ${m.units < 0 ? "text-red-600" : "text-leaf"}`}>{m.units > 0 ? `+${m.units}` : m.units}</td>
                  </tr>
                ))
              ) : (
                <Empty cols={3} />
              )}
            </Table>
          </Panel>

          <Panel title="Service requests" href="/admin/service-requests">
            <div className="grid grid-cols-2 gap-px bg-line text-sm sm:grid-cols-3">
              <Cell label="Created in the period" value={service.created} />
              <Cell label="Completed in the period" value={service.completed.n} />
              <Cell label="Average time to complete" value={service.completed.avgHours === null ? "—" : `${service.completed.avgHours} h`} />
            </div>
            <div className="grid grid-cols-1 gap-px border-t border-line bg-line text-sm">
              <Cell
                label="Collected from customers for service jobs"
                value={formatPaise(service.collected.total)}
                sub={
                  service.collected.byMethod.length
                    ? `${service.collected.jobs} job${service.collected.jobs === 1 ? "" : "s"} · ${service.collected.byMethod.map((m) => `${collectionMethodLabel[m.method]} ${formatPaise(m.total)}`).join(" · ")}`
                    : "Nothing recorded in this period"
                }
              />
            </div>
            <Table columns={["Status (of jobs created)", "Jobs"]} minWidth={300}>
              {service.byStatus.length ? (
                service.byStatus.map((s) => (
                  <tr key={s.status}>
                    <td className={`${td} text-fg`}>{serviceStatusLabel[s.status]}</td>
                    <td className={`${td} tabular-nums`}>{s.n}</td>
                  </tr>
                ))
              ) : (
                <Empty cols={2} />
              )}
            </Table>
            <Table columns={["Device", "Jobs"]} minWidth={300}>
              {service.byDevice.length ? (
                service.byDevice.map((d) => (
                  <tr key={d.device}>
                    <td className={`${td} text-fg`}>{deviceTypeLabel[d.device]}</td>
                    <td className={`${td} tabular-nums`}>{d.n}</td>
                  </tr>
                ))
              ) : (
                <Empty cols={2} />
              )}
            </Table>
            <Table columns={["Where / how", "Jobs"]} minWidth={300}>
              {service.byLocation.length ? (
                service.byLocation.map((l) => (
                  <tr key={`${l.location}-${l.source}`}>
                    <td className={`${td} text-fg`}>
                      {l.location === "on_site" ? "On-site" : "In shop"} · {l.source === "walk_in" ? "walk-in" : l.source}
                    </td>
                    <td className={`${td} tabular-nums`}>{l.n}</td>
                  </tr>
                ))
              ) : (
                <Empty cols={2} />
              )}
            </Table>
          </Panel>
        </div>

        <Panel title="Engineer workload" href="/admin/engineers" count={service.transfers.pending}>
          <p className="border-b border-line px-4 py-2.5 text-sm text-fg-muted sm:px-5">
            Transfers in the period: {service.transfers.requested} requested, {service.transfers.approved} approved, {service.transfers.rejected} rejected.{" "}
            <Link href="/admin/transfers" className="text-brand hover:underline">
              {service.transfers.pending} waiting for approval
            </Link>
          </p>
          <Table columns={["Engineer", "Active now", "Completed in period", "Completed, all time", "Status"]} minWidth={640}>
            {service.engineers.length ? (
              service.engineers.map((e) => (
                <tr key={e.id}>
                  <td className={td}>
                    <Link href={`/admin/engineers/${e.id}`} className="text-fg hover:text-brand">
                      {`${e.firstName} ${e.lastName}`.trim()}
                    </Link>
                  </td>
                  <td className={`${td} tabular-nums`}>{e.activeJobs}</td>
                  <td className={`${td} tabular-nums`}>{e.completedInRange}</td>
                  <td className={`${td} tabular-nums text-fg-muted`}>{e.completed}</td>
                  <td className={`${td} text-fg-muted`}>{e.ineligible ?? "Taking jobs"}</td>
                </tr>
              ))
            ) : (
              <Empty cols={5} text="No engineers yet." />
            )}
          </Table>
        </Panel>
      </div>
    </>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-medium text-fg">{title}</h2>
      <p className="mb-3 mt-0.5 text-xs text-fg-dim">{note}</p>
      {children}
    </section>
  );
}

function Stats({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{children}</div>;
}

function Stat({ label, value, hint, href, strong, tone }: { label: string; value: string; hint?: string; href?: string; strong?: boolean; tone?: "bad" }) {
  const body = (
    <>
      <span className="block text-xs text-fg-muted">{label}</span>
      <span className={`mt-1 block text-xl font-semibold tabular-nums tracking-[-0.02em] ${tone === "bad" ? "text-red-700" : "text-fg"}`}>{value}</span>
      {hint && <span className="mt-0.5 block text-xs text-fg-dim">{hint}</span>}
    </>
  );
  const cls = `rounded-xl border p-4 ${strong ? "border-brand/30 bg-brand/[0.04]" : "border-line bg-ink-950"}`;
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-brand/30`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Cell({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-ink-850 px-4 py-3">
      <span className="block text-xs text-fg-muted">{label}</span>
      <span className="mt-0.5 block text-lg font-semibold tabular-nums text-fg">{value}</span>
      {sub && <span className="block text-xs tabular-nums text-fg-dim">{sub}</span>}
    </div>
  );
}

function Empty({ cols, text = "Nothing in this period." }: { cols: number; text?: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-5 py-4 text-sm text-fg-muted sm:pl-7">
        {text}
      </td>
    </tr>
  );
}
