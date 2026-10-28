"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/account/actions";
import type { FormState } from "@/app/(auth)/actions";
import { FormAlert } from "@/components/auth/ui";
import { TextField } from "@/components/forms/controls";
import { SaveButton } from "./SaveButton";

export function ProfileForm({ firstName, lastName, phone }: { firstName: string; lastName: string; phone: string }) {
  const [state, action] = useActionState<FormState, FormData>(updateProfile, {});
  const v = state.values ?? { firstName, lastName, phone };
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate className="grid max-w-xl gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="First name" name="firstName" autoComplete="given-name" defaultValue={v.firstName} error={fe.firstName} />
        <TextField label="Last name" name="lastName" optional autoComplete="family-name" defaultValue={v.lastName} error={fe.lastName} />
      </div>
      <TextField
        label="Mobile number"
        name="phone"
        prefix="+91"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={11}
        defaultValue={v.phone}
        error={fe.phone}
        hint="For service updates and on-site visit calls."
      />
      {state.message && <FormAlert tone="success">{state.message}</FormAlert>}
      <div>
        <SaveButton />
      </div>
    </form>
  );
}
