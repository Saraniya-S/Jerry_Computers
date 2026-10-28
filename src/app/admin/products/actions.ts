"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ProductInput, VariantInput } from "@/lib/admin/product";
import type { ActionResult } from "@/lib/admin/result";
import { attempt } from "@/lib/server/admin/attempt";
import { deleteProduct, deleteVariant, saveProduct, saveVariant, setProductArchived } from "@/lib/server/admin/catalogue";
import { CATALOGUE_TAG } from "@/lib/server/catalogue";
import { requirePermission } from "@/lib/server/permissions";

export type ProductResult = ActionResult;

const id = z.string().uuid();

/** Creates or updates a product. Admins only. */
export async function saveProductAction(productId: string | null, input: ProductInput): Promise<ProductResult> {
  const admin = await requirePermission("catalogue.manage");
  let savedId = "";
  const res = await attempt(async () => {
    savedId = await saveProduct(admin.id, productId ? id.parse(productId) : null, input);
    return "Product saved.";
  });
  if (!res.ok) return res;
  updateTag(CATALOGUE_TAG);
  if (!productId) redirect(`/admin/products/${savedId}?created=1`);
  refresh();
  return res;
}

export async function setArchivedAction(productId: string, archived: boolean): Promise<ActionResult> {
  const admin = await requirePermission("catalogue.manage");
  const res = await attempt(async () => {
    await setProductArchived(admin.id, id.parse(productId), archived);
    return archived ? "Archived. It's hidden from the store and the default product list." : "Restored. Switch on “Show in the store” when it's ready to sell.";
  });
  if (res.ok) {
    updateTag(CATALOGUE_TAG);
    refresh();
  }
  return res;
}

/** Deletes a product that was never sold and whose stock never moved; otherwise explains why not. */
export async function deleteProductAction(productId: string): Promise<ActionResult> {
  const admin = await requirePermission("catalogue.manage");
  const res = await attempt(async () => {
    await deleteProduct(admin.id, id.parse(productId));
    return "Deleted.";
  });
  if (!res.ok) return res;
  updateTag(CATALOGUE_TAG);
  redirect("/admin/products");
}

export async function saveVariantAction(productId: string, variantId: string | null, input: VariantInput): Promise<ActionResult> {
  const admin = await requirePermission("catalogue.manage");
  const res = await attempt(async () => {
    await saveVariant(admin.id, id.parse(productId), variantId ? id.parse(variantId) : null, input);
    return variantId ? "Variant saved." : "Variant added.";
  });
  if (res.ok) refresh();
  return res;
}

export async function deleteVariantAction(productId: string, variantId: string): Promise<ActionResult> {
  const admin = await requirePermission("catalogue.manage");
  const res = await attempt(async () => {
    await deleteVariant(admin.id, id.parse(productId), id.parse(variantId));
    return "Variant deleted.";
  });
  if (res.ok) refresh();
  return res;
}
