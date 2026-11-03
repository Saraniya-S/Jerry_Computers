import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { outlineButton } from "@/components/account/buttons";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { PriorityBadge, ServiceStatusBadge } from "@/components/admin/ServiceBadges";
import { DateRange, dateFmt, dateParam, FilterBar, Panel, Table, td } from "@/components/admin/ui";
import { formatPaise } from "@/lib/money";
import { serviceDeskReport } from "@/lib/server/admin/service-desk-report";
import { requirePermission } from "@/lib/server/permissions";
import { collectionMethodLabel, deviceTypeLabel, priorityLabel, serviceNumber } from "@/lib/service-desk";

export const metadata: Metadata = { title: "Service desk report" };

/** yyyy-mm-dd in shop time. */
const istDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
const dayLabel = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const h = (v: number | null) => (v === null ? "—" : v >= 48 ? `${Math.round(v / 24)} d` : `${v} h`);
const channel = (l: { location: string; source: string }) => `${l.location === "on_site" ? "On-site" : "In shop"} · ${l.source === "walk_in" ? "walk-in" : l.source === "phone" ? "phone" : "online"}`;

export default function ServiceDeskReportPage({ searchParams }: PageProps<"/admin/reports/service">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Report searchParams={searchParams} />
    </Suspense>
  );
}

async function Report({ searchParams }: Pick<PageProps<"/admin/reports/service">, "searchParams">) {
  await requirePermission("reports.view");
  const sp = await searchParams;
  const now = new Date();
  const today = istDate(now);
  const daysAgo = (n: number) => istDate(new Date(now.getTime() - n * 86_400_000));
  let from = dateParam(sp.from) || daysAgo(29);
  let to = dateParam(sp.to) || today;
  if (from > to) [from, to] = [to, from];
  // Keep the day-by-day table readable.
  if (Date.parse(to) - Date.parse(from) > 366 * 86_400_000) from = istDate(new Date(Date.parse(`${to}T00:00:00Z`) - 365 * 86_400_000));
  const d = await serviceDeskReport({ from, to });
  const presets = [
    ["Last 7 days", daysAgo(6), today],
    ["Last 30 days", daysAgo(29), today],
    ["Last 90 days", daysAgo(89), today],
    ["This month", `${today.slice(0, 8)}01`, today],
  ] as const;
  const x = d.headline;
  const b = d.backlog;
  const busiest = Math.max(1, ...d.byDay.map((r) => Math.max(r.created, r.completed)));

  return (
    <>
      <PageHeader
        title="Service desk report"
        description={`${from} to ${to} (shop time). "Completed" counts jobs finished in the period, whenever they came in.`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/admin/reports?from=${from}&to=${to}`} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
              <ArrowLeft className="size-4" aria-hidden /> All reports
            </Link>
            <a href={`/admin/reports/service/export?from=${from}&to=${to}`} className={outlineButton}>
              <Download className="size-4" aria-hidden /> Download jobs (CSV)
            </a>
          </div>
        }
      />
      <FilterBar>
        <DateRange from={from} to={to} />
        <span className="flex flex-wrap gap-1.5">
          {presets.map(([label, f, t]) => (
            <Link key={label} href={`/admin/reports/service?from=${f}&to=${t}`} aria-current={f === from && t === to ? "true" : undefined} className={`h-9 rounded-lg px-2.5 text-sm leading-9 ${f === from && t === to ? "bg-brand/10 font-medium text-brand" : "text-fg-muted hover:bg-ink-900 hover:text-fg"}`}>
              {label}
            </Link>
          ))}
        </span>
      </FilterBar>

      <div className="grid gap-6 p-5 sm:p-7">
        <Section title="In the period" note="Jobs received and finished between those dates.">
          <Stats>
            <Stat label="Jobs received" value={x.created} href={`/admin/service-requests?from=${from}&to=${to}`} />
            <Stat label="Completed" value={x.completed} hint={`${x.onSiteCompleted} on-site`} strong />
            <Stat label="Cancelled" value={x.cancelled} />
            <Stat label="Handed back by engineers" value={x.handedBack} hint="marked unable to complete" tone={x.handedBack ? "warn" : undefined} />
            <Stat label="Average time to complete" value={h(x.hoursToComplete)} hint="from received to completed" />
            <Stat label="Average time to accept" value={h(x.hoursToAccept)} hint="from assigned to accepted" />
            <Stat label="Collected for service" value={formatPaise(x.collected.total)} hint={x.collected.byMethod.length ? x.collected.byMethod.map((m) => `${collectionMethodLabel[m.method]} ${formatPaise(m.total)}`).join(" · ") : "nothing recorded"} />
          </Stats>
        </Section>

        <Section title="Open right now" note="The current backlog, whatever the dates above.">
          <Stats>
            <Stat label="Open jobs" value={b.open} href="/admin/service-requests" strong />
            <Stat label="Not assigned" value={b.unassigned} tone={b.unassigned ? "warn" : undefined} href="/admin/service-requests?status=open" />
            <Stat label="Handed back, need a decision" value={b.handedBack} tone={b.handedBack ? "warn" : undefined} href="/admin/service-requests?status=unable_to_complete" />
            <Stat label="Waiting for parts or customer" value={b.waiting} />
            <Stat label="Urgent or high priority" value={b.urgent} />
          </Stats>
          <div className="mt-3 overflow-hidden rounded-xl border border-line">
            <p className="border-b border-line bg-ink-950 px-4 py-2 text-xs font-medium text-fg-muted">How long open jobs have been waiting</p>
            <div className="grid grid-cols-2 gap-px bg-line text-sm sm:grid-cols-4">
              <Cell label="Under a day" value={b.under1d} />
              <Cell label="1–3 days" value={b.d1to3} />
              <Cell label="3–7 days" value={b.d3to7} />
              <Cell label="Over a week" value={b.over7d} warn={b.over7d > 0} />
            </div>
          </div>
        </Section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <Panel title="Waiting longest">
            <Table columns={["Job", "Customer", "Device", "Status", "Engineer", "Waiting"]} minWidth={720}>
              {d.oldest.length ? (
                d.oldest.map((j) => (
                  <tr key={j.id}>
                    <td className={td}>
                      <Link href={`/admin/service-requests/${j.id}`} className="font-medium text-fg hover:text-brand">
                        {serviceNumber(j.seq)}
                      </Link>{" "}
                      <PriorityBadge priority={j.priority} />
                    </td>
                    <td className={`${td} text-fg-muted`}>{j.contactName}</td>
                    <td className={`${td} text-fg-muted`}>{deviceTypeLabel[j.deviceType]}</td>
                    <td className={td}>
                      <ServiceStatusBadge status={j.status} />
                    </td>
                    <td className={`${td} text-fg-muted`}>{j.engineer?.trim() || "—"}</td>
                    <td className={`${td} tabular-nums text-fg`}>{Math.max(0, Math.floor((now.getTime() - j.createdAt.getTime()) / 86_400_000))} d</td>
                  </tr>
                ))
              ) : (
                <Empty cols={6} text="No open jobs." />
              )}
            </Table>
          </Panel>

          <Panel title="Day by day">
            <Table columns={["Day", { label: "Received", className: "text-right" }, { label: "Completed", className: "text-right" }]} minWidth={320}>
              {[...d.byDay].reverse().map((r) => (
                <tr key={r.day}>
                  <td className={`${td} text-fg-muted`}>{dayLabel.format(new Date(`${r.day}T00:00:00Z`))}</td>
                  <td className={`${td} text-right`}>
                    <Count n={r.created} of={busiest} />
                  </td>
                  <td className={`${td} text-right`}>
                    <Count n={r.completed} of={busiest} done />
                  </td>
                </tr>
              ))}
            </Table>
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <Panel title="By device">
            <Table columns={["Device", { label: "Received", className: "text-right" }, { label: "Completed", className: "text-right" }, { label: "Avg time", className: "text-right" }]} minWidth={360}>
              {d.byDevice.length ? (
                d.byDevice.map((r) => (
                  <tr key={r.device}>
                    <td className={`${td} text-fg`}>{deviceTypeLabel[r.device]}</td>
                    <td className={`${td} text-right tabular-nums`}>{r.created}</td>
                    <td className={`${td} text-right tabular-nums`}>{r.completed}</td>
                    <td className={`${td} text-right tabular-nums text-fg-muted`}>{h(r.hours)}</td>
                  </tr>
                ))
              ) : (
                <Empty cols={4} />
              )}
            </Table>
          </Panel>
          <Panel title="How jobs came in">
            <Table columns={["Channel", { label: "Jobs", className: "text-right" }]} minWidth={260}>
              {d.byChannel.length ? (
                d.byChannel
                  .sort((p, q) => q.n - p.n)
                  .map((r) => (
                    <tr key={`${r.location}-${r.source}`}>
                      <td className={`${td} text-fg`}>{channel(r)}</td>
                      <td className={`${td} text-right tabular-nums`}>{r.n}</td>
                    </tr>
                  ))
              ) : (
                <Empty cols={2} />
              )}
            </Table>
            <Table columns={["Priority", { label: "Jobs", className: "text-right" }]} minWidth={260}>
              {d.byPriority.length ? (
                (["urgent", "high", "normal", "low"] as const)
                  .map((p) => ({ p, n: d.byPriority.find((r) => r.priority === p)?.n ?? 0 }))
                  .filter((r) => r.n)
                  .map((r) => (
                    <tr key={r.p}>
                      <td className={`${td} text-fg`}>{priorityLabel[r.p]}</td>
                      <td className={`${td} text-right tabular-nums`}>{r.n}</td>
                    </tr>
                  ))
              ) : (
                <Empty cols={2} />
              )}
            </Table>
          </Panel>
          <Panel title="Top problems (online requests)">
            <Table columns={["Problem the customer chose", { label: "Jobs", className: "text-right" }]} minWidth={260}>
              {d.problems.length ? (
                d.problems.map((r) => (
                  <tr key={r.problem}>
                    <td className={`${td} text-fg`}>{r.problem}</td>
                    <td className={`${td} text-right tabular-nums`}>{r.n}</td>
                  </tr>
                ))
              ) : (
                <Empty cols={2} text="No online requests with a chosen problem." />
              )}
            </Table>
          </Panel>
        </div>

        <Panel title="Engineers" href="/admin/engineers">
          <p className="border-b border-line px-4 py-2.5 text-xs text-fg-dim sm:px-5">
            For the period: jobs given to them, completed as lead, jobs they joined as a helper, jobs handed back, transfers asked for, money they recorded and approved leave days. &ldquo;Active now&rdquo; includes jobs they help on.
          </p>
          <Table
            columns={[
              "Engineer",
              { label: "Assigned", className: "text-right" },
              { label: "Completed", className: "text-right" },
              { label: "Avg time", className: "text-right" },
              { label: "Helped on", className: "text-right" },
              { label: "Handed back", className: "text-right" },
              { label: "Transfers", className: "text-right" },
              { label: "Collected", className: "text-right" },
              { label: "Leave days", className: "text-right" },
              { label: "Active now", className: "text-right" },
              "Status",
            ]}
            minWidth={1040}
          >
            {d.engineers.length ? (
              d.engineers.map((e) => (
                <tr key={e.id}>
                  <td className={td}>
                    <Link href={`/admin/engineers/${e.id}`} className="text-fg hover:text-brand">
                      {e.name}
                    </Link>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{e.assigned}</td>
                  <td className={`${td} text-right font-medium tabular-nums text-fg`}>{e.completed}</td>
                  <td className={`${td} text-right tabular-nums text-fg-muted`}>{h(e.hoursToComplete)}</td>
                  <td className={`${td} text-right tabular-nums`}>{e.helped}</td>
                  <td className={`${td} text-right tabular-nums ${e.handedBack ? "text-amber-800" : ""}`}>{e.handedBack}</td>
                  <td className={`${td} text-right tabular-nums`}>{e.transfers}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatPaise(e.collectedPaise)}</td>
                  <td className={`${td} text-right tabular-nums`}>{e.leaveDays}</td>
                  <td className={`${td} text-right tabular-nums`}>{e.activeNow}</td>
                  <td className={`${td} text-fg-muted`}>{e.status ?? "Taking jobs"}</td>
                </tr>
              ))
            ) : (
              <Empty cols={11} text="No engineers yet." />
            )}
          </Table>
        </Panel>
        <p className="text-xs text-fg-dim">Generated {dateFmt.format(now)}.</p>
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
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

function Stat({ label, value, hint, href, strong, tone }: { label: string; value: string | number; hint?: string; href?: string; strong?: boolean; tone?: "warn" }) {
  const body = (
    <>
      <span className="block text-xs text-fg-muted">{label}</span>
      <span className={`mt-1 block text-xl font-semibold tabular-nums tracking-[-0.02em] ${tone === "warn" ? "text-amber-800" : "text-fg"}`}>{value}</span>
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

function Cell({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="bg-ink-850 px-4 py-3">
      <span className="block text-xs text-fg-muted">{label}</span>
      <span className={`mt-0.5 block text-lg font-semibold tabular-nums ${warn ? "text-amber-800" : "text-fg"}`}>{value}</span>
    </div>
  );
}

/** The number, with a thin bar scaled to the busiest day so quiet and busy days stand out. */
function Count({ n, of, done }: { n: number; of: number; done?: boolean }) {
  return (
    <span className="inline-flex items-center justify-end gap-2 tabular-nums">
      <span aria-hidden className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-900">
        <span className={`block h-full rounded-full ${done ? "bg-leaf" : "bg-brand"}`} style={{ width: `${(n / of) * 100}%` }} />
      </span>
      <span className={n ? "text-fg" : "text-fg-dim"}>{n}</span>
    </span>
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
