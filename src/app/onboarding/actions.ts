"use server";

import { eq } from "drizzle-orm";
import { addressSchema, contactSchema, fieldErrors, preferencesSchema } from "@/lib/customer";
import { requireCustomer } from "@/lib/server/auth";
import { saveAddress } from "@/lib/server/customer";
import { db, schema } from "@/lib/server/db";

export type OnboardingResult = { ok: true } | { ok: false; step: "contact" | "address" | "preferences"; fieldErrors: Record<string, string> };

/** Saves everything from the welcome steps at once and marks the customer as onboarded. */
export async function completeOnboarding(input: { contact: unknown; address: unknown; preferences: unknown }): Promise<OnboardingResult> {
  const viewer = await requireCustomer();

  const contact = contactSchema.safeParse(input.contact);
  if (!contact.success) return { ok: false, step: "contact", fieldErrors: fieldErrors(contact.error) };
  const address = addressSchema.safeParse(input.address);
  if (!address.success) return { ok: false, step: "address", fieldErrors: fieldErrors(address.error) };
  const prefs = preferencesSchema.safeParse(input.preferences);
  if (!prefs.success) return { ok: false, step: "preferences", fieldErrors: fieldErrors(prefs.error) };

  await db
    .update(schema.users)
    .set({
      ...contact.data,
      ...prefs.data,
      companyName: prefs.data.customerType === "business" ? prefs.data.companyName : null,
      gstin: prefs.data.customerType === "business" ? prefs.data.gstin : null,
      onboardedAt: viewer.onboardedAt ?? new Date(),
    })
    .where(eq(schema.users.id, viewer.id));
  await saveAddress(viewer.id, address.data, { makeDefault: true });
  return { ok: true };
}
