import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "../db";

/** Brands and sub-categories for the product form. */
export async function productFormOptions() {
  const parent = alias(schema.categories, "parent");
  const [brands, subcategories] = await Promise.all([
    db.select({ id: schema.brands.id, name: schema.brands.name, isActive: schema.brands.isActive }).from(schema.brands).orderBy(asc(schema.brands.name)),
    db
      .select({ id: schema.categories.id, name: schema.categories.name, department: parent.slug })
      .from(schema.categories)
      .innerJoin(parent, eq(parent.id, schema.categories.parentId))
      .where(eq(schema.categories.isActive, true))
      .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name)),
  ]);
  return { brands, subcategories };
}
