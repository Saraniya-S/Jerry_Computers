"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { updatePreferences } from "@/app/account/actions";
import { FormAlert } from "@/components/auth/ui";
import { ChipGroup, Segmented, TextField, ToggleCard } from "@/components/forms/controls";
import { productCategories, type ProductCategoryId } from "@/data/products";
import { primaryButton } from "./buttons";

type Prefs = {
  customerType: "personal" | "business";
  companyName: string;
  gstin: string;
  whatsappUpdates: boolean;
  interests: ProductCategoryId[];
};

export function PreferencesForm({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setMessage(null);
    start(async () => {
      const res = await updatePreferences(prefs);
      if (res.ok) {
        setErrors({});
        setMessage(res.message);
      } else setErrors(res.fieldErrors ?? {});
    });
  }

  return (
    <div className="grid max-w-xl gap-5">
      <Segmented
        label="Buying for"
        value={prefs.customerType}
        onChange={(customerType) => setPrefs({ ...prefs, customerType })}
        options={[
          { value: "personal", label: "Personal", description: "Home or study" },
          { value: "business", label: "Business", description: "GST invoices" },
        ]}
      />
      {prefs.customerType === "business" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Company name"
            autoComplete="organization"
            value={prefs.companyName}
            onChange={(e) => setPrefs({ ...prefs, companyName: e.target.value })}
            error={errors.companyName}
          />
          <TextField
            label="GSTIN"
            optional
            maxLength={15}
            value={prefs.gstin}
            onChange={(e) => setPrefs({ ...prefs, gstin: e.target.value.toUpperCase() })}
            error={errors.gstin}
          />
        </div>
      )}
      <ChipGroup
        label="Interests"
        hint="We'll highlight these in the shop."
        options={productCategories.map((c) => ({ value: c.id, label: c.label }))}
        value={prefs.interests}
        onChange={(interests) => setPrefs({ ...prefs, interests })}
      />
      <ToggleCard
        title="WhatsApp updates"
        description="Repair progress and delivery updates on WhatsApp."
        checked={prefs.whatsappUpdates}
        onChange={(whatsappUpdates) => setPrefs({ ...prefs, whatsappUpdates })}
      />
      {message && <FormAlert tone="success">{message}</FormAlert>}
      <div>
        <button type="button" onClick={save} disabled={pending} className={`${primaryButton} disabled:opacity-80`}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {pending ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </div>
  );
}
