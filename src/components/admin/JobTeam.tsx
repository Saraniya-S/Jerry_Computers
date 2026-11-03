"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Phone, UsersRound } from "lucide-react";
import type { ActionResult } from "@/lib/admin/result";
import { SelectField, TextField } from "@/components/forms/controls";
import { ConfirmDialog, ResultAlert, smallButton, smallPrimary, Spinner, useAdminAction } from "./actions-ui";

export type TeamMemberView = { engineerId: string; name: string; phone: string | null; reason: string; since: string };
export type TeamCandidate = { id: string; name: string; activeJobs: number; note: string | null };

/**
 * A job's team: the lead engineer plus helpers. Used on the admin job page and the engineer's job
 * page; the server actions passed in decide (and re-check) who may change it.
 */
export function JobTeam({
  requestId,
  lead,
  members,
  candidates,
  canRemove,
  selfId,
  onAdd,
  onRemove,
}: {
  requestId: string;
  lead: { name: string; phone: string | null; isYou?: boolean } | null;
  members: TeamMemberView[];
  /** Null when this viewer can't add anyone. */
  candidates: TeamCandidate[] | null;
  canRemove: boolean;
  /** The signed-in helper, who can leave the job. */
  selfId?: string;
  onAdd: (requestId: string, engineerId: string, reason: string) => Promise<ActionResult>;
  onRemove: (requestId: string, engineerId: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pick, setPick] = useState("");
  const [reason, setReason] = useState("");
  const { run, busy, result } = useAdminAction();
  const call = (phone: string | null) =>
    phone ? (
      <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-brand">
        <Phone className="size-3" aria-hidden /> {phone}
      </a>
    ) : null;

  return (
    <div className="grid gap-3 text-sm">
      <ul className="grid gap-2">
        <li className="flex items-start justify-between gap-3">
          <div>
            <p className="text-fg">
              {lead ? lead.name : "Not assigned"} {lead?.isYou && <span className="text-fg-dim">(you)</span>}
            </p>
            <p className="text-xs text-fg-dim">Lead engineer</p>
            {lead && !lead.isYou && call(lead.phone)}
          </div>
        </li>
        {members.map((m) => {
          const self = m.engineerId === selfId;
          return (
            <li key={m.engineerId} className="flex items-start justify-between gap-3 border-t border-line pt-2">
              <div className="min-w-0">
                <p className="text-fg">
                  {m.name} {self && <span className="text-fg-dim">(you)</span>}
                </p>
                <p className="text-xs text-fg-dim">
                  Helping since {m.since}
                  {m.reason && ` · ${m.reason}`}
                </p>
                {!self && call(m.phone)}
              </div>
              {(canRemove || self) && (
                <ConfirmDialog
                  title={self ? "Leave this job?" : `Take ${m.name} off this job?`}
                  tone="primary"
                  confirmLabel={self ? "Leave job" : "Take off"}
                  onConfirm={async () => {
                    const r = await onRemove(requestId, m.engineerId);
                    if (r.ok && self) router.push("/engineer/jobs");
                    return r;
                  }}
                  trigger={(open) => (
                    <button type="button" onClick={open} className={smallButton}>
                      {self ? "Leave" : "Remove"}
                    </button>
                  )}
                >
                  {self ? "It leaves your job list. The lead keeps the job." : "They'll stop seeing this job. Their notes stay in the work report."}
                </ConfirmDialog>
              )}
            </li>
          );
        })}
      </ul>

      {candidates && (
        <form
          className="grid gap-3 border-t border-line pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            run("add", () => onAdd(requestId, pick, reason), (r) => r.ok && (setPick(""), setReason("")));
          }}
        >
          <p className="flex items-center gap-1.5 font-medium text-fg">
            <UsersRound className="size-4 text-brand" aria-hidden /> Add an engineer
          </p>
          {candidates.length ? (
            <>
              <SelectField
                label="Engineer"
                placeholder="Choose"
                options={candidates.map((c) => ({ value: c.id, label: `${c.name} · ${c.activeJobs} active${c.note ? ` · ${c.note}` : ""}` }))}
                value={pick}
                onChange={(e) => setPick(e.target.value)}
              />
              <TextField label="Why" optional maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Two people needed for the rack install" />
              <button type="submit" disabled={busy !== null || !pick} className={`${smallPrimary} w-fit`}>
                {busy && <Spinner />} Add to job
              </button>
            </>
          ) : (
            <p className="text-fg-muted">No other engineer can join right now.</p>
          )}
        </form>
      )}
      {result && <ResultAlert result={result} />}
    </div>
  );
}
