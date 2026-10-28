"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";
import { emailPasswordResetAction, updateMyProfileAction } from "@/lib/actions/profile";
import { ResultAlert, smallButton, smallPrimary, Spinner, useAdminAction } from "@/components/admin/actions-ui";
import { TextField } from "@/components/forms/controls";

export function ContactDetailsForm({ initial }: { initial: { firstName: string; lastName: string; phone: string } }) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy, result } = useAdminAction();
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run("save", () => updateMyProfileAction(v), (r) => setErrors(r.ok ? {} : (r.fieldErrors ?? {})));
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="First name" value={v.firstName} error={errors.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} />
        <TextField label="Last name" optional value={v.lastName} error={errors.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} />
      </div>
      <TextField label="Mobile" prefix="+91" inputMode="tel" value={v.phone} error={errors.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} hint="Customers and the shop use this to reach you." />
      {result && <ResultAlert result={result} />}
      <button type="submit" disabled={busy !== null} className={`${smallPrimary} w-fit`}>
        {busy && <Spinner />} Save profile
      </button>
    </form>
  );
}

export function PasswordReset() {
  const { run, busy, result } = useAdminAction();
  return (
    <div className="grid gap-3">
      {result && <ResultAlert result={result} />}
      <button type="button" disabled={busy !== null} onClick={() => run("reset", () => emailPasswordResetAction())} className={`${smallButton} w-fit`}>
        {busy ? <Spinner /> : <KeyRound className="size-4" aria-hidden />} Email me a password link
      </button>
    </div>
  );
}
