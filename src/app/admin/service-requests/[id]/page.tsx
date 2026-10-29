import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Navigation, Phone, Store } from "lucide-react";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { PriorityBadge, ServiceStatusBadge } from "@/components/admin/ServiceBadges";
import { AssignmentOverride, NoteForm, ScheduleSetter, StatusChanger } from "@/components/admin/ServiceJobActions";
import { TransferDecision } from "@/components/admin/TransferDecision";
import { Badge, fullDateTimeFmt } from "@/components/admin/ui";
import { FormAlert } from "@/components/auth/ui";
import { engineerWorkloads } from "@/lib/server/admin/assignment";
import { getServiceRequest, listTransfers } from "@/lib/server/admin/service-requests";
import { requirePermission } from "@/lib/server/permissions";
import { deviceTypeLabel, isActiveStatus, noteKindLabel, serviceFlow, serviceNumber, serviceStatusLabel } from "@/lib/service-desk";
import { locationLinks } from "@/lib/service-location";
import { preferredLabel } from "@/lib/service-request-form";

export const metadata: Metadata = { title: "Service request" };

const methodLabel = { auto: "Automatic", manual: "Admin override", transfer: "Approved transfer", unassigned: "Unassigned" } as const;
const transferTone = { pending: "warn", approved: "good", rejected: "bad", withdrawn: "muted" } as const;

export default function ServiceRequestPage({ params, searchParams }: PageProps<"/admin/service-requests/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ServiceRequest params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ServiceRequest({ params, searchParams }: Pick<PageProps<"/admin/service-requests/[id]">, "params" | "searchParams">) {
  await requirePermission("service.manage");
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  const job = /^[0-9a-f-]{36}$/i.test(id) ? await getServiceRequest(id) : null;
  if (!job) notFound();
  const [engineers, transfers] = await Promise.all([engineerWorkloads(undefined, { deviceType: job.deviceType, location: job.location }), listTransfers({ requestId: job.id })]);
  const ticket = serviceNumber(job.seq);
  const a = job.serviceAddress;
  const links = job.location === "on_site" ? locationLinks(a) : null;
  const closed = job.status === "completed" || job.status === "cancelled";

  return (
    <>
      <PageHeader
        title={
          <>
            {ticket} <ServiceStatusBadge status={job.status} /> <PriorityBadge priority={job.priority} />
          </>
        }
        description={`${deviceTypeLabel[job.deviceType]}${job.deviceBrand || job.deviceModel ? ` · ${[job.deviceBrand, job.deviceModel].filter(Boolean).join(" ")}` : ""} · created ${fullDateTimeFmt.format(job.createdAt)}`}
        actions={
          <Link href="/admin/service-requests" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden /> All requests
          </Link>
        }
      />
      {created === "1" && (
        <div className="px-5 pt-5 sm:px-7">
          <FormAlert tone={job.engineerName ? "success" : "info"}>
            {job.engineerName ? `${ticket} created and assigned to ${job.engineerName}.` : `${ticket} created. No engineer is eligible right now, so it's waiting unassigned. Assign one below.`}
          </FormAlert>
        </div>
      )}
      <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-6">
          <section className="rounded-xl border border-line p-4 text-sm sm:p-5">
            <h2 className="mb-3 font-medium text-fg">Problem</h2>
            <p className="whitespace-pre-line text-fg">{job.issue}</p>
            <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {(
                [
                  ["Device", deviceTypeLabel[job.deviceType]],
                  ["Brand / model", [job.deviceBrand, job.deviceModel].filter(Boolean).join(" ") || "—"],
                  ["Serial number", job.serialNumber ?? "—"],
                  ["Left with the device", job.accessories ?? "—"],
                  ["Came in by", job.source === "walk_in" ? "Walk-in" : job.source === "phone" ? "Phone" : "Online booking"],
                  ...(job.source === "online"
                    ? ([
                        ["Customer's chosen problem", job.problemType ?? "Something else"],
                        ["Customer's preferred time", preferredLabel(job.preferredDate, job.preferredWindow) ?? "No preference"],
                      ] as const)
                    : []),
                  ["Scheduled", job.scheduledAt ? fullDateTimeFmt.format(job.scheduledAt) : "Not scheduled"],
                  ["Accepted by engineer", job.acceptedAt ? fullDateTimeFmt.format(job.acceptedAt) : job.assignedEngineerId ? "Not yet" : "—"],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-fg-dim">{k}</dt>
                  <dd className="text-fg">{v}</dd>
                </div>
              ))}
            </dl>
            {job.resolution && (
              <div className="mt-4 rounded-lg bg-mint-soft px-3 py-2 text-leaf">
                <p className="text-xs font-medium">Resolution</p>
                <p className="whitespace-pre-line">{job.resolution}</p>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-line p-4 text-sm sm:p-5">
            <h2 className="mb-3 font-medium text-fg">Progress</h2>
            <ol className="grid gap-3 border-l border-line pl-4">
              {job.events.map(({ e, by, byRole }) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-brand" aria-hidden />
                  <p className="text-fg">
                    {e.toStatus && e.fromStatus !== e.toStatus ? (
                      <span className="font-medium">{serviceStatusLabel[e.toStatus]}</span>
                    ) : e.kind !== "note" ? (
                      <span className="font-medium">{noteKindLabel[e.kind]}</span>
                    ) : null}
                    {((e.toStatus && e.fromStatus !== e.toStatus) || e.kind !== "note") && e.note ? " · " : null}
                    <span className="whitespace-pre-line">{e.note}</span>
                  </p>
                  <p className="text-xs text-fg-dim">
                    {fullDateTimeFmt.format(e.createdAt)} · {by?.trim() || "System"}
                    {byRole === "engineer" && " (engineer)"}
                  </p>
                </li>
              ))}
            </ol>
            {!closed && (
              <div className="mt-4">
                <NoteForm requestId={job.id} />
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-line text-sm">
            <h2 className="border-b border-line bg-ink-950 px-4 py-3 font-medium text-fg">Assignment history</h2>
            {job.assignments.length ? (
              <ul className="divide-y divide-line">
                {job.assignments.map(({ a: h, to, from, by }) => (
                  <li key={h.id} className="px-4 py-3">
                    <p className="text-fg">
                      <Badge tone={h.method === "auto" ? "brand" : h.method === "transfer" ? "info" : "neutral"}>{methodLabel[h.method]}</Badge>{" "}
                      {from?.trim() ? `${from} → ` : ""}
                      {to?.trim() || "Unassigned"}
                      {h.activeJobsBefore !== null && <span className="text-fg-dim"> · had {h.activeJobsBefore} active</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-fg-dim">
                      {fullDateTimeFmt.format(h.createdAt)} · {by?.trim() || "System"}
                      {h.reason && ` · ${h.reason}`}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-fg-muted">Never assigned.</p>
            )}
          </section>

          {transfers.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-line text-sm">
              <h2 className="border-b border-line bg-ink-950 px-4 py-3 font-medium text-fg">Transfer requests</h2>
              <ul className="divide-y divide-line">
                {transfers.map(({ t, from, to, decidedBy }) => (
                  <li key={t.id} className="grid gap-2 px-4 py-3">
                    <p className="text-fg">
                      <Badge tone={transferTone[t.status]}>{t.status[0].toUpperCase() + t.status.slice(1)}</Badge> {from} → {to}
                    </p>
                    <p className="text-fg-muted">“{t.reason}”</p>
                    <p className="text-xs text-fg-dim">
                      Requested {fullDateTimeFmt.format(t.createdAt)}
                      {t.decidedAt && ` · decided ${fullDateTimeFmt.format(t.decidedAt)}${decidedBy?.trim() ? ` by ${decidedBy}` : ""}`}
                      {t.decisionNote && ` · ${t.decisionNote}`}
                    </p>
                    {t.status === "pending" && <TransferDecision transferId={t.id} from={from} to={to} ticket={ticket} />}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="grid content-start gap-4">
          <section className="rounded-xl border border-line p-4">
            <h2 className="mb-3 text-sm font-medium text-fg">Status</h2>
            <StatusChanger requestId={job.id} next={serviceFlow[job.status]} />
            {job.status === "unable_to_complete" && <p className="mt-3 text-xs text-amber-800">The engineer handed this back. Reassign it below, or cancel it.</p>}
          </section>

          {(isActiveStatus(job.status) || job.status === "open") && (
            <section className="rounded-xl border border-line p-4">
              <h2 className="mb-3 text-sm font-medium text-fg">Schedule</h2>
              <ScheduleSetter requestId={job.id} current={job.scheduledAt} />
            </section>
          )}

          <section className="grid gap-3 rounded-xl border border-line p-4 text-sm">
            <h2 className="font-medium text-fg">Engineer</h2>
            {job.engineerName ? (
              <div>
                <Link href={`/admin/engineers/${job.assignedEngineerId}`} className="text-fg hover:text-brand">
                  {job.engineerName}
                </Link>
                {job.engineerPhone && <p className="text-fg-muted">{job.engineerPhone}</p>}
                {job.assignedAt && <p className="text-xs text-fg-dim">Since {fullDateTimeFmt.format(job.assignedAt)}</p>}
              </div>
            ) : (
              <p className="text-amber-800">Not assigned{closed ? "" : ": no eligible engineer was available"}.</p>
            )}
            {!closed && (
              <AssignmentOverride
                requestId={job.id}
                currentId={job.assignedEngineerId}
                engineers={engineers.filter((e) => !e.disabled && e.hasPassword).map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`.trim(), activeJobs: e.activeJobs, note: e.ineligible }))}
              />
            )}
          </section>

          <section className="rounded-xl border border-line p-4 text-sm">
            <h2 className="mb-2 font-medium text-fg">Customer</h2>
            <p className="text-fg">{job.contactName}</p>
            <a href={`tel:${job.contactPhone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 text-fg-muted hover:text-brand">
              <Phone className="size-3.5" aria-hidden /> {job.contactPhone}
            </a>
            {job.contactEmail && <p className="text-fg-muted">{job.contactEmail}</p>}
            <p className="mt-2 text-xs text-fg-dim">{job.customer ? `Account customer since ${fullDateTimeFmt.format(job.customer.createdAt)}` : "Walk-in: no online account"}</p>
          </section>

          <section className="rounded-xl border border-line p-4 text-sm">
            <h2 className="mb-2 flex items-center gap-1.5 font-medium text-fg">
              {job.location === "on_site" ? <MapPin className="size-4 text-brand" aria-hidden /> : <Store className="size-4 text-brand" aria-hidden />}
              {job.location === "on_site" ? "On-site visit" : "In shop"}
            </h2>
            {a ? (
              <>
                <address className="not-italic leading-relaxed text-fg-muted">
                  {a.recipientName && <span className="block text-fg">{a.recipientName}</span>}
                  {a.line1}
                  {a.line2 && <>, {a.line2}</>}
                  <br />
                  {a.landmark && (
                    <>
                      Near {a.landmark.replace(/^near\s+/i, "")}
                      <br />
                    </>
                  )}
                  {a.city}, {a.state} {a.postalCode}
                </address>
                {links ? (
                  <div className="mt-2 flex flex-wrap gap-3">
                    <a href={links.view} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
                      <MapPin className="size-3.5" aria-hidden /> {links.source === "pin" ? "Saved pin" : links.source === "shared_link" ? "Shared location" : "Open in maps"}
                    </a>
                    <a href={links.directions} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
                      <Navigation className="size-3.5" aria-hidden /> Directions
                    </a>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-800">No usable location saved; the engineer will need to call for directions.</p>
                )}
              </>
            ) : (
              <p className="text-fg-muted">The device is at the shop.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
