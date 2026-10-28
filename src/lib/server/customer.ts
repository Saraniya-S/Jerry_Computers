import "server-only";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import type { AddressInput } from "@/lib/customer";
import { db, schema } from "./db";

export const MAX_ADDRESSES = 10;

export async function listAddresses(userId: string) {
  return db
    .select()
    .from(schema.addresses)
    .where(eq(schema.addresses.userId, userId))
    .orderBy(desc(schema.addresses.isDefault), asc(schema.addresses.createdAt));
}

/** Creates or updates an address. The first address, or one marked default, becomes the default. */
export async function saveAddress(userId: string, input: AddressInput, opts: { id?: string; makeDefault?: boolean } = {}) {
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: schema.addresses.id, isDefault: schema.addresses.isDefault }).from(schema.addresses).where(eq(schema.addresses.userId, userId));
    if (opts.id && !existing.some((a) => a.id === opts.id)) throw new Error("Address not found");
    if (!opts.id && existing.length >= MAX_ADDRESSES) throw new Error(`You can save up to ${MAX_ADDRESSES} addresses.`);

    const makeDefault = opts.makeDefault || existing.length === 0 || (opts.id !== undefined && existing.find((a) => a.id === opts.id)?.isDefault);
    if (makeDefault) {
      await tx
        .update(schema.addresses)
        .set({ isDefault: false })
        .where(and(eq(schema.addresses.userId, userId), opts.id ? ne(schema.addresses.id, opts.id) : undefined));
    }

    if (opts.id) {
      const [row] = await tx
        .update(schema.addresses)
        .set({ ...input, isDefault: Boolean(makeDefault) })
        .where(and(eq(schema.addresses.id, opts.id), eq(schema.addresses.userId, userId)))
        .returning();
      return row;
    }
    const [row] = await tx
      .insert(schema.addresses)
      .values({ ...input, userId, isDefault: Boolean(makeDefault) })
      .returning();
    return row;
  });
}

export async function deleteAddress(userId: string, id: string) {
  await db.transaction(async (tx) => {
    const [gone] = await tx
      .delete(schema.addresses)
      .where(and(eq(schema.addresses.id, id), eq(schema.addresses.userId, userId)))
      .returning({ isDefault: schema.addresses.isDefault });
    // Keep a default when one remains.
    if (gone?.isDefault) {
      const [next] = await tx
        .select({ id: schema.addresses.id })
        .from(schema.addresses)
        .where(eq(schema.addresses.userId, userId))
        .orderBy(asc(schema.addresses.createdAt))
        .limit(1);
      if (next) await tx.update(schema.addresses).set({ isDefault: true }).where(eq(schema.addresses.id, next.id));
    }
  });
}

export async function setDefaultAddress(userId: string, id: string) {
  await db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: schema.addresses.id })
      .from(schema.addresses)
      .where(and(eq(schema.addresses.id, id), eq(schema.addresses.userId, userId)));
    if (!owned) return;
    await tx.update(schema.addresses).set({ isDefault: false }).where(eq(schema.addresses.userId, userId));
    await tx.update(schema.addresses).set({ isDefault: true }).where(eq(schema.addresses.id, id));
  });
}
