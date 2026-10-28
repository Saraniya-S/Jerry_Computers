import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { engineerWorkloads } from "@/lib/server/admin/assignment";
import { addServiceNote, changeServiceStatus, createServiceRequest, decideTransfer, overrideAssignment, requestTransfer, setSchedule } from "@/lib/server/admin/service-requests";
import { db, schema } from "@/lib/server/db";
import { engineerSummary, getMyJob, searchMyJobs } from "@/lib/server/engineer/jobs";
import { locationLinks } from "@/lib/service-location";
import { makeUser, reset, walkIn } from "./helpers";

type U = Awaited<ReturnType<typeof makeUser>>;
const as = (u: U) => ({ id: u.id, role: u.role });
const job = async (id: string) => (await db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, id)))[0];
const active = async (id: string) => (await engineerWorkloads()).find((e) => e.id === id)!.activeJobs;
const inbox = (userId: string) => db.select().from(schema.notifications).where(eq(schema.notifications.userId, userId));

describe("engineer workspace", () => {
  let admin: U, a: U, b: U, jobId: string;

  beforeEach(async () => {
    await reset();
    admin = await makeUser("admin");
    a = await makeUser("engineer");
    jobId = (await createServiceRequest(admin.id, walkIn())).id;
    b = await makeUser("engineer");
  });

  it("only shows an engineer the jobs assigned to them", async () => {
    expect(await getMyJob(a.id, jobId)).not.toBeNull();
    expect(await getMyJob(b.id, jobId)).toBeNull();
    expect((await searchMyJobs(b.id)).total).toBe(0);
    expect((await searchMyJobs(a.id)).rows.map((r) => r.id)).toEqual([jobId]);
    // Updates on someone else's job are refused on the server.
    await expect(changeServiceStatus(as(b), { requestId: jobId, to: "accepted" })).rejects.toThrow(/isn't assigned to you/);
    await expect(addServiceNote(as(b), { requestId: jobId, kind: "diagnosis", note: "x" })).rejects.toThrow(/isn't assigned to you/);
    await expect(setSchedule(as(b), { requestId: jobId, scheduledAt: new Date(Date.now() + 86_400_000) })).rejects.toThrow(/isn't assigned to you/);
    // A customer or staff account can't act as an engineer either.
    const staff = await makeUser("ecommerce_staff");
    await expect(changeServiceStatus(as(staff), { requestId: jobId, to: "accepted" })).rejects.toThrow();
  });

  it("follows the workflow, requires notes and refuses a second completion", async () => {
    await expect(changeServiceStatus(as(a), { requestId: jobId, to: "in_progress" })).rejects.toThrow(/can't become/);
    await changeServiceStatus(as(a), { requestId: jobId, to: "accepted" });
    expect((await job(jobId)).acceptedAt).not.toBeNull();
    await changeServiceStatus(as(a), { requestId: jobId, to: "in_progress" });
    await expect(changeServiceStatus(as(a), { requestId: jobId, to: "awaiting_parts" })).rejects.toThrow(/add a note/);
    await changeServiceStatus(as(a), { requestId: jobId, to: "awaiting_parts", note: "Charging IC, due Friday" });
    expect(await active(a.id)).toBe(1);
    await changeServiceStatus(as(a), { requestId: jobId, to: "in_progress" });
    await expect(changeServiceStatus(as(a), { requestId: jobId, to: "cancelled", note: "x" })).rejects.toThrow(/can't become/);
    await expect(changeServiceStatus(as(a), { requestId: jobId, to: "completed" })).rejects.toThrow(/add a note/);

    // Two "complete" clicks at once: exactly one wins.
    const results = await Promise.allSettled([1, 2].map(() => changeServiceStatus(as(a), { requestId: jobId, to: "completed", note: "Replaced charging IC" })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const done = await job(jobId);
    expect(done).toMatchObject({ status: "completed", resolution: "Replaced charging IC" });
    expect(await active(a.id)).toBe(0);
    const completions = await db.select().from(schema.serviceEvents).where(and(eq(schema.serviceEvents.requestId, jobId), eq(schema.serviceEvents.kind, "completion")));
    expect(completions).toHaveLength(1);
  });

  it("keeps the work report append-only", async () => {
    await addServiceNote(as(a), { requestId: jobId, kind: "inspection", note: "Port is loose" });
    await addServiceNote(as(a), { requestId: jobId, kind: "diagnosis", note: "Charging IC failed" });
    await expect(addServiceNote(as(a), { requestId: jobId, kind: "completion", note: "x" })).rejects.toThrow(/completing the job/);
    const kinds = (await db.select().from(schema.serviceEvents).where(eq(schema.serviceEvents.requestId, jobId))).map((e) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(["inspection", "diagnosis"]));
  });

  it("hands a job back to the admins without leaving it in the engineer's workload", async () => {
    await expect(changeServiceStatus(as(a), { requestId: jobId, to: "unable_to_complete" })).rejects.toThrow(/add a note/);
    await changeServiceStatus(as(a), { requestId: jobId, to: "unable_to_complete", note: "Board needs a part we can't source" });
    expect(await active(a.id)).toBe(0);
    expect((await inbox(admin.id)).some((n) => n.kind === "service.unable")).toBe(true);
    // The engineer can't take it further; an admin reassigns it and the new engineer starts at "assigned".
    await expect(changeServiceStatus(as(a), { requestId: jobId, to: "in_progress" })).rejects.toThrow();
    await overrideAssignment(admin.id, jobId, { auto: true }, "Second opinion");
    expect(await job(jobId)).toMatchObject({ assignedEngineerId: b.id, status: "assigned", acceptedAt: null });
    expect((await inbox(b.id)).some((n) => n.kind === "service.assigned")).toBe(true);
  });

  it("only lets engineers request transfers to eligible colleagues, and notifies the outcome", async () => {
    await db.update(schema.engineerProfiles).set({ isAvailable: false }).where(eq(schema.engineerProfiles.userId, b.id));
    await expect(requestTransfer(a.id, jobId, b.id, "Going on leave")).rejects.toThrow(/marked unavailable/);
    await db.update(schema.engineerProfiles).set({ isAvailable: true }).where(eq(schema.engineerProfiles.userId, b.id));

    await changeServiceStatus(as(a), { requestId: jobId, to: "accepted" });
    const t = await requestTransfer(a.id, jobId, b.id, "Going on leave");
    expect((await inbox(admin.id)).some((n) => n.kind === "transfer.requested")).toBe(true);
    // An engineer can't approve: decideTransfer is only reachable through admin actions, and approval re-checks.
    expect((await job(jobId)).assignedEngineerId).toBe(a.id);

    await decideTransfer(admin.id, t.id, false, "Customer prefers you");
    expect((await job(jobId)).assignedEngineerId).toBe(a.id);
    expect((await inbox(a.id)).some((n) => n.kind === "transfer.rejected")).toBe(true);

    const t2 = await requestTransfer(a.id, jobId, b.id, "Leave approved now");
    await decideTransfer(admin.id, t2.id, true, "");
    expect(await job(jobId)).toMatchObject({ assignedEngineerId: b.id, status: "assigned", acceptedAt: null });
    expect((await inbox(a.id)).some((n) => n.kind === "transfer.approved")).toBe(true);
    expect(await getMyJob(a.id, jobId)).toBeNull();
    expect(await active(a.id)).toBe(0);
    expect(await active(b.id)).toBe(1);
  });

  it("counts the dashboard from the engineer's own records", async () => {
    const j2 = (await createServiceRequest(admin.id, walkIn())).id; // b has fewer jobs → b
    const j3 = (await createServiceRequest(admin.id, walkIn())).id; // tie → a (assigned longer ago)
    expect((await job(j3)).assignedEngineerId).toBe(a.id);
    await changeServiceStatus(as(a), { requestId: j3, to: "accepted" });
    await changeServiceStatus(as(a), { requestId: j3, to: "awaiting_customer", note: "Waiting for password" });
    const soon = new Date(Date.now() + 60_000);
    await setSchedule(as(a), { requestId: jobId, scheduledAt: soon });
    await expect(setSchedule(as(a), { requestId: jobId, scheduledAt: new Date(Date.now() - 3 * 3_600_000) })).rejects.toThrow(/hasn't passed/);

    const s = await engineerSummary(a.id);
    expect(s).toMatchObject({ active: 2, unaccepted: 1, waiting: 1, awaitingCustomer: 1, completed: 0, pendingTransfers: 0 });
    // Scheduled-today depends on whether "a minute from now" is still today in IST.
    const sameDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(soon) === new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    expect(s.scheduledToday).toBe(sameDay ? 1 : 0);
    expect((await engineerSummary(b.id)).active).toBe(1);
    expect(j2).toBeTruthy();
  });
});

describe("location links", () => {
  const base = { label: "Home", recipientName: "R", phone: "+91 98765 43210", line1: "12 Anna Salai", line2: null, landmark: null, city: "Chennai", state: "Tamil Nadu", postalCode: "600002", mapsUrl: null };

  it("prefers a saved pin, then a shared link, then the street address", () => {
    expect(locationLinks({ ...base, latitude: 13.06, longitude: 80.25 })).toMatchObject({ source: "pin", directions: expect.stringContaining("13.06,80.25") });
    expect(locationLinks({ ...base, mapsUrl: "https://maps.app.goo.gl/abc" })).toMatchObject({ source: "shared_link", view: "https://maps.app.goo.gl/abc" });
    expect(locationLinks(base)).toMatchObject({ source: "address", directions: expect.stringContaining("Anna%20Salai") });
  });

  it("returns nothing rather than a guessed location", () => {
    expect(locationLinks(null)).toBeNull();
    expect(locationLinks({ ...base, line1: "", postalCode: "" })).toBeNull();
    expect(locationLinks({ ...base, line1: "", latitude: 0, longitude: 0 })).toBeNull();
  });
});
