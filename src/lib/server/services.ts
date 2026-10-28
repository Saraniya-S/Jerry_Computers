import "server-only";
import { asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { serviceVisuals, type Service, type ServiceId } from "@/data/services";
import { db, schema } from "./db";

export const SERVICES_TAG = "services";

/** Active services in display order. Cached; admin edits call updateTag(SERVICES_TAG). */
export async function getServices(): Promise<Service[]> {
  "use cache";
  cacheTag(SERVICES_TAG);
  cacheLife("hours");
  const rows = await db
    .select()
    .from(schema.services)
    .where(eq(schema.services.isActive, true))
    .orderBy(asc(schema.services.sortOrder), asc(schema.services.title));
  return rows.map((r, i) => ({
    id: r.id,
    slug: r.slug,
    index: String(i + 1).padStart(2, "0"),
    label: r.label,
    title: r.title,
    description: r.description,
    includes: r.includes,
    visual: (serviceVisuals.some((v) => v.id === r.visual) ? r.visual : "diagnostics") as ServiceId,
  }));
}

export async function getServiceBySlug(slug: string) {
  return (await getServices()).find((s) => s.slug === slug) ?? null;
}
