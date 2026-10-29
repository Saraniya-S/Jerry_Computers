import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, MapPin, Navigation, Phone, Store } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { PriorityBadge, ServiceStatusBadge } from "@/components/admin/ServiceBadges";
import { Badge, fullDateTimeFmt } from "@/components/admin/ui";
import { ScheduleForm, StatusForm, TransferForm, WorkNoteForm } from "@/components/engineer/JobActions";
import { engineerCollectionAction } from "@/app/engineer/actions";
import { CollectionsCard } from "@/components/admin/CollectionsCard";
import { listCollections } from "@/lib/server/admin/collections";
import { requireStaff } from "@/lib/server/auth";
import { getMyJob, transferCandidates } from "@/lib/server/engineer/jobs";
import { getSettings } from "@/lib/server/settings";
import { deviceTypeLabel, engineerFlow, isActiveStatus, isClosedStatus, noteKindLabel, serviceNumber, serviceStatusLabel } from "@/lib/service-desk";
import { locationLinks } from "@/lib/service-location";
import { preferredLabel } from "@/lib/service-request-form";

export const metadata: Metadata = { title: "Job" };

const methodLabel = { auto: "Automatic", manual: "Admin", transfer: "Approved transfer", unassigned: "Unassigned" } as const;
const sourceLabel = { pin: "saved map pin", shared_link: "location the customer shared", address: "street address" } as const;
const callBtn = "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-medium sm:flex-none sm:px-5";

export default function EngineerJobPage({ params }: PageProps<"/engineer/jobs/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Job params={params} />
    </Suspense>
  );
}

async function Job({ params }: Pick<PageProps<"/engineer/jobs/[id]">, "params">) {
  const me = await requireStaff(["engineer"]);
  const { id } = await params;
  // Only found when the job is assigned to this engineer; anything else is a plain 404.
  const job = /^[0-9a-f-]{36}$/i.test(id) ? await getMyJob(me.id, id) : null;
  if (!job) notFound();
  const [candidates, shop, collections] = await Promise.all([
    isActiveStatus(job.status) ? transferCandidates(me.id, job) : [],
    job.location === "in_shop" ? getSettings("shop") : null,
    listCollections(job.id),
  ]);
  const pending = job.transfers.find((t) => t.t.status === "pending");
  const links = job.location === "on_site" ? locationLinks(job.serviceAddress) : null;
  const a = job.serviceAddress;
  const ticket = serviceNumber(job.seq);
  const reportEntries = job.events.filter(({ e }) => e.kind !== "note" || e.note);

  return (
    <>
      <PageHeader
        title={
          <>
            {ticket} <ServiceStatusBadge status={job.status} /> <PriorityBadge priority={job.priority} />
            {pending && <Badge tone="warn">Transfer requested</Badge>}
          </>
        }
        description={`${deviceTypeLabel[job.deviceType]}${job.deviceBrand || job.deviceModel ? ` · ${[job.deviceBrand, job.deviceModel].filter(Boolean).join(" ")}` : ""} · ${job.location === "on_site" ? "on-site visit" : "in shop"}`}
        actions={
          <Link href="/engineer/jobs" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden /> My jobs
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3 sm:px-7">
        <a href={`tel:${job.contactPhone.replace(/\s/g, "")}`} className={`${callBtn} border border-line-strong text-fg hover:bg-ink-900`}>
          <Phone className="size-4" aria-hidden /> Call {job.contactName.split(" ")[0]}
        </a>
        {links && (
          <a href={links.directions} target="_blank" rel="noreferrer" className={`${callBtn} bg-brand text-white hover:bg-[var(--brand-hover)]`}>
            <Navigation className="size-4" aria-hidden /> Directions
          </a>
        )}
      </div>

      <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[1fr_360px]">
        <div className="grid content-start gap-6">
          <Card title="Problem">
            <p className="whitespace-pre-line text-fg">{job.issue}</p>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <Item k="Device" v={deviceTypeLabel[job.deviceType]} />
              <Item k="Brand / model" v={[job.deviceBrand, job.deviceModel].filter(Boolean).join(" ") || "—"} />
              <Item k="Serial number" v={job.serialNumber ?? "—"} />
              <Item k="Left with the device" v={job.accessories ?? "—"} />
              <Item k="Assigned to you" v={job.assignedAt ? fullDateTimeFmt.format(job.assignedAt) : "—"} />
              <Item k="Accepted" v={job.acceptedAt ? fullDateTimeFmt.format(job.acceptedAt) : "Not yet"} />
              <Item k="Scheduled" v={job.scheduledAt ? fullDateTimeFmt.format(job.scheduledAt) : "Not scheduled"} />
              <Item k="Logged" v={fullDateTimeFmt.format(job.createdAt)} />
              {job.source === "online" && (
                <>
                  <Item k="Customer's chosen problem" v={job.problemType ?? "Something else"} />
                  <Item k="Customer's preferred time" v={preferredLabel(job.preferredDate, job.preferredWindow) ?? "No preference"} />
                </>
              )}
            </dl>
            {job.resolution && (
              <div className="rounded-lg bg-mint-soft px-3 py-2 text-leaf">
                <p className="text-xs font-medium">Completion report</p>
                <p className="whitespace-pre-line">{job.resolution}</p>
              </div>
            )}
          </Card>

          <Card title="Work report and history">
            {job.status !== "cancelled" && <WorkNoteForm requestId={job.id} closed={!isActiveStatus(job.status)} />}
            <ol className="grid gap-3 border-l border-line pl-4">
              {reportEntries.map(({ e, by, byRole }) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-brand" aria-hidden />
                  <p className="text-fg">
                    {e.toStatus && e.fromStatus !== e.toStatus ? (
                      <span className="font-medium">{serviceStatusLabel[e.toStatus]}</span>
                    ) : e.kind !== "note" ? (
                      <span className="font-medium">{noteKindLabel[e.kind]}</span>
                    ) : null}
                    {((e.toStatus && e.fromStatus !== e.toStatus) || e.kind !== "note") && e.note ? ": " : null}
                    <span className="whitespace-pre-line">{e.note}</span>
                  </p>
                  <p className="text-xs text-fg-dim">
                    {fullDateTimeFmt.format(e.createdAt)} · {by?.trim() || "System"}
                    {byRole === "admin" && " (admin)"}
                  </p>
                </li>
              ))}
            </ol>
          </Card>

          <Card title="Assignment history">
            <ul className="grid gap-2">
              {job.assignments.map(({ a: h, to, from }) => (
                <li key={h.id}>
                  <p className="text-fg">
                    <Badge tone={h.method === "transfer" ? "info" : h.method === "auto" ? "brand" : "neutral"}>{methodLabel[h.method]}</Badge> {from?.trim() ? `${from} → ` : ""}
                    {to?.trim() || "Unassigned"}
                  </p>
                  <p className="text-xs text-fg-dim">
                    {fullDateTimeFmt.format(h.createdAt)}
                    {h.reason && ` · ${h.reason}`}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <CollectionsCard
            requestId={job.id}
            rows={collections.rows}
            totalPaise={collections.totalPaise}
            canRecord={job.status !== "cancelled" && job.status !== "unable_to_complete"}
            canCorrect={false}
            onRecord={engineerCollectionAction}
          />

          <Card title="Status">
            {job.status === "unable_to_complete" ? (
              <p className="text-fg-muted">You handed this job back. An admin will reassign or cancel it.</p>
            ) : isClosedStatus(job.status) ? (
              <p className="text-fg-muted">This job is {serviceStatusLabel[job.status].toLowerCase()}.</p>
            ) : (
              <StatusForm requestId={job.id} next={engineerFlow(job.status)} />
            )}
          </Card>

          <Card title={job.location === "on_site" ? "Customer location" : "Where the device is"} icon={job.location === "on_site" ? <MapPin className="size-4 text-brand" aria-hidden /> : <Store className="size-4 text-brand" aria-hidden />}>
            {job.location === "on_site" ? (
              <>
                {a ? (
                  <address className="not-italic leading-relaxed text-fg-muted">
                    {a.recipientName && <span className="block text-fg">{a.recipientName}</span>}
                    {a.line1}
                    {a.line2 && `, ${a.line2}`}
                    {a.landmark && <span className="block">Near {a.landmark.replace(/^near\s+/i, "")}</span>}
                    <span className="block">
                      {a.city}, {a.state} {a.postalCode}
                    </span>
                  </address>
                ) : null}
                {links ? (
                  <div className="grid gap-1">
                    <a href={links.view} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
                      <MapPin className="size-3.5" aria-hidden /> Open in maps
                    </a>
                    <span className="text-xs text-fg-dim">From the {sourceLabel[links.source]}.</span>
                  </div>
                ) : (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">No usable location is saved for this job. Call the customer for directions, and ask the shop to add the address or a map pin.</p>
                )}
              </>
            ) : shop?.address ? (
              <address className="not-italic leading-relaxed text-fg-muted">
                <span className="block text-fg">{shop.legalName || "Jerry Computers"}</span>
                {shop.address}
                <span className="block">
                  {[shop.city, shop.state, shop.postalCode].filter(Boolean).join(", ")}
                </span>
                {shop.mapUrl && (
                  <a href={shop.mapUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-brand hover:underline">
                    <MapPin className="size-3.5" aria-hidden /> Shop on the map
                  </a>
                )}
              </address>
            ) : (
              <p className="text-fg-muted">At the shop. The shop address isn&apos;t set in Shop settings yet.</p>
            )}
          </Card>

          <Card title="Customer">
            <p className="text-fg">{job.contactName}</p>
            <a href={`tel:${job.contactPhone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 text-fg-muted hover:text-brand">
              <Phone className="size-3.5" aria-hidden /> {job.contactPhone}
            </a>
            {job.contactEmail && <p className="text-fg-muted">{job.contactEmail}</p>}
          </Card>

          {isActiveStatus(job.status) && (
            <Card title="Schedule" icon={<CalendarClock className="size-4 text-brand" aria-hidden />}>
              <ScheduleForm requestId={job.id} current={job.scheduledAt} />
            </Card>
          )}

          {(isActiveStatus(job.status) || job.transfers.length > 0) && (
            <Card title="Transfer">
              {isActiveStatus(job.status) && (
                <TransferForm requestId={job.id} candidates={candidates} pending={pending ? { id: pending.t.id, to: pending.to, createdAt: fullDateTimeFmt.format(pending.t.createdAt) } : null} />
              )}
              {job.transfers.filter((t) => t.t.status !== "pending").length > 0 && (
                <ul className="grid gap-2 border-t border-line pt-3">
                  {job.transfers
                    .filter((t) => t.t.status !== "pending")
                    .map(({ t, to }) => (
                      <li key={t.id} className="text-xs text-fg-muted">
                        <Badge tone={t.status === "approved" ? "good" : t.status === "rejected" ? "bad" : "muted"}>{t.status}</Badge> to {to}, {fullDateTimeFmt.format(t.createdAt)}
                        {t.decisionNote && <span className="block">“{t.decisionNote}”</span>}
                      </li>
                    ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Card({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-3 rounded-xl border border-line p-4 text-sm sm:p-5">
      <h2 className="flex items-center gap-1.5 font-medium text-fg">
        {icon}
        {title}
      </h2>
      {children}
    </section>
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
