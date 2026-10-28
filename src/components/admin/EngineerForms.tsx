"use client";

import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import { updateEngineerProfileAction } from "@/app/admin/service-requests/actions";
import { inviteStaffAction, setDisabledAction } from "@/app/admin/team/actions";
import { primaryButton } from "@/components/account/buttons";
import { ChipGroup, TextField, ToggleCard } from "@/components/forms/controls";
import type { DeviceType } from "@/lib/server/db/schema";
import { deviceTypeLabel, deviceTypes } from "@/lib/service-desk";
import { ConfirmDialog, dangerButton, ResultAlert, smallButton, smallPrimary, Spinner, useAdminAction } from "./actions-ui";

/** Invites a service engineer by email (same flow as Staff accounts). */
export function InviteEngineer() {
  const ref = useRef<HTMLDialogElement>(null);
  const [v, setV] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy, result, setResult } = useAdminAction();
  return (
    <>
      <button
        type="button"
        className={primaryButton}
        onClick={() => {
          setResult(null);
          ref.current?.showModal();
        }}
      >
        <Plus className="size-4" aria-hidden /> Invite engineer
      </button>
      {result?.ok && (
        <span role="status" className="text-sm text-leaf">
          {result.message}
        </span>
      )}
      <dialog ref={ref} aria-label="Invite engineer" className="m-auto w-[min(30rem,92vw)] rounded-2xl border border-line bg-ink-850 p-0 text-fg shadow-2xl backdrop:bg-[rgb(28_25_56/0.35)]">
        <form
          className="grid gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            run("invite", () => inviteStaffAction({ ...v, role: "engineer" }), (r) => {
              setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
              if (r.ok) {
                setV({ firstName: "", lastName: "", email: "", phone: "" });
                ref.current?.close();
              }
            });
          }}
        >
          <h2 className="text-base font-semibold">Invite a service engineer</h2>
          <p className="-mt-2 text-sm text-fg-muted">They get an email to set a password. Once they do, they start receiving jobs.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="First name" value={v.firstName} error={errors.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} />
            <TextField label="Last name" optional value={v.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} />
          </div>
          <TextField label="Work email" type="email" value={v.email} error={errors.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
          <TextField label="Mobile" prefix="+91" inputMode="tel" value={v.phone} error={errors.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
          {result && !result.ok && <ResultAlert result={result} />}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => ref.current?.close()} className={smallButton}>
              Cancel
            </button>
            <button type="submit" disabled={busy !== null} className={smallPrimary}>
              {busy && <Spinner />} Send invitation
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function EngineerSettingsForm({ userId, initial }: { userId: string; initial: { isAvailable: boolean; skills: DeviceType[]; takesOnSite: boolean; notes: string } }) {
  const [v, setV] = useState(initial);
  const { run, busy, result } = useAdminAction();
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run("save", () => updateEngineerProfileAction(userId, v));
      }}
    >
      <ToggleCard title="Available for new jobs" description="Off while on leave. Existing jobs stay with them." checked={v.isAvailable} onChange={(x) => setV({ ...v, isAvailable: x })} />
      <ToggleCard title="Takes on-site visits" description="Off for in-shop bench work only." checked={v.takesOnSite} onChange={(x) => setV({ ...v, takesOnSite: x })} />
      <ChipGroup label="Device types" hint="Pick none to take every type." options={deviceTypes.map((d) => ({ value: d, label: deviceTypeLabel[d] }))} value={v.skills} onChange={(skills) => setV({ ...v, skills })} />
      <TextField label="Notes" optional value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} maxLength={500} placeholder="e.g. Covers Velachery area" />
      {result && <ResultAlert result={result} />}
      <button type="submit" disabled={busy !== null} className={`${smallPrimary} w-fit`}>
        {busy && <Spinner />} Save settings
      </button>
    </form>
  );
}

export function EngineerAccountToggle({ userId, name, disabled, activeJobs }: { userId: string; name: string; disabled: boolean; activeJobs: number }) {
  return disabled ? (
    <ConfirmDialog
      title={`Switch ${name}'s account back on?`}
      tone="primary"
      confirmLabel="Switch on"
      onConfirm={() => setDisabledAction(userId, false)}
      trigger={(open) => (
        <button type="button" onClick={open} className={smallButton}>
          Switch account on
        </button>
      )}
    >
      They can sign in again and become eligible for new jobs if marked available.
    </ConfirmDialog>
  ) : (
    <>
      <ConfirmDialog
        title={`Switch off ${name}'s account?`}
        confirmLabel="Switch off"
        onConfirm={() => setDisabledAction(userId, true)}
        trigger={(open) => (
          <button type="button" onClick={open} className={dangerButton}>
            Switch account off
          </button>
        )}
      >
        They are signed out and can&apos;t sign in.{" "}
        {activeJobs ? `Their ${activeJobs} active job${activeJobs === 1 ? " is" : "s are"} handed to other engineers by the automatic rule; any nobody can take wait unassigned.` : "They have no active jobs."}
      </ConfirmDialog>
    </>
  );
}
