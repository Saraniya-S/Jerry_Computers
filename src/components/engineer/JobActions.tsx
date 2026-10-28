"use client";

import { useState } from "react";
import { engineerNoteAction, engineerScheduleAction, engineerStatusAction, requestTransferAction, withdrawTransferAction } from "@/app/engineer/actions";
import { ConfirmDialog, ResultAlert, smallButton, smallPrimary, Spinner, useAdminAction } from "@/components/admin/actions-ui";
import { SelectField, TextField } from "@/components/forms/controls";
import type { ServiceNoteKind, ServiceStatus } from "@/lib/server/db/schema";
import { noteKindLabel, notePrompt, noteRequiredFor, reportKinds, serviceStatusLabel } from "@/lib/service-desk";

const area = "w-full rounded-xl border border-line-strong bg-ink-850 px-3 py-2 text-sm font-normal text-fg placeholder:text-fg-dim focus:border-brand focus:ring-4 focus:ring-[var(--brand-glow)]";
/** A bigger tap target than the admin's small buttons: this is used on a phone at the customer's door. */
const bigPrimary = "inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-[0.95rem] font-medium text-white hover:bg-[var(--brand-hover)] disabled:opacity-60";

/** Moves the job along the engineer's allowed steps. */
export function StatusForm({ requestId, next }: { requestId: string; next: ServiceStatus[] }) {
  const [to, setTo] = useState<ServiceStatus | "">(next.length === 1 ? next[0] : "");
  const [note, setNote] = useState("");
  const { run, busy, result } = useAdminAction();
  if (!next.length) return <p className="text-sm text-fg-muted">No further steps for you on this job.</p>;
  const required = to !== "" && noteRequiredFor(to);
  const submit = () => run("status", () => engineerStatusAction(requestId, to as ServiceStatus, note), (r) => r.ok && (setTo(""), setNote("")));
  const button = (open?: () => void) => (
    <button type={open ? "button" : "submit"} onClick={open} disabled={busy !== null || !to || (required && !note.trim())} className={bigPrimary}>
      {busy && <Spinner />} {to ? `Mark as ${serviceStatusLabel[to].toLowerCase()}` : "Update status"}
    </button>
  );
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {next.includes("accepted") && to === "accepted" && <p className="text-sm text-fg-muted">Accepting tells the shop you&apos;ve seen the job and will handle it.</p>}
      <SelectField label="Next step" placeholder="Choose" options={next.map((s) => ({ value: s, label: serviceStatusLabel[s] }))} value={to} onChange={(e) => setTo(e.target.value as ServiceStatus)} />
      <label className="grid gap-1.5 text-sm font-medium text-fg">
        {(to && notePrompt[to]) || "Note"}
        {!required && <span className="-mt-1 text-xs font-normal text-fg-dim">Optional</span>}
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} style={{ outline: "none" }} className={area} />
      </label>
      {result && <ResultAlert result={result} />}
      {to === "completed" || to === "unable_to_complete" ? (
        <ConfirmDialog
          title={to === "completed" ? "Complete this job?" : "Hand this job back?"}
          tone={to === "completed" ? "primary" : "danger"}
          confirmLabel={to === "completed" ? "Complete job" : "Hand back"}
          onConfirm={() => engineerStatusAction(requestId, to, note)}
          trigger={(open) => button(open)}
        >
          {to === "completed" ? "It leaves your active workload and your note becomes the completion report. This can't be undone from here." : "An admin will reassign or cancel it. It leaves your active workload."}
        </ConfirmDialog>
      ) : (
        button()
      )}
    </form>
  );
}

/** Adds an entry to the job's work report. Entries are never edited, so the history stays intact. */
export function WorkNoteForm({ requestId, closed }: { requestId: string; closed: boolean }) {
  const kinds = closed ? (["follow_up", "customer_feedback"] as const) : reportKinds;
  const [kind, setKind] = useState<ServiceNoteKind>(kinds[0]);
  const [note, setNote] = useState("");
  const { run, busy, result } = useAdminAction();
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run("note", () => engineerNoteAction(requestId, kind, note), (r) => r.ok && setNote(""));
      }}
    >
      <SelectField label="Entry" options={kinds.map((k) => ({ value: k, label: noteKindLabel[k] }))} value={kind} onChange={(e) => setKind(e.target.value as ServiceNoteKind)} />
      <label htmlFor={`note-${requestId}`} className="sr-only">
        Details
      </label>
      <textarea id={`note-${requestId}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Details" style={{ outline: "none" }} className={area} />
      {result && <ResultAlert result={result} />}
      <button type="submit" disabled={busy !== null || !note.trim()} className={`${smallButton} w-fit`}>
        {busy && <Spinner />} Add to report
      </button>
    </form>
  );
}

/** datetime-local value in shop time (IST) for a Date. */
const toLocalInput = (d: Date) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value;
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
};

export function ScheduleForm({ requestId, current }: { requestId: string; current: Date | null }) {
  const [value, setValue] = useState(current ? toLocalInput(current) : "");
  const [note, setNote] = useState("");
  const { run, busy, result } = useAdminAction();
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run("schedule", () => engineerScheduleAction(requestId, value || null, note));
      }}
    >
      <TextField label="Visit or bench time" type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} hint="Shop time (IST). Agree it with the customer first." />
      <TextField label="Note" optional value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. Customer asked for after 4 pm" />
      {result && <ResultAlert result={result} />}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy !== null || !value} className={smallPrimary}>
          {busy === "schedule" && <Spinner />} Save time
        </button>
        {current && (
          <button type="button" disabled={busy !== null} onClick={() => run("clear", () => engineerScheduleAction(requestId, null, note), (r) => r.ok && setValue(""))} className={smallButton}>
            Clear
          </button>
        )}
      </div>
    </form>
  );
}

/** Ask for the job to move to a colleague, or withdraw a pending request. The admin decides. */
export function TransferForm({ requestId, candidates, pending }: { requestId: string; candidates: { id: string; name: string }[]; pending: { id: string; to: string; createdAt: string } | null }) {
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const { run, busy, result } = useAdminAction();
  if (pending)
    return (
      <div className="grid gap-3 text-sm">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
          Waiting for an admin to approve moving this job to <span className="font-medium">{pending.to}</span> (asked {pending.createdAt}). It stays with you until then.
        </p>
        {result && <ResultAlert result={result} />}
        <ConfirmDialog
          title="Withdraw the transfer request?"
          tone="primary"
          confirmLabel="Withdraw"
          onConfirm={() => withdrawTransferAction(pending.id)}
          trigger={(open) => (
            <button type="button" onClick={open} className={`${smallButton} w-fit`}>
              Withdraw request
            </button>
          )}
        />
      </div>
    );
  if (!candidates.length)
    return (
      <div className="grid gap-2 text-sm text-fg-muted">
        {result && <ResultAlert result={result} />}
        <p>No other engineer can take this job right now (available, and taking this device and location). Ask an admin if it needs to move.</p>
      </div>
    );
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run("transfer", () => requestTransferAction(requestId, to, reason), (r) => r.ok && (setTo(""), setReason("")));
      }}
    >
      <SelectField label="Hand it to" placeholder="Choose an engineer" options={candidates.map((c) => ({ value: c.id, label: c.name }))} value={to} onChange={(e) => setTo(e.target.value)} />
      <label className="grid gap-1.5 text-sm font-medium text-fg">
        Reason
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} style={{ outline: "none" }} className={area} />
      </label>
      {result && <ResultAlert result={result} />}
      <button type="submit" disabled={busy !== null || !to || reason.trim().length < 5} className={`${smallButton} w-fit`}>
        {busy && <Spinner />} Request transfer
      </button>
    </form>
  );
}
