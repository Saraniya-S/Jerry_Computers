import "server-only";
import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import type { z } from "zod";
import { homeSchema, shopSchema, storeSchema } from "@/lib/settings";
import { db, schema } from "./db";

export const SETTINGS_TAG = "settings";

const schemas = { shop: shopSchema, store: storeSchema, home: homeSchema } as const;
type Key = keyof typeof schemas;

/** A settings document with defaults filled in. Cached; saving calls updateTag(SETTINGS_TAG). */
export async function getSettings<K extends Key>(key: K): Promise<z.infer<(typeof schemas)[K]>> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife("hours");
  const [row] = await db.select().from(schema.siteSettings).where(eq(schema.siteSettings.key, key));
  const parsed = schemas[key].safeParse(row?.value ?? {});
  return (parsed.success ? parsed.data : schemas[key].parse({})) as z.infer<(typeof schemas)[K]>;
}

export async function saveSettings(key: Key | string, value: unknown, userId: string) {
  await db
    .insert(schema.siteSettings)
    .values({ key, value, updatedById: userId })
    .onConflictDoUpdate({ target: schema.siteSettings.key, set: { value, updatedById: userId, updatedAt: new Date() } });
}
