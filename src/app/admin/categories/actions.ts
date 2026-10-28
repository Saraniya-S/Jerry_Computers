"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { BrandInput, CategoryInput } from "@/lib/admin/product";
import type { ActionResult } from "@/lib/admin/result";
import { attempt } from "@/lib/server/admin/attempt";
import { deleteBrand, deleteCategory, saveBrand, saveCategory } from "@/lib/server/admin/catalogue";
import { requirePermission } from "@/lib/server/permissions";

const id = z.string().uuid();

export async function saveCategoryAction(categoryId: string | null, input: CategoryInput): Promise<ActionResult> {
  const admin = await requirePermission("catalogue.manage");
  const res = await attempt(async () => {
    await saveCategory(admin.id, categoryId ? id.parse(categoryId) : null, input);
    return categoryId ? "Category saved." : "Category added.";
  });
  if (res.ok) refresh();
  return res;
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionResult> {
  const admin = await requirePermission("catalogue.manage");
  const res = await attempt(async () => {
    await deleteCategory(admin.id, id.parse(categoryId));
    return "Category deleted.";
  });
  if (res.ok) refresh();
  return res;
}

export async function saveBrandAction(brandId: string | null, input: BrandInput): Promise<ActionResult> {
  const admin = await requirePermission("catalogue.manage");
  const res = await attempt(async () => {
    await saveBrand(admin.id, brandId ? id.parse(brandId) : null, input);
    return brandId ? "Brand saved. Its products show the new name." : "Brand added.";
  });
  if (res.ok) refresh();
  return res;
}

export async function deleteBrandAction(brandId: string): Promise<ActionResult> {
  const admin = await requirePermission("catalogue.manage");
  const res = await attempt(async () => {
    await deleteBrand(admin.id, id.parse(brandId));
    return "Brand deleted.";
  });
  if (res.ok) refresh();
  return res;
}
