"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/admin/result";
import { attempt } from "@/lib/server/admin/attempt";
import { addServiceNote, changeServiceStatus, requestTransfer, setSchedule, withdrawTransfer } from "@/lib/server/admin/service-requests";
import { requireStaff } from "@/lib/server/auth";
import type { ServiceNoteKind, ServiceStatus } from "@/lib/server/db/schema";

/**
 * Engineer actions. Each one re-checks the session; the service-desk module then checks that the
 * job is assigned to this engineer and that the move is allowed. Engineers can't assign jobs.
 */
const requireEngineer = () => requireStaff(["engineer"]);
const id = z.string().uuid();

export async function engineerStatusAction(requestId: string, to: ServiceStatus, note: string): Promise<ActionResult> {
  const me = await requireEngineer();
  const res = await attempt(async () => {
    await changeServiceStatus(me, { requestId: id.parse(requestId), to, note });
    return to === "unable_to_complete" ? "Handed back to the admin team with your note." : "Job updated.";
  });
  if (res.ok) refresh();
  return res;
}

export async function engineerNoteAction(requestId: string, kind: ServiceNoteKind, note: string): Promise<ActionResult> {
  const me = await requireEngineer();
  const res = await attempt(async () => {
    await addServiceNote(me, { requestId: id.parse(requestId), kind, note });
    return "Added to the job report.";
  });
  if (res.ok) refresh();
  return res;
}

export async function engineerScheduleAction(requestId: string, scheduledAt: string | null, note: string): Promise<ActionResult> {
  const me = await requireEngineer();
  const res = await attempt(async () => {
    // datetime-local values are shop time.
    const when = scheduledAt ? new Date(`${z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time.").parse(scheduledAt)}:00+05:30`) : null;
    await setSchedule(me, { requestId: id.parse(requestId), scheduledAt: when, note });
    return when ? "Visit scheduled." : "Schedule cleared.";
  });
  if (res.ok) refresh();
  return res;
}

export async function requestTransferAction(requestId: string, toEngineerId: string, reason: string): Promise<ActionResult> {
  const me = await requireEngineer();
  const res = await attempt(async () => {
    await requestTransfer(me.id, id.parse(requestId), id.parse(toEngineerId), reason);
    return "Transfer requested. The job stays with you until an admin approves it.";
  });
  if (res.ok) refresh();
  return res;
}

export async function withdrawTransferAction(transferId: string): Promise<ActionResult> {
  const me = await requireEngineer();
  const res = await attempt(async () => {
    await withdrawTransfer(me.id, id.parse(transferId));
    return "Transfer request withdrawn.";
  });
  if (res.ok) refresh();
  return res;
}
