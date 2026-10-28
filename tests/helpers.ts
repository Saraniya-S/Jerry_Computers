import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/server/db";
import type { UserRole } from "@/lib/server/db/schema";

/** Empties everything tests create. Products seeded by the migrations stay; tests make their own. */
export async function reset() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local client_min_messages = warning`);
    await tx.execute(sql`truncate users, audit_logs restart identity cascade`);
    await tx.execute(sql`delete from products where sku like 'T-%'`);
    // Not TRUNCATE: that would cascade through products.brand_id and empty the seeded catalogue.
    await tx.execute(sql`delete from brands`);
    await tx.execute(sql`delete from categories where not is_department`);
  });
}

let n = 0;
export async function makeUser(role: UserRole, opts: Partial<typeof schema.users.$inferInsert> = {}) {
  n++;
  const [u] = await db
    .insert(schema.users)
    .values({ role, firstName: `${role}${n}`, lastName: "Test", email: `${role}${n}-${randomUUID().slice(0, 6)}@test.local`, passwordHash: "x", phone: "+91 98765 43210", ...opts })
    .returning();
  if (role === "engineer") await db.insert(schema.engineerProfiles).values({ userId: u.id }).onConflictDoNothing();
  return u;
}

export const actorOf = (u: { id: string; role: UserRole; isSuperAdmin: boolean; firstName: string }) => ({ id: u.id, role: u.role, isSuperAdmin: u.isSuperAdmin, firstName: u.firstName });

export async function makeProduct(opts: Partial<typeof schema.products.$inferInsert> = {}) {
  n++;
  const [p] = await db
    .insert(schema.products)
    .values({ slug: `t-product-${n}-${randomUUID().slice(0, 6)}`, sku: `T-${n}-${randomUUID().slice(0, 6).toUpperCase()}`, name: `Test product ${n}`, category: "laptops", summary: "A test product", pricePaise: 100_00, stock: 10, ...opts })
    .returning();
  return p;
}

/** An order straight in the database (bypassing the cart), with its stock already taken. */
export async function makeOrder(customerId: string, product: { slug: string; name: string; pricePaise: number | null }, opts: Partial<typeof schema.orders.$inferInsert> = {}) {
  const total = product.pricePaise! * 1;
  const [o] = await db
    .insert(schema.orders)
    .values({
      userId: customerId,
      paymentMethod: "cod",
      itemsTotalPaise: total,
      totalPaise: total,
      shippingAddress: { label: "Home", recipientName: "Test", phone: "+91 98765 43210", line1: "1 Test Street", line2: null, landmark: null, city: "Chennai", state: "Tamil Nadu", postalCode: "600001" },
      ...opts,
    })
    .returning();
  await db.insert(schema.orderItems).values({ orderId: o.id, productSlug: product.slug, productName: product.name, categoryLabel: "Laptops", quantity: 1, unitPricePaise: product.pricePaise!, gstRateBp: 1800 });
  return o;
}

export const walkIn = (overrides: Record<string, unknown> = {}) => ({
  customerId: "",
  contact: { firstName: "Walk", lastName: "In", phone: "9876543210", email: "" },
  source: "walk_in" as const,
  location: "in_shop" as const,
  deviceType: "laptop" as const,
  deviceBrand: "",
  deviceModel: "",
  serialNumber: "",
  accessories: "",
  issue: "Does not power on",
  priority: "normal" as const,
  ...overrides,
});
