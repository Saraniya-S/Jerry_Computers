"use client";

import { addressLabels, indianStates } from "@/lib/customer";
import { SelectField, TextField } from "./controls";

export type AddressDraft = {
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  postalCode: string;
};

export const emptyAddress = (recipientName = "", phone = ""): AddressDraft => ({
  label: "Home",
  recipientName,
  phone,
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
  postalCode: "",
});

/** The address form body, controlled by its parent. */
export function AddressFields({
  value,
  onChange,
  errors = {},
}: {
  value: AddressDraft;
  onChange: (next: AddressDraft) => void;
  errors?: Partial<Record<keyof AddressDraft, string>>;
}) {
  const set = (k: keyof AddressDraft) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <SelectField label="Label" options={addressLabels} value={value.label} onChange={set("label")} error={errors.label} />
        <TextField label="Recipient name" autoComplete="name" value={value.recipientName} onChange={set("recipientName")} error={errors.recipientName} />
      </div>
      <TextField
        label="Mobile for this address"
        prefix="+91"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={11}
        value={value.phone}
        onChange={set("phone")}
        error={errors.phone}
        hint="Couriers and engineers call this number."
      />
      <TextField
        label="House, building and street"
        autoComplete="address-line1"
        value={value.line1}
        onChange={set("line1")}
        error={errors.line1}
      />
      <TextField label="Area or locality" optional autoComplete="address-line2" value={value.line2} onChange={set("line2")} error={errors.line2} />
      <TextField label="Landmark" optional value={value.landmark} onChange={set("landmark")} error={errors.landmark} hint="Helps engineers find you on site visits." />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="City or town" autoComplete="address-level2" value={value.city} onChange={set("city")} error={errors.city} />
        <TextField
          label="PIN code"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          value={value.postalCode}
          onChange={(e) => onChange({ ...value, postalCode: e.target.value.replace(/\D/g, "") })}
          error={errors.postalCode}
        />
      </div>
      <SelectField label="State" options={indianStates} placeholder="Choose a state" value={value.state} onChange={set("state")} error={errors.state} />
    </div>
  );
}
