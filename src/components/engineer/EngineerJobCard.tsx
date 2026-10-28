"use client";

import { MapPin, Navigation, Phone } from "lucide-react";
import { useState } from "react";
import { engineerNoteAction, engineerStatusAction, requestTransferAction, withdrawTransferAction } from "@/app/engineer/actions";
import { ResultAlert, smallButton, smallPrimary, Spinner, useAdminAction } from "@/components/admin/actions-ui";
import { SelectField } from "@/components/forms/controls";
import type { ServiceAddress, ServicePriority, ServiceStatus } from "@/lib/server/db/schema";
import { deviceTypeLabel, engineerFlow, priorityLabel, serviceNumber, serviceStatusLabel } from "@/lib/service-desk";

type Job = {
  id: string;
  seq: number;
  status: ServiceStatus;
  priority: ServicePriority;
  deviceType: keyof typeof deviceTypeLabel;
  deviceBrand: string | null;
  deviceModel: string | null;
  issue: string;
  contactName: string;
  contactPhone: string;
  location: "in_shop" | "on_site";
  serviceAddress: ServiceAddress | null;
  pendingTransfer: { id: string; to: string } | null;
};

const area = "w-full rounded-xl border border-line-strong bg-ink-850 px-3 py-2 text-sm text-fg placeholder:text-fg-dim focus:border-brand focus:ring-4 focus:ring-[var(--brand-glow)]";

/** One assigned job with the engineer's actions: progress, notes and transfer requests. */
export function EngineerJobCard({ job, colleagues }: { job: Job; colleagues: { id: string; name: string }[] }) {
  const [panel, setPanel] = useState<"status" | "note" | "transfer" | null>(null);
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const { run, busy, result } = useAdminAction();
  const next = engineerFlow(job.status);
  const a = job.serviceAddress;
  const destination = a ? encodeURIComponent([a.line1, a.line2, a.landmark, a.city, a.state, a.postalCode].filter(Boolean).join(", ")) : "";
  const done = (r: { ok: boolean }) => r.ok && (setPanel(null), setTo(""), setText(""));
  const open = (p: typeof panel) => {
    setPanel(panel === p ? null : p);
    setTo("");
    setText("");
  };

  return (
    <li className="grid gap-3 rounded-xl border border-line p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-fg">
          {serviceNumber(job.seq)} · {deviceTypeLabel[job.deviceType]}
          {(job.deviceBrand || job.deviceModel) && <span className="font-normal text-fg-muted"> · {[job.deviceBrand, job.deviceModel].filter(Boolean).join(" ")}</span>}
        </p>
        <span className="flex gap-1.5 text-xs">
          <span className={`rounded-full px-2.5 py-0.5 font-medium ${job.priority === "urgent" ? "bg-red-50 text-red-700" : job.priority === "high" ? "bg-amber-100 text-amber-800" : "bg-ink-900 text-fg-muted"}`}>{priorityLabel[job.priority]}</span>
          <span className="rounded-full bg-brand/10 px-2.5 py-0.5 font-medium text-brand">{serviceStatusLabel[job.status]}</span>
        </span>
      </div>
      <p className="whitespace-pre-line text-fg">{job.issue}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-fg-muted">
        <span>{job.contactName}</span>
        <a href={`tel:${job.contactPhone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 hover:text-brand">
          <Phone className="size-3.5" aria-hidden /> {job.contactPhone}
        </a>
        {a ? (
          <>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden /> {a.line1}, {a.city} {a.postalCode}
            </span>
            <a href={a.mapsUrl ?? `https://www.google.com/maps/dir/?api=1&destination=${destination}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
              <Navigation className="size-3.5" aria-hidden /> Directions
            </a>
          </>
        ) : (
          <span>At the shop</span>
        )}
      </div>
      {job.pendingTransfer && (
        <p className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Transfer to {job.pendingTransfer.to} is waiting for admin approval.
          <button type="button" disabled={busy !== null} onClick={() => run("withdraw", () => withdrawTransferAction(job.pendingTransfer!.id))} className="font-medium underline">
            Withdraw
          </button>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {next.length > 0 && (
          <button type="button" onClick={() => open("status")} aria-expanded={panel === "status"} className={smallPrimary}>
            Update status
          </button>
        )}
        <button type="button" onClick={() => open("note")} aria-expanded={panel === "note"} className={smallButton}>
          Add note
        </button>
        {!job.pendingTransfer && colleagues.length > 0 && (
          <button type="button" onClick={() => open("transfer")} aria-expanded={panel === "transfer"} className={smallButton}>
            Request transfer
          </button>
        )}
      </div>
      {panel && (
        <form
          className="grid gap-3 rounded-lg border border-line bg-ink-950 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (panel === "status") run("status", () => engineerStatusAction(job.id, to as ServiceStatus, text), done);
            if (panel === "note") run("note", () => engineerNoteAction(job.id, text), done);
            if (panel === "transfer") run("transfer", () => requestTransferAction(job.id, to, text), done);
          }}
        >
          {panel === "status" && <SelectField label="Move to" placeholder="Choose" options={next.map((s) => ({ value: s, label: serviceStatusLabel[s] }))} value={to} onChange={(e) => setTo(e.target.value)} />}
          {panel === "transfer" && <SelectField label="Hand it to" placeholder="Choose an engineer" options={colleagues.map((c) => ({ value: c.id, label: c.name }))} value={to} onChange={(e) => setTo(e.target.value)} />}
          <label className="grid gap-1.5 text-sm font-medium text-fg">
            {panel === "transfer" ? "Why" : panel === "status" && to === "completed" ? "What you did" : "Note"}
            <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} style={{ outline: "none" }} className={`${area} font-normal`} />
          </label>
          {panel === "transfer" && <p className="text-xs text-fg-muted">An admin approves or rejects it. Until then the job stays with you.</p>}
          {result && !result.ok && <ResultAlert result={result} />}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPanel(null)} className={smallButton}>
              Cancel
            </button>
            <button type="submit" disabled={busy !== null || ((panel === "status" || panel === "transfer") && !to) || ((panel !== "status" || to === "completed") && !text.trim())} className={smallPrimary}>
              {busy && <Spinner />} Save
            </button>
          </div>
        </form>
      )}
      {result?.ok && <ResultAlert result={result} />}
    </li>
  );
}
