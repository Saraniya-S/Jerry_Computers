"use client";

import { useState } from "react";
import { addServiceNoteAction, changeServiceStatusAction, overrideAssignmentAction, setScheduleAction } from "@/app/admin/service-requests/actions";
import { SelectField, TextField } from "@/components/forms/controls";
import type { ServiceStatus } from "@/lib/server/db/schema";
import { notePrompt, noteRequiredFor, serviceStatusLabel } from "@/lib/service-desk";
import { ResultAlert, smallButton, smallPrimary, Spinner, useAdminAction } from "./actions-ui";

const area = "w-full rounded-xl border border-line-strong bg-ink-850 px-3 py-2 text-sm text-fg placeholder:text-fg-dim focus:border-brand focus:ring-4 focus:ring-[var(--brand-glow)]";

/** Status change with a note (required to complete or cancel). */
export function StatusChanger({ requestId, next }: { requestId: string; next: ServiceStatus[] }) {
  const [to, setTo] = useState<ServiceStatus | "">("");
  const [note, setNote] = useState("");
  const { run, busy, result } = useAdminAction();
  if (!next.length) return <p className="text-sm text-fg-muted">This job is closed.</p>;
  const needsNote = to !== "" && noteRequiredFor(to);
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (to) run("status", () => changeServiceStatusAction({ requestId, to, note }), (r) => r.ok && (setTo(""), setNote("")));
      }}
    >
      <SelectField label="Move to" placeholder="Choose a status" options={next.map((s) => ({ value: s, label: serviceStatusLabel[s] }))} value={to} onChange={(e) => setTo(e.target.value as ServiceStatus)} />
      <label className="grid gap-1.5 text-sm font-medium text-fg">
        {(to && notePrompt[to]) || "Note"}
        {!needsNote && <span className="-mt-1 text-xs font-normal text-fg-dim">Optional</span>}
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} style={{ outline: "none" }} className={`${area} font-normal`} />
      </label>
      {result && <ResultAlert result={result} />}
      <button type="submit" disabled={busy !== null || !to || (needsNote && !note.trim())} className={smallPrimary}>
        {busy && <Spinner />} Update status
      </button>
    </form>
  );
}

/** Admin override of the assignment, with a required reason. */
export function AssignmentOverride({ requestId, currentId, engineers }: { requestId: string; currentId: string | null; engineers: { id: string; name: string; activeJobs: number; note: string | null }[] }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const { run, busy, result } = useAdminAction();
  if (!open)
    return (
      <div className="grid gap-2">
        {result && <ResultAlert result={result} />}
        <button type="button" onClick={() => setOpen(true)} className={`${smallButton} w-fit`}>
          Change assignment
        </button>
      </div>
    );
  return (
    <form
      className="grid gap-3 rounded-lg border border-line bg-ink-950 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run("assign", () => overrideAssignmentAction(requestId, target, reason), (r) => r.ok && (setOpen(false), setTarget(""), setReason("")));
      }}
    >
      <SelectField
        label="Assign to"
        placeholder="Choose"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        options={[
          { value: "auto", label: "Next engineer by the automatic rule" },
          ...engineers.filter((e) => e.id !== currentId).map((e) => ({ value: e.id, label: `${e.name} · ${e.activeJobs} active${e.note ? ` · ${e.note}` : ""}` })),
          ...(currentId ? [{ value: "none", label: "Nobody (unassign)" }] : []),
        ]}
      />
      <label className="grid gap-1.5 text-sm font-medium text-fg">
        Reason
        <textarea rows={2} required value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} style={{ outline: "none" }} className={`${area} font-normal`} />
      </label>
      {result && !result.ok && <ResultAlert result={result} />}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className={smallButton}>
          Cancel
        </button>
        <button type="submit" disabled={busy !== null || !target || !reason.trim()} className={smallPrimary}>
          {busy && <Spinner />} Save assignment
        </button>
      </div>
    </form>
  );
}

export function NoteForm({ requestId }: { requestId: string }) {
  const [note, setNote] = useState("");
  const { run, busy, result } = useAdminAction();
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run("note", () => addServiceNoteAction(requestId, note), (r) => r.ok && setNote(""));
      }}
    >
      <label htmlFor="job-note" className="sr-only">
        Add a note
      </label>
      <textarea id="job-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note to the job history" maxLength={1000} style={{ outline: "none" }} className={area} />
      {result && !result.ok && <ResultAlert result={result} />}
      <button type="submit" disabled={busy !== null || !note.trim()} className={`${smallButton} w-fit`}>
        {busy && <Spinner />} Add note
      </button>
    </form>
  );
}

const toLocalInput = (d: Date) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value;
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
};

/** Admin sets the visit time; the assigned engineer is notified. */
export function ScheduleSetter({ requestId, current }: { requestId: string; current: Date | null }) {
  const [value, setValue] = useState(current ? toLocalInput(current) : "");
  const { run, busy, result } = useAdminAction();
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run("save", () => setScheduleAction(requestId, value || null));
      }}
    >
      <TextField label="Visit or bench time" type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} hint="Shop time (IST)." />
      {result && <ResultAlert result={result} />}
      <div className="flex gap-2">
        <button type="submit" disabled={busy !== null || !value} className={smallPrimary}>
          {busy === "save" && <Spinner />} Save time
        </button>
        {current && (
          <button type="button" disabled={busy !== null} onClick={() => run("clear", () => setScheduleAction(requestId, null), (r) => r.ok && setValue(""))} className={smallButton}>
            Clear
          </button>
        )}
      </div>
    </form>
  );
}
