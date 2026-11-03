import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { engineerWorkloads } from "@/lib/server/admin/assignment";
import { recordCollection } from "@/lib/server/admin/collections";
import { addHelper, jobTeam, removeHelper } from "@/lib/server/admin/job-team";
import { addServiceNote, changeServiceStatus, createServiceRequest, overrideAssignment, setSchedule } from "@/lib/server/admin/service-requests";
import { db, schema } from "@/lib/server/db";
import { getMyJob, searchMyJobs } from "@/lib/server/engineer/jobs";
import { makeUser, reset, walkIn } from "./helpers";

type U = Awaited<ReturnType<typeof makeUser>>;
const as = (u: U) => ({ id: u.id, role: u.role });
const inbox = (id: string) => db.select().from(schema.notifications).where(eq(schema.notifications.userId, id));

describe("job teams", () => {
  let admin: U, lead: U, helper: U, other: U, jobId: string;
  beforeEach(async () => {
    await reset();
    admin = await makeUser("admin");
    const e1 = await makeUser("engineer");
    jobId = (await createServiceRequest(admin.id, walkIn())).id;
    lead = e1;
    helper = await makeUser("engineer");
    other = await makeUser("engineer");
  });

  it("lets an admin add a helper, who then sees the job and can add to its report only", async () => {
    await addHelper(as(admin), { requestId: jobId, engineerId: helper.id, reason: "Two-person install" });
    expect(await jobTeam(jobId)).toMatchObject([{ engineerId: helper.id, reason: "Two-person install" }]);
    expect(await inbox(helper.id)).toMatchObject([{ kind: "service.helper_added" }]);
    expect((await inbox(lead.id)).some((n) => n.kind === "service.helper_added")).toBe(true);

    const seen = await getMyJob(helper.id, jobId);
    expect(seen).toMatchObject({ isLead: false, team: [{ engineerId: helper.id }] });
    expect((await searchMyJobs(helper.id)).rows).toMatchObject([{ id: jobId, helping: true }]);
    expect((await searchMyJobs(helper.id, { status: "helping" })).total).toBe(1);
    expect(await getMyJob(other.id, jobId)).toBeNull();

    await addServiceNote(as(helper), { requestId: jobId, kind: "work_done", note: "Mounted the rack" });
    await expect(addServiceNote(as(other), { requestId: jobId, kind: "note", note: "x" })).rejects.toThrow(/isn't assigned to you/);
    // Status, schedule and payments stay with the lead.
    await expect(changeServiceStatus(as(helper), { requestId: jobId, to: "accepted" })).rejects.toThrow(/isn't assigned to you/);
    await expect(setSchedule(as(helper), { requestId: jobId, scheduledAt: new Date(Date.now() + 86_400_000) })).rejects.toThrow(/isn't assigned to you/);
    await expect(recordCollection(as(helper), { requestId: jobId, amount: "500", method: "cash", note: "", correction: false })).rejects.toThrow(/isn't assigned to you/);
  });

  it("lets the lead bring in free colleagues only, and refuses duplicates, the lead and closed jobs", async () => {
    await db.insert(schema.engineerProfiles).values({ userId: other.id, isAvailable: false }).onConflictDoUpdate({ target: schema.engineerProfiles.userId, set: { isAvailable: false } });
    await expect(addHelper(as(lead), { requestId: jobId, engineerId: other.id })).rejects.toThrow(/can't join right now/);
    await expect(addHelper(as(helper), { requestId: jobId, engineerId: other.id })).rejects.toThrow(/Only an admin or the job's lead/);
    await addHelper(as(lead), { requestId: jobId, engineerId: helper.id });
    expect((await inbox(admin.id)).some((n) => n.kind === "service.helper_added")).toBe(true);
    await expect(addHelper(as(lead), { requestId: jobId, engineerId: helper.id })).rejects.toThrow(/already on this job/);
    await expect(addHelper(as(admin), { requestId: jobId, engineerId: lead.id })).rejects.toThrow(/already leading/);
    // An admin can still add someone who has paused new jobs.
    await addHelper(as(admin), { requestId: jobId, engineerId: other.id });

    await changeServiceStatus(as(admin), { requestId: jobId, to: "cancelled", note: "Customer cancelled" });
    const fresh = await makeUser("engineer");
    await expect(addHelper(as(admin), { requestId: jobId, engineerId: fresh.id })).rejects.toThrow(/only while it's assigned and open/);
  });

  it("lets a helper leave, and the lead or an admin take them off", async () => {
    await addHelper(as(admin), { requestId: jobId, engineerId: helper.id });
    await expect(removeHelper(as(other), { requestId: jobId, engineerId: helper.id })).rejects.toThrow(/Only an admin or the job's lead/);
    await removeHelper(as(helper), { requestId: jobId, engineerId: helper.id });
    expect(await getMyJob(helper.id, jobId)).toBeNull();
    expect((await inbox(lead.id)).some((n) => n.kind === "service.helper_left")).toBe(true);
    // Rejoining after leaving is fine.
    await addHelper(as(lead), { requestId: jobId, engineerId: helper.id });
    await removeHelper(as(lead), { requestId: jobId, engineerId: helper.id });
    expect(await jobTeam(jobId)).toHaveLength(0);
  });

  it("counts helping toward workload, and drops the helper role when they become the lead", async () => {
    await addHelper(as(admin), { requestId: jobId, engineerId: helper.id });
    const load = async (id: string) => (await engineerWorkloads()).find((e) => e.id === id)!.activeJobs;
    expect(await load(helper.id)).toBe(1);
    // The next job goes to the one engineer with nothing on.
    const next = await createServiceRequest(admin.id, walkIn());
    expect((await db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, next.id)))[0].assignedEngineerId).toBe(other.id);

    await overrideAssignment(admin.id, jobId, { engineerId: helper.id }, "Lead is off sick");
    expect(await jobTeam(jobId)).toHaveLength(0);
    expect(await getMyJob(helper.id, jobId)).toMatchObject({ isLead: true });
    expect(await load(helper.id)).toBe(1);
  });
});
