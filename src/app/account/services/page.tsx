import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MapPin, Store, Wrench } from "lucide-react";
import { Suspense } from "react";
import { primaryButton } from "@/components/account/buttons";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { requireCustomer } from "@/lib/server/auth";
import { listMyServiceRequests } from "@/lib/server/customer-service-requests";
import { deviceTypeLabel, serviceNumber } from "@/lib/service-desk";
import { customerStatusLabel } from "@/lib/service-request-form";

export const metadata: Metadata = { title: "Service requests" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const closed = new Set(["completed", "cancelled"]);

export default function ServicesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Services />
    </Suspense>
  );
}

async function Services() {
  const viewer = await requireCustomer();
  const rows = await listMyServiceRequests(viewer.id);
  return (
    <>
      <PageHeader
        title="Service requests"
        count={rows.length}
        description="Repairs at the shop and on-site engineer visits."
        actions={
          <Link href="/services/request" className={primaryButton}>
            <Wrench className="size-4" aria-hidden /> New request
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={<Wrench className="size-5" aria-hidden />} title="No service requests" action={<Link href="/services/request" className={primaryButton}>Request a service</Link>}>
          Book a repair for a laptop, desktop, CCTV system, printer or UPS. You&apos;ll see the assigned engineer and progress here.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] whitespace-nowrap text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-fg-dim">
                {["Ticket", "Service", "Device", "Method", "Requested", "Status", ""].map((c) => (
                  <th key={c} scope="col" className="px-5 py-2.5 font-medium first:sm:pl-7">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ r, serviceLabel }) => (
                <tr key={r.id} className="group relative hover:bg-ink-950">
                  <td className="px-5 py-3.5 font-medium text-fg sm:pl-7">
                    <Link href={`/account/services/${r.id}`} className="after:absolute after:inset-0 group-hover:text-brand">
                      {serviceNumber(r.seq)}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-fg">{serviceLabel ?? deviceTypeLabel[r.deviceType]}</td>
                  <td className="px-5 py-3.5 text-fg-muted">{[r.deviceBrand, r.deviceModel].filter(Boolean).join(" ") || deviceTypeLabel[r.deviceType]}</td>
                  <td className="px-5 py-3.5 text-fg-muted">
                    <span className="inline-flex items-center gap-1.5">
                      {r.location === "on_site" ? <MapPin className="size-3.5" aria-hidden /> : <Store className="size-3.5" aria-hidden />}
                      {r.location === "on_site" ? "On-site" : "In shop"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-fg-muted">{dateFmt.format(r.createdAt)}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        r.status === "completed" ? "bg-mint-soft text-leaf" : r.status === "cancelled" ? "bg-ink-900 text-fg-dim" : r.status === "awaiting_customer" ? "bg-amber-100 text-amber-800" : "bg-brand/10 text-brand"
                      }`}
                    >
                      {customerStatusLabel[r.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-fg-dim group-hover:text-brand">
                    <ChevronRight className="ml-auto size-4" aria-hidden />
                    <span className="sr-only">{closed.has(r.status) ? "View" : "Track"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
