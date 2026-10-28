"use server";

import { refresh, updateTag } from "next/cache";
import type { ActionResult } from "@/lib/admin/result";
import { attempt } from "@/lib/server/admin/attempt";
import { adjustStock, type AdjustmentInput } from "@/lib/server/admin/inventory";
import { CATALOGUE_TAG } from "@/lib/server/catalogue";
import { requirePermission } from "@/lib/server/permissions";

export async function adjustStockAction(input: AdjustmentInput): Promise<ActionResult> {
  const admin = await requirePermission("inventory.adjust");
  const res = await attempt(async () => {
    const r = await adjustStock(admin.id, input);
    return `Stock ${r.delta > 0 ? "increased" : "reduced"} by ${Math.abs(r.delta)}. Now ${r.stockAfter}.`;
  });
  if (res.ok) {
    // The store shows "only N left" and blocks out-of-stock items.
    updateTag(CATALOGUE_TAG);
    refresh();
  }
  return res;
}
