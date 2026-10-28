"use server";

import { and, asc, eq, ne } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { serviceVisuals, type ServiceId } from "@/data/services";
import { fieldErrors } from "@/lib/customer";
import { requireStaff } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { SERVICES_TAG } from "@/lib/server/services";

export type ServiceResult = { ok: true; message: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const serviceInput = z.object({
  label: z.string().trim().min(2, "Enter a short name.").max(30),
  title: z.string().trim().min(4, "Enter the full title.").max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes.")
    .max(80),
  description: z.string().trim().min(10, "Describe the service in a sentence.").max(300),
  includes: z
    .array(z.string().trim().max(80))
    .max(12)
    .transform((a) => a.filter(Boolean)),
  visual: z.enum(serviceVisuals.map((v) => v.id) as [ServiceId, ...ServiceId[]]),
  isActive: z.boolean(),
});
export type ServiceInput = z.input<typeof serviceInput>;

function done(message: string): ServiceResult {
  updateTag(SERVICES_TAG);
  refresh();
  return { ok: true, message };
}

export async function saveServiceAction(id: string | null, input: ServiceInput): Promise<ServiceResult> {
  await requireStaff(["admin"]);
  const parsed = serviceInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const serviceId = id ? z.string().uuid().parse(id) : null;
  const [clash] = await db
    .select({ id: schema.services.id })
    .from(schema.services)
    .where(serviceId ? and(eq(schema.services.slug, v.slug), ne(schema.services.id, serviceId)) : eq(schema.services.slug, v.slug));
  if (clash) return { ok: false, error: "Check the highlighted fields.", fieldErrors: { slug: "Another service already uses this address." } };

  if (serviceId) {
    await db.update(schema.services).set(v).where(eq(schema.services.id, serviceId));
    return done(`${v.label} saved.`);
  }
  const all = await db.select({ sortOrder: schema.services.sortOrder }).from(schema.services);
  await db.insert(schema.services).values({ ...v, sortOrder: Math.max(-1, ...all.map((s) => s.sortOrder)) + 1 });
  return done(`${v.label} added.`);
}

/** Swaps a service with its neighbour in the display order. */
export async function moveServiceAction(id: string, direction: -1 | 1): Promise<ServiceResult> {
  await requireStaff(["admin"]);
  const rows = await db.select({ id: schema.services.id }).from(schema.services).orderBy(asc(schema.services.sortOrder), asc(schema.services.title));
  const i = rows.findIndex((r) => r.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= rows.length) return { ok: false, error: "Can't move further." };
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await db.transaction(async (tx) => {
    for (const [n, r] of rows.entries()) await tx.update(schema.services).set({ sortOrder: n }).where(eq(schema.services.id, r.id));
  });
  return done("Order updated.");
}

export async function deleteServiceAction(id: string): Promise<ServiceResult> {
  await requireStaff(["admin"]);
  await db.delete(schema.services).where(eq(schema.services.id, z.string().uuid().parse(id)));
  return done("Service deleted.");
}
