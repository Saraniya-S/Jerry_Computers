"use client";

import { LoaderCircle, Mail, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { changeRoleAction, inviteStaffAction, resendInviteAction, setDisabledAction, type TeamResult } from "@/app/admin/team/actions";
import { outlineButton, primaryButton } from "@/components/account/buttons";
import { FormAlert } from "@/components/auth/ui";
import { SelectField, TextField } from "@/components/forms/controls";

export type Member = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: "admin" | "ecommerce_staff" | "engineer";
  isSuperAdmin: boolean;
  status: "invited" | "active" | "disabled";
  lastLogin: string | null;
};

const roleLabel = { admin: "Admin", ecommerce_staff: "E-commerce staff", engineer: "Service engineer" };
const statusStyle = { invited: "bg-amber-100 text-amber-800", active: "bg-mint-soft text-leaf", disabled: "bg-ink-900 text-fg-dim" };
const statusLabel = { invited: "Invite sent", active: "Active", disabled: "Switched off" };

/** Staff list with invite, role changes, resend invite and switch off/on. */
export function TeamManager({ members, meId, isSuperAdmin }: { members: Member[]; meId: string; isSuperAdmin: boolean }) {
  const [inviting, setInviting] = useState(false);
  const [result, setResult] = useState<TeamResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  const canManage = (m: Member) => m.id !== meId && !m.isSuperAdmin && (m.role !== "admin" || isSuperAdmin);

  function run(key: string, action: () => Promise<TeamResult>) {
    setBusy(key);
    setResult(null);
    start(async () => {
      setResult(await action());
      setBusy(null);
    });
  }

  return (
    <div className="p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-fg-muted">
          Invited people get an email to set their own password. {isSuperAdmin ? "As super admin you can also add and manage admins." : "Only the super admin can add or change admins."}
        </p>
        <button type="button" onClick={() => setInviting(true)} className={primaryButton}>
          <Plus className="size-4" aria-hidden /> Invite someone
        </button>
      </div>
      {result && (
        <div className="mb-4">
          <FormAlert tone={result.ok ? "success" : "error"}>{result.ok ? result.message : result.error}</FormAlert>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[820px] whitespace-nowrap text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-ink-950 text-xs text-fg-dim">
              {["Name", "Role", "Status", "Last sign-in", ""].map((c) => (
                <th key={c} scope="col" className="px-4 py-2.5 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3">
                  <span className="block font-medium text-fg">
                    {`${m.firstName} ${m.lastName}`.trim()}
                    {m.id === meId && <span className="ml-1.5 text-xs font-normal text-fg-dim">(you)</span>}
                  </span>
                  <span className="block text-xs text-fg-dim">{m.email}</span>
                </td>
                <td className="px-4 py-3">
                  {canManage(m) ? (
                    <select
                      value={m.role}
                      aria-label={`Role for ${m.firstName}`}
                      disabled={busy !== null}
                      onChange={(e) => run(`role-${m.id}`, () => changeRoleAction(m.id, e.target.value))}
                      className="h-8 rounded-lg border border-line-strong bg-ink-850 px-2 text-sm"
                    >
                      {(Object.keys(roleLabel) as Member["role"][])
                        .filter((r) => r !== "admin" || isSuperAdmin)
                        .map((r) => (
                          <option key={r} value={r}>
                            {roleLabel[r]}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <span className="text-fg">
                      {m.isSuperAdmin ? "Super admin" : roleLabel[m.role]}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[m.status]}`}>{statusLabel[m.status]}</span>
                </td>
                <td className="px-4 py-3 text-fg-muted">{m.lastLogin ?? "Never"}</td>
                <td className="px-4 py-3 text-right">
                  {canManage(m) && (
                    <span className="inline-flex gap-1.5">
                      {m.status === "invited" && (
                        <button type="button" onClick={() => run(`resend-${m.id}`, () => resendInviteAction(m.id))} disabled={busy !== null} className={small}>
                          {busy === `resend-${m.id}` ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : <Mail className="size-3.5" aria-hidden />} Resend invite
                        </button>
                      )}
                      {m.status === "disabled" ? (
                        <button type="button" onClick={() => run(`on-${m.id}`, () => setDisabledAction(m.id, false))} disabled={busy !== null} className={small}>
                          Switch on
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => confirm(`Switch off ${m.firstName}'s account? They'll be signed out and can't sign in.`) && run(`off-${m.id}`, () => setDisabledAction(m.id, true))}
                          disabled={busy !== null}
                          className={`${small} text-red-700 hover:bg-red-50`}
                        >
                          Switch off
                        </button>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inviting && (
        <InviteDialog
          isSuperAdmin={isSuperAdmin}
          onClose={() => setInviting(false)}
          onDone={(r) => {
            setInviting(false);
            setResult(r);
          }}
        />
      )}
    </div>
  );
}

const small = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-ink-850 px-2.5 text-xs font-medium text-fg hover:bg-ink-900 disabled:opacity-50";

function InviteDialog({ isSuperAdmin, onClose, onDone }: { isSuperAdmin: boolean; onClose: () => void; onDone: (r: TeamResult) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [v, setV] = useState({ firstName: "", lastName: "", email: "", phone: "", role: "ecommerce_staff" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    // No cleanup: unmounting removes the dialog, and calling close() would fire onClose.
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  function send() {
    setError(null);
    start(async () => {
      const res = await inviteStaffAction(v);
      if (res.ok) onDone(res);
      else {
        setErrors(res.fieldErrors ?? {});
        setError(res.error);
      }
    });
  }

  const roles = [
    { value: "ecommerce_staff", label: "E-commerce staff: orders, payments, shipping" },
    { value: "engineer", label: "Service engineer: repair jobs" },
    ...(isSuperAdmin ? [{ value: "admin", label: "Admin: everything except managing admins" }] : []),
  ];

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="invite-title"
      className="m-auto w-[min(520px,calc(100vw-2rem))] rounded-2xl border border-line bg-ink-850 p-0 text-fg shadow-2xl backdrop:bg-[rgb(28_25_56/0.4)] backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id="invite-title" className="text-base font-semibold">
          Invite someone to the team
        </h2>
        <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-fg-muted hover:bg-ink-900 hover:text-fg" aria-label="Close">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="grid gap-4 px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="First name" value={v.firstName} error={errors.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} />
          <TextField label="Last name" optional value={v.lastName} error={errors.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} />
        </div>
        <TextField label="Work email" type="email" value={v.email} error={errors.email} onChange={(e) => setV({ ...v, email: e.target.value })} hint="The invitation goes here." />
        <TextField label="Mobile" prefix="+91" inputMode="numeric" maxLength={11} value={v.phone} error={errors.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
        <SelectField label="Role" options={roles} value={v.role} error={errors.role} onChange={(e) => setV({ ...v, role: e.target.value })} />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <button type="button" onClick={onClose} className={outlineButton}>
          Cancel
        </button>
        <button type="button" onClick={send} disabled={pending} className={`${primaryButton} disabled:opacity-80`}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {pending ? "Sending…" : "Send invitation"}
        </button>
      </div>
    </dialog>
  );
}
