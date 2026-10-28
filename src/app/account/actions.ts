"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/(auth)/actions";
import { addressSchema, contactSchema, fieldErrors, preferencesSchema } from "@/lib/customer";
import { requireCustomer } from "@/lib/server/auth";
import { deleteAddress, saveAddress, setDefaultAddress } from "@/lib/server/customer";
import { db, schema } from "@/lib/server/db";
import { deleteSession } from "@/lib/server/session";

export async function updateProfile(_: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireCustomer();
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: raw };
  await db.update(schema.users).set(parsed.data).where(eq(schema.users.id, viewer.id));
  refresh();
  return { message: "Contact details saved.", values: raw };
}

export type SettingsResult = { ok: true; message: string } | { ok: false; error?: string; fieldErrors?: Record<string, string> };

export async function updatePreferences(input: unknown): Promise<SettingsResult> {
  const viewer = await requireCustomer();
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const p = parsed.data;
  await db
    .update(schema.users)
    .set({
      ...p,
      companyName: p.customerType === "business" ? p.companyName : null,
      gstin: p.customerType === "business" ? p.gstin : null,
    })
    .where(eq(schema.users.id, viewer.id));
  refresh();
  return { ok: true, message: "Preferences saved." };
}

const id = z.string().uuid();

export async function saveAddressAction(input: { id?: string; makeDefault?: boolean; address: unknown }): Promise<SettingsResult> {
  const viewer = await requireCustomer();
  const parsed = addressSchema.safeParse(input.address);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  try {
    await saveAddress(viewer.id, parsed.data, { id: input.id ? id.parse(input.id) : undefined, makeDefault: Boolean(input.makeDefault) });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save the address." };
  }
  refresh();
  return { ok: true, message: input.id ? "Address updated." : "Address added." };
}

export async function deleteAddressAction(addressId: string): Promise<SettingsResult> {
  const viewer = await requireCustomer();
  await deleteAddress(viewer.id, id.parse(addressId));
  refresh();
  return { ok: true, message: "Address removed." };
}

export async function setDefaultAddressAction(addressId: string): Promise<SettingsResult> {
  const viewer = await requireCustomer();
  await setDefaultAddress(viewer.id, id.parse(addressId));
  refresh();
  return { ok: true, message: "Default address changed." };
}

/** Ends every session for this account, including this one. */
export async function signOutEverywhere() {
  const viewer = await requireCustomer();
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, viewer.id));
  await deleteSession();
  redirect("/login");
}
