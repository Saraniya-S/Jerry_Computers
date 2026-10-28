"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/admin/result";
import { attempt } from "@/lib/server/admin/attempt";
import { addServiceNote, changeServiceStatus, requestTransfer, withdrawTransfer } from "@/lib/server/admin/service-requests";
import { requireStaff } from "@/lib/server/auth";
import type { ServiceStatus } from "@/lib/server/db/schema";

const id = z.string().uuid();

/** Engineers move their own jobs along (the business module checks ownership and the allowed steps). */
export async function engineerStatusAction(requestId: string, to: ServiceStatus, note: string): Promise<ActionResult> {
  const me = await requireStaff(["engineer"]);
  const res = await attempt(async () => {
    await changeServiceStatus(me, { requestId: id.parse(requestId), to, note });
    return "Job updated.";
  });
  if (res.ok) refresh();
  return res;
}

export async function engineerNoteAction(requestId: string, note: string): Promise<ActionResult> {
  const me = await requireStaff(["engineer"]);
  const res = await attempt(async () => {
    await addServiceNote(me, id.parse(requestId), note);
    return "Note added.";
  });
  if (res.ok) refresh();
  return res;
}

export async function requestTransferAction(requestId: string, toEngineerId: string, reason: string): Promise<ActionResult> {
  const me = await requireStaff(["engineer"]);
  const res = await attempt(async () => {
    await requestTransfer(me.id, id.parse(requestId), id.parse(toEngineerId), reason);
    return "Transfer requested. The job stays with you until an admin approves it.";
  });
  if (res.ok) refresh();
  return res;
}

export async function withdrawTransferAction(transferId: string): Promise<ActionResult> {
  const me = await requireStaff(["engineer"]);
  const res = await attempt(async () => {
    await withdrawTransfer(me.id, id.parse(transferId));
    return "Transfer request withdrawn.";
  });
  if (res.ok) refresh();
  return res;
}
