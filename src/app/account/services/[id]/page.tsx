import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, MapPin, Store } from "lucide-react";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { requireCustomer } from "@/lib/server/auth";
import { getMyServiceRequest } from "@/lib/server/customer-service-requests";
import { formatPaise } from "@/lib/money";
import { listCollections } from "@/lib/server/admin/collections";
import { getSettings } from "@/lib/server/settings";
import { collectionMethodLabel, deviceTypeLabel, serviceNumber } from "@/lib/service-desk";
import { customerStatusLabel, preferredLabel } from "@/lib/service-request-form";

export const metadata: Metadata = { title: "Service request" };

const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default function ServiceRequestPage({ params }: PageProps<"/account/services/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Request params={params} />
    </Suspense>
  );
}

async function Request({ params }: Pick<PageProps<"/account/services/[id]">, "params">) {
  const viewer = await requireCustomer();
  const { id } = await params;
  // Only found when it belongs to this customer.
  const job = /^[0-9a-f-]{36}$/i.test(id) ? await getMyServiceRequest(viewer.id, id) : null;
  if (!job) notFound();
  const r = job.r;
  const [shop, paid] = await Promise.all([r.location === "in_shop" ? getSettings("shop") : null, listCollections(r.id)]);
  const a = r.serviceAddress;
  const status = customerStatusLabel[r.status];

  return (
    <>
      <PageHeader
        title={
          <>
            {serviceNumber(r.seq)}
            <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">{status}</span>
          </>
        }
        description={`${job.serviceTitle ?? deviceTypeLabel[r.deviceType]} · requested ${fmt.format(r.createdAt)}`}
        actions={
          <Link href="/account/services" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden /> All requests
          </Link>
        }
      />
      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-6">
          <section className="rounded-xl border border-line p-4 text-sm sm:p-5">
            <h2 className="mb-3 font-medium text-fg">Your request</h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Item k="Service" v={job.serviceTitle ?? deviceTypeLabel[r.deviceType]} />
              <Item k="Problem" v={r.problemType ?? (r.serviceId ? "Something else" : "—")} />
              <Item k="Device" v={[r.deviceBrand, r.deviceModel].filter(Boolean).join(" ") || deviceTypeLabel[r.deviceType]} />
              <Item k="Serial number" v={r.serialNumber ?? "—"} />
            </dl>
            <p className="mt-4 whitespace-pre-line text-fg">{r.issue}</p>
            {r.resolution && r.status === "completed" && (
              <div className="mt-4 rounded-lg bg-mint-soft px-3 py-2 text-leaf">
                <p className="text-xs font-medium">What was done</p>
                <p className="whitespace-pre-line">{r.resolution}</p>
              </div>
            )}
          </section>
          <section className="rounded-xl border border-line p-4 text-sm sm:p-5">
            <h2 className="mb-3 font-medium text-fg">Progress</h2>
            <ol className="grid gap-3 border-l border-line pl-4">
              {job.timeline.map((t, i) => (
                <li key={i} className="relative">
                  <span className={`absolute -left-[1.3rem] top-1.5 size-2 rounded-full ${i === job.timeline.length - 1 ? "bg-brand" : "bg-line-strong"}`} aria-hidden />
                  <p className={i === job.timeline.length - 1 ? "font-medium text-fg" : "text-fg-muted"}>{t.toStatus ? customerStatusLabel[t.toStatus] : ""}</p>
                  <p className="text-xs text-fg-dim">{fmt.format(t.at)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div className="grid content-start gap-4">
          <section className="grid gap-2 rounded-xl border border-line p-4 text-sm">
            <h2 className="flex items-center gap-1.5 font-medium text-fg">
              <CalendarClock className="size-4 text-brand" aria-hidden /> Appointment
            </h2>
            {r.scheduledAt ? (
              <p className="text-fg">Confirmed for {fmt.format(r.scheduledAt)}</p>
            ) : (
              <p className="text-fg-muted">Not scheduled yet. The shop will confirm a time with you.</p>
            )}
            {r.preferredDate && <p className="text-xs text-fg-dim">You asked for {preferredLabel(r.preferredDate, r.preferredWindow)}.</p>}
            <p className="text-fg-muted">{job.engineerFirst ? `Engineer: ${job.engineerFirst}` : r.status === "cancelled" || r.status === "completed" ? "" : "An engineer is being assigned."}</p>
          </section>
          {paid.rows.length > 0 && (
            <section className="grid gap-2 rounded-xl border border-line p-4 text-sm">
              <h2 className="flex items-center justify-between font-medium text-fg">
                Paid to the shop <span className="tabular-nums">{formatPaise(paid.totalPaise)}</span>
              </h2>
              <ul className="grid gap-1 text-fg-muted">
                {paid.rows.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span>
                      {collectionMethodLabel[p.method]} · {fmt.format(p.createdAt)}
                    </span>
                    <span className="tabular-nums">
                      {p.amountPaise < 0 ? "−" : ""}
                      {formatPaise(Math.abs(p.amountPaise))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="rounded-xl border border-line p-4 text-sm">
            <h2 className="mb-2 flex items-center gap-1.5 font-medium text-fg">
              {r.location === "on_site" ? <MapPin className="size-4 text-brand" aria-hidden /> : <Store className="size-4 text-brand" aria-hidden />}
              {r.location === "on_site" ? "On-site visit" : "In-shop service"}
            </h2>
            {a ? (
              <address className="not-italic leading-relaxed text-fg-muted">
                {a.line1}
                {a.line2 && `, ${a.line2}`}
                <span className="block">
                  {a.city}, {a.state} {a.postalCode}
                </span>
              </address>
            ) : shop?.address ? (
              <address className="not-italic leading-relaxed text-fg-muted">
                {shop.legalName || "Jerry Computers"}
                <span className="block">{shop.address}</span>
                <span className="block">{[shop.city, shop.state, shop.postalCode].filter(Boolean).join(", ")}</span>
                {shop.phone && <span className="block">{shop.phone}</span>}
              </address>
            ) : (
              <p className="text-fg-muted">Bring the device to the shop.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-fg-dim">{k}</dt>
      <dd className="text-fg">{v}</dd>
    </div>
  );
}
