"use client";

import { Check, X } from "lucide-react";
import { decideTransferAction } from "@/app/admin/service-requests/actions";
import { ConfirmDialog, dangerButton, smallPrimary } from "./actions-ui";

export function TransferDecision({ transferId, from, to, ticket }: { transferId: string; from: string; to: string; ticket: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmDialog
        title={`Move ${ticket} to ${to}?`}
        tone="primary"
        confirmLabel="Approve transfer"
        onConfirm={() => decideTransferAction(transferId, true, "")}
        trigger={(open) => (
          <button type="button" onClick={open} className={smallPrimary}>
            <Check className="size-4" aria-hidden /> Approve
          </button>
        )}
      >
        The job moves from {from} to {to} and the change is recorded in its assignment history. If the job was reassigned or closed since the request, approval is refused.
      </ConfirmDialog>
      <ConfirmDialog
        title={`Reject the transfer of ${ticket}?`}
        confirmLabel="Reject"
        reason={`Reason (shown to ${from})`}
        onConfirm={(reason) => decideTransferAction(transferId, false, reason)}
        trigger={(open) => (
          <button type="button" onClick={open} className={dangerButton}>
            <X className="size-4" aria-hidden /> Reject
          </button>
        )}
      >
        The job stays with {from}.
      </ConfirmDialog>
    </div>
  );
}
