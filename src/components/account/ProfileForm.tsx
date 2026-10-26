"use client";

import { Phone, UserRound } from "lucide-react";
import { useActionState } from "react";
import { updateProfile } from "@/app/account/actions";
import type { FormState } from "@/app/(auth)/actions";
import { Field, FormAlert } from "@/components/auth/ui";
import { SaveButton } from "./SaveButton";

export function ProfileForm({ firstName, lastName, phone }: { firstName: string; lastName: string; phone: string }) {
  const [state, action] = useActionState<FormState, FormData>(updateProfile, {});
  const v = state.values ?? { firstName, lastName, phone };
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate className="grid max-w-xl gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field icon={UserRound} label="First name" name="firstName" autoComplete="given-name" defaultValue={v.firstName} error={fe.firstName} />
        <Field label="Last name" name="lastName" autoComplete="family-name" defaultValue={v.lastName} error={fe.lastName} />
      </div>
      <Field icon={Phone} label="Phone" name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} error={fe.phone} />
      {state.message && <FormAlert tone="success">{state.message}</FormAlert>}
      <div>
        <SaveButton />
      </div>
    </form>
  );
}
