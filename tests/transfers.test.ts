import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { overrideAssignment, createServiceRequest, decideTransfer, requestTransfer } from "@/lib/server/admin/service-requests";
import { setDisabled } from "@/lib/server/admin/users";
import { db, schema } from "@/lib/server/db";
import { actorOf, makeUser, reset, walkIn } from "./helpers";

const job = async (id: string) => (await db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, id)))[0];

describe("engineer transfer approvals", () => {
  let admin: Awaited<ReturnType<typeof makeUser>>;
  let a: Awaited<ReturnType<typeof makeUser>>;
  let b: Awaited<ReturnType<typeof makeUser>>;
  let jobId: string;

  beforeEach(async () => {
    await reset();
    admin = await makeUser("admin");
    a = await makeUser("engineer");
    b = await makeUser("engineer");
    jobId = (await createServiceRequest(admin.id, walkIn())).id;
    expect((await job(jobId)).assignedEngineerId).toBe(a.id);
  });

  it("does not move the job until an admin approves", async () => {
    const t = await requestTransfer(a.id, jobId, b.id, "Going on leave tomorrow");
    expect((await job(jobId)).assignedEngineerId).toBe(a.id);
    await decideTransfer(admin.id, t.id, true, "");
    expect((await job(jobId)).assignedEngineerId).toBe(b.id);
    const [saved] = await db.select().from(schema.transferRequests).where(eq(schema.transferRequests.id, t.id));
    expect(saved.status).toBe("approved");
    expect(saved.decidedById).toBe(admin.id);
    const history = await db.select().from(schema.serviceAssignments).where(eq(schema.serviceAssignments.requestId, jobId));
    expect(history.some((h) => h.method === "transfer" && h.previousEngineerId === a.id && h.engineerId === b.id)).toBe(true);
  });

  it("keeps the current assignment when rejected", async () => {
    const t = await requestTransfer(a.id, jobId, b.id, "Too busy this week");
    await expect(decideTransfer(admin.id, t.id, false, "")).rejects.toThrow(/reason/);
    await decideTransfer(admin.id, t.id, false, "Customer prefers you");
    expect((await job(jobId)).assignedEngineerId).toBe(a.id);
    await expect(decideTransfer(admin.id, t.id, true, "")).rejects.toThrow(/already rejected/);
  });

  it("only lets the assigned engineer ask, once at a time", async () => {
    await expect(requestTransfer(b.id, jobId, a.id, "I want this one")).rejects.toThrow(/assigned to you/);
    await requestTransfer(a.id, jobId, b.id, "Going on leave");
    await expect(requestTransfer(a.id, jobId, b.id, "Going on leave again")).rejects.toThrow(/already a transfer/);
  });

  it("refuses to approve when the job was reassigned meanwhile", async () => {
    const c = await makeUser("engineer");
    const t = await requestTransfer(a.id, jobId, b.id, "Going on leave");
    await overrideAssignment(admin.id, jobId, { engineerId: c.id }, "Urgent; c is nearby");
    // The override withdrew the stale request.
    await expect(decideTransfer(admin.id, t.id, true, "")).rejects.toThrow(/already withdrawn/);
    expect((await job(jobId)).assignedEngineerId).toBe(c.id);
  });

  it("refuses to approve a transfer to an engineer who was switched off", async () => {
    const t = await requestTransfer(a.id, jobId, b.id, "Going on leave");
    await db.update(schema.users).set({ disabledAt: new Date() }).where(eq(schema.users.id, b.id));
    await expect(decideTransfer(admin.id, t.id, true, "")).rejects.toThrow(/active/);
    expect((await job(jobId)).assignedEngineerId).toBe(a.id);
  });

  it("hands a switched-off engineer's active jobs to someone else", async () => {
    const res = await setDisabled(actorOf(admin), a.id, true);
    expect(res.jobs).toEqual({ total: 1, reassigned: 1 });
    expect((await job(jobId)).assignedEngineerId).toBe(b.id);
  });
});
