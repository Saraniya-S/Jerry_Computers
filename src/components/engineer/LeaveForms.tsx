"use client";

import { useState } from "react";
import { cancelLeaveAction, requestLeaveAction } from "@/app/engineer/actions";
import { ConfirmDialog, ResultAlert, smallButton, smallPrimary, Spinner, useAdminAction } from "@/components/admin/actions-ui";
import { TextField } from "@/components/forms/controls";

/** Asks for one or more days off (both dates included); an admin approves it. */
export function LeaveRequestForm({ today, maxDays }: { today: string; maxDays: number }) {
  const [v, setV] = useState({ startsOn: today, endsOn: today, reason: "" });
  const { run, busy, result } = useAdminAction();
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run("book", () => requestLeaveAction(v), (r) => r.ok && setV({ startsOn: today, endsOn: today, reason: "" }));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="First day off" type="date" min={today} value={v.startsOn} onChange={(e) => setV((c) => ({ ...c, startsOn: e.target.value, endsOn: c.endsOn < e.target.value ? e.target.value : c.endsOn }))} />
        <TextField label="Last day off" type="date" min={v.startsOn || today} value={v.endsOn} onChange={(e) => setV((c) => ({ ...c, endsOn: e.target.value }))} hint={`Up to ${maxDays} days at a time.`} />
      </div>
      <TextField label="Reason" optional maxLength={200} value={v.reason} onChange={(e) => setV((c) => ({ ...c, reason: e.target.value }))} placeholder="e.g. Family function" />
      {result && <ResultAlert result={result} />}
      <button type="submit" disabled={busy !== null || !v.startsOn || !v.endsOn} className={`${smallPrimary} w-fit`}>
        {busy && <Spinner />} Ask for leave
      </button>
    </form>
  );
}

export function CancelLeaveButton({ leaveId, dates, status, started }: { leaveId: string; dates: string; status: "pending" | "approved"; started: boolean }) {
  const pending = status === "pending";
  return (
    <ConfirmDialog
      title={pending ? "Withdraw this request?" : "Cancel this leave?"}
      tone="primary"
      confirmLabel={pending ? "Withdraw" : "Cancel leave"}
      onConfirm={() => cancelLeaveAction(leaveId)}
      trigger={(open) => (
        <button type="button" onClick={open} className={smallButton}>
          {pending ? "Withdraw" : started ? "End early" : "Cancel"}
        </button>
      )}
    >
      {pending ? `The request for ${dates} is removed.` : started ? `Your leave (${dates}) ends now and new jobs can reach you from today.` : `New jobs can be assigned to you on ${dates} again. The shop is told.`}
    </ConfirmDialog>
  );
}
