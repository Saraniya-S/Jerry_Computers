import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteProduct, saveBrand, saveCategory, saveProduct, saveVariant } from "@/lib/server/admin/catalogue";
import { adjustStock } from "@/lib/server/admin/inventory";
import { db, schema } from "@/lib/server/db";
import { makeOrder, makeProduct, makeUser, reset } from "./helpers";

const product = (overrides: Record<string, unknown> = {}) => ({
  name: "Test Laptop",
  slug: "t-test-laptop",
  sku: "T-LAPTOP-1",
  brandId: "",
  subcategoryId: "",
  category: "laptops" as const,
  summary: "A laptop for testing",
  description: "",
  uses: [],
  specs: [],
  images: [],
  price: "54990",
  mrp: "",
  gstRateBp: 1800,
  stock: 5,
  lowStockThreshold: 2,
  isActive: true,
  isFeatured: false,
  codAvailable: false,
  artVariant: 0,
  ...overrides,
});

describe("inventory adjustments", () => {
  let admin: Awaited<ReturnType<typeof makeUser>>;
  beforeEach(async () => {
    await reset();
    admin = await makeUser("admin");
  });

  it("adjusts stock and logs who did it and why", async () => {
    const p = await makeProduct({ stock: 3 });
    const res = await adjustStock(admin.id, { productId: p.id, mode: "add", quantity: 7, reason: "restock", note: "Invoice 42" });
    expect(res.stockAfter).toBe(10);
    const [m] = await db.select().from(schema.inventoryMovements).where(and(eq(schema.inventoryMovements.productId, p.id), eq(schema.inventoryMovements.reason, "restock")));
    expect(m).toMatchObject({ delta: 7, stockAfter: 10, actorId: admin.id, note: "Invoice 42" });
    const logs = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.entityId, p.id));
    expect(logs).toHaveLength(1);
  });

  it("rejects invalid adjustments", async () => {
    const p = await makeProduct({ stock: 3 });
    await expect(adjustStock(admin.id, { productId: p.id, mode: "add", quantity: -5, reason: "correction", note: "Miscount" })).rejects.toThrow(/Only 3/);
    await expect(adjustStock(admin.id, { productId: p.id, mode: "add", quantity: -1, reason: "restock" })).rejects.toThrow(/add stock/);
    await expect(adjustStock(admin.id, { productId: p.id, mode: "add", quantity: 2, reason: "damaged", note: "Dropped" })).rejects.toThrow(/removed/);
    await expect(adjustStock(admin.id, { productId: p.id, mode: "add", quantity: -1, reason: "damaged" })).rejects.toThrow(); // note required
    await expect(adjustStock(admin.id, { productId: p.id, mode: "add", quantity: 1.5, reason: "restock" })).rejects.toThrow();
    await expect(adjustStock(admin.id, { productId: p.id, mode: "set", quantity: 3, reason: "correction", note: "Count" })).rejects.toThrow(/doesn't change/);
    const [after] = await db.select().from(schema.products).where(eq(schema.products.id, p.id));
    expect(after.stock).toBe(3);
  });

  it("detects a stock change made by someone else", async () => {
    const p = await makeProduct({ stock: 3 });
    await adjustStock(admin.id, { productId: p.id, mode: "add", quantity: 1, reason: "restock" });
    await expect(adjustStock(admin.id, { productId: p.id, mode: "set", quantity: 10, reason: "correction", note: "Stocktake", expectedStock: 3 })).rejects.toThrow(/changed to 4/);
  });

  it("serialises concurrent removals so stock never goes negative", async () => {
    const p = await makeProduct({ stock: 5 });
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => adjustStock(admin.id, { productId: p.id, mode: "add", quantity: -1, reason: "damaged", note: "Test" })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    const [after] = await db.select().from(schema.products).where(eq(schema.products.id, p.id));
    expect(after.stock).toBe(0);
  });
});

describe("product management", () => {
  let admin: Awaited<ReturnType<typeof makeUser>>;
  beforeEach(async () => {
    await reset();
    admin = await makeUser("admin");
  });

  it("creates a product with an opening stock movement", async () => {
    const id = await saveProduct(admin.id, null, product());
    const moves = await db.select().from(schema.inventoryMovements).where(eq(schema.inventoryMovements.productId, id));
    expect(moves).toMatchObject([{ reason: "opening_balance", delta: 5, stockAfter: 5 }]);
  });

  it("rejects duplicate SKUs across products and variants, and invalid prices", async () => {
    const id = await saveProduct(admin.id, null, product());
    await expect(saveProduct(admin.id, null, product({ slug: "t-other", sku: "t-laptop-1" }))).rejects.toMatchObject({ fields: { sku: expect.any(String) } });
    await saveVariant(admin.id, id, null, { sku: "T-LAPTOP-1-16GB", name: "16 GB", attributes: [], price: "", stock: 0, isActive: true });
    await expect(saveProduct(admin.id, null, product({ slug: "t-other", sku: "T-LAPTOP-1-16GB" }))).rejects.toMatchObject({ fields: { sku: expect.any(String) } });
    await expect(saveProduct(admin.id, null, product({ slug: "t-other", sku: "T-OTHER", price: "-5" }))).rejects.toMatchObject({ fields: { price: expect.any(String) } });
    await expect(saveProduct(admin.id, null, product({ slug: "t-other", sku: "T-OTHER", price: "0" }))).rejects.toMatchObject({ fields: { price: expect.any(String) } });
    await expect(saveProduct(admin.id, null, product({ slug: "t-other", sku: "T-OTHER", price: "100", mrp: "50" }))).rejects.toMatchObject({ fields: { mrp: expect.any(String) } });
  });

  it("does not change stock when editing", async () => {
    const id = await saveProduct(admin.id, null, product());
    await saveProduct(admin.id, id, product({ stock: 999, name: "Renamed" }));
    const [p] = await db.select().from(schema.products).where(eq(schema.products.id, id));
    expect(p).toMatchObject({ stock: 5, name: "Renamed" });
  });

  it("protects products that have been ordered", async () => {
    const customer = await makeUser("customer");
    const id = await saveProduct(admin.id, null, product());
    const [p] = await db.select().from(schema.products).where(eq(schema.products.id, id));
    await makeOrder(customer.id, p);
    await expect(deleteProduct(admin.id, id)).rejects.toThrow(/Archive it instead/);
    await expect(saveProduct(admin.id, id, product({ slug: "t-renamed" }))).rejects.toMatchObject({ fields: { slug: expect.stringMatching(/ordered/) } });
  });

  it("deletes a product nobody ordered and whose stock never moved", async () => {
    const id = await saveProduct(admin.id, null, product());
    await deleteProduct(admin.id, id);
    expect(await db.select().from(schema.products).where(eq(schema.products.id, id))).toHaveLength(0);
  });

  it("keeps sub-categories inside their department and brand names in step", async () => {
    const [cctv] = await db.select().from(schema.categories).where(eq(schema.categories.slug, "cctv"));
    const sub = await saveCategory(admin.id, null, { name: "Dome cameras", slug: "", parentId: cctv.id, description: "", isActive: true, sortOrder: 0 });
    await expect(saveProduct(admin.id, null, product({ subcategoryId: sub }))).rejects.toMatchObject({ fields: { subcategoryId: expect.stringMatching(/another department/) } });
    const brand = await saveBrand(admin.id, null, { name: "Lenovo", isActive: true });
    const id = await saveProduct(admin.id, null, product({ brandId: brand }));
    await saveBrand(admin.id, brand, { name: "Lenovo India", isActive: true });
    const [p] = await db.select().from(schema.products).where(eq(schema.products.id, id));
    expect(p.brand).toBe("Lenovo India");
  });
});
