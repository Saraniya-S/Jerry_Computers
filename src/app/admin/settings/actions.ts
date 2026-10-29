"use server";

import { refresh, updateTag } from "next/cache";
import { fieldErrors } from "@/lib/customer";
import { parseRupees } from "@/lib/money";
import { requireStaff } from "@/lib/server/auth";
import { saveSettings, SETTINGS_TAG } from "@/lib/server/settings";
import { homeSchema, shopSchema, storeSchema } from "@/lib/settings";

export type SettingsResult = { ok: true; message: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function saved(message: string): SettingsResult {
  updateTag(SETTINGS_TAG);
  refresh();
  return { ok: true, message };
}

export async function saveShopAction(input: unknown): Promise<SettingsResult> {
  const me = await requireStaff(["admin"]);
  const parsed = shopSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  await saveSettings("shop", parsed.data, me.id);
  return saved("Shop details saved. They now show on the site and on new invoices.");
}

export async function saveStoreAction(input: { shipping: string; codEnabled: boolean }): Promise<SettingsResult> {
  const me = await requireStaff(["admin"]);
  // Every order carries the delivery charge, so it has to be set.
  const shipping = parseRupees(input.shipping.trim());
  if (!shipping) return { ok: false, error: "Check the highlighted fields.", fieldErrors: { shipping: "Enter the delivery charge in rupees; it's added to every order." } };
  const parsed = storeSchema.safeParse({ shippingPaise: shipping, codEnabled: input.codEnabled });
  if (!parsed.success) return { ok: false, error: "Those amounts are out of range." };
  await saveSettings("store", parsed.data, me.id);
  return saved("Checkout settings saved.");
}

export async function saveHomeAction(input: unknown): Promise<SettingsResult> {
  const me = await requireStaff(["admin"]);
  // The schema falls back to the default copy for blank fields when reading; when saving, report them instead.
  const blanks = blankFields(input);
  if (blanks.length) return { ok: false, error: `Fill in: ${blanks.join(", ")}.` };
  const parsed = homeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some text is too long." };
  await saveSettings("home", parsed.data, me.id);
  return saved("Homepage updated.");
}

const fieldNames: Record<string, string> = {
  heroBadge: "hero badge",
  heroEyebrow: "hero tagline",
  heroTitle: "hero headline",
  heroSubtitle: "hero intro",
  aboutTitle: "about headline",
  aboutBody: "about text",
  contactTitle: "contact headline",
  contactBody: "contact text",
};

function blankFields(input: unknown) {
  const v = (input ?? {}) as Record<string, unknown>;
  const out = Object.keys(fieldNames).filter((k) => typeof v[k] !== "string" || !(v[k] as string).trim()).map((k) => fieldNames[k]);
  const pillars = Array.isArray(v.heroPillars) ? v.heroPillars : [];
  if (!pillars.length || pillars.some((p) => typeof p !== "string" || !p.trim())) out.push("hero pillars");
  const reasons = Array.isArray(v.reasons) ? v.reasons : [];
  if (reasons.length !== 4 || reasons.some((r) => !r?.title?.trim() || !r?.body?.trim())) out.push("all four “Why choose us” cards");
  return out;
}
