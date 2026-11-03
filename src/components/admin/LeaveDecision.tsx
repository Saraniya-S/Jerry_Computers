"use client";

import { Check, X } from "lucide-react";
import { decideLeaveAction } from "@/app/admin/leave/actions";
import { ConfirmDialog, dangerButton, smallPrimary } from "./actions-ui";

export function LeaveDecision({ leaveId, name, dates, jobsInside }: { leaveId: string; name: string; dates: string; jobsInside: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmDialog
        title={`Approve ${name}'s leave (${dates})?`}
        tone="primary"
        confirmLabel="Approve leave"
        onConfirm={() => decideLeaveAction(leaveId, true, "")}
        trigger={(open) => (
          <button type="button" onClick={open} className={smallPrimary}>
            <Check className="size-4" aria-hidden /> Approve
          </button>
        )}
      >
        No new jobs will be assigned to {name} on those days.{" "}
        {jobsInside > 0 ? `${jobsInside} of their open job${jobsInside === 1 ? " is" : "s are"} scheduled then; reassign ${jobsInside === 1 ? "it" : "them"} if needed.` : "None of their open jobs are scheduled then."}
      </ConfirmDialog>
      <ConfirmDialog
        title={`Reject ${name}'s leave (${dates})?`}
        confirmLabel="Reject"
        reason={`Reason (shown to ${name})`}
        onConfirm={(reason) => decideLeaveAction(leaveId, false, reason)}
        trigger={(open) => (
          <button type="button" onClick={open} className={dangerButton}>
            <X className="size-4" aria-hidden /> Reject
          </button>
        )}
      >
        They keep getting new jobs on those days.
      </ConfirmDialog>
    </div>
  );
}
