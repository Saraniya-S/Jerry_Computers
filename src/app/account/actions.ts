"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCustomer } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { deleteSession } from "@/lib/server/session";
import type { FormState } from "@/app/(auth)/actions";

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(60),
  lastName: z.string().trim().max(60),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === "" || /^\+?[\d\s()-]{7,20}$/.test(v), "Enter a valid phone number."),
});

export async function updateProfile(_: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireCustomer();
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors, values: raw };
  }
  const { firstName, lastName, phone } = parsed.data;
  await db
    .update(schema.users)
    .set({ firstName, lastName, phone: phone || null })
    .where(eq(schema.users.id, viewer.id));
  refresh();
  return { message: "Profile saved.", values: { firstName, lastName, phone } };
}

/** Ends every session for this account, including this one. */
export async function signOutEverywhere() {
  const viewer = await requireCustomer();
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, viewer.id));
  await deleteSession();
  redirect("/login");
}
