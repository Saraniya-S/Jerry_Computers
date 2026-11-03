"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/admin/result";
import { attempt } from "@/lib/server/admin/attempt";
import { decideLeave } from "@/lib/server/engineer/leave";
import { requirePermission } from "@/lib/server/permissions";

export async function decideLeaveAction(leaveId: string, approve: boolean, note: string): Promise<ActionResult> {
  const admin = await requirePermission("service.manage");
  const res = await attempt(async () => {
    await decideLeave(admin.id, z.string().uuid().parse(leaveId), approve, note);
    return approve ? "Leave approved. The engineer has been told." : "Leave rejected. The engineer has been told why.";
  });
  if (res.ok) refresh();
  return res;
}
