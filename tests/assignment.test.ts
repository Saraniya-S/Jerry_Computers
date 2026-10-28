import { count, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { engineerWorkloads } from "@/lib/server/admin/assignment";
import { changeServiceStatus, createServiceRequest, overrideAssignment } from "@/lib/server/admin/service-requests";
import { db, schema } from "@/lib/server/db";
import { makeUser, reset, walkIn } from "./helpers";

async function loads() {
  const rows = await engineerWorkloads();
  return Object.fromEntries(rows.map((r) => [r.id, r.activeJobs]));
}

describe("automatic engineer assignment", () => {
  let admin: Awaited<ReturnType<typeof makeUser>>;
  beforeEach(async () => {
    await reset();
    admin = await makeUser("admin");
  });

  it("assigns to the eligible engineer with the fewest active jobs", async () => {
    const a = await makeUser("engineer");
    // a takes two jobs before b joins.
    await createServiceRequest(admin.id, walkIn());
    await createServiceRequest(admin.id, walkIn());
    const b = await makeUser("engineer");
    expect((await createServiceRequest(admin.id, walkIn())).engineer?.id).toBe(b.id);
    expect((await createServiceRequest(admin.id, walkIn())).engineer?.id).toBe(b.id);
    // 2 each now; a was assigned longer ago.
    expect((await createServiceRequest(admin.id, walkIn())).engineer?.id).toBe(a.id);
  });

  it("does not count completed or cancelled jobs as active", async () => {
    const a = await makeUser("engineer");
    const b = await makeUser("engineer");
    const j1 = await createServiceRequest(admin.id, walkIn());
    const j2 = await createServiceRequest(admin.id, walkIn());
    expect(new Set([j1.engineer!.id, j2.engineer!.id])).toEqual(new Set([a.id, b.id]));
    // Close a's job: completed. b's job stays active.
    const aJob = j1.engineer!.id === a.id ? j1 : j2;
    await changeServiceStatus({ id: a.id, role: "engineer" }, { requestId: aJob.id, to: "accepted" });
    await changeServiceStatus({ id: a.id, role: "engineer" }, { requestId: aJob.id, to: "in_progress" });
    await changeServiceStatus({ id: a.id, role: "engineer" }, { requestId: aJob.id, to: "completed", note: "Replaced the adapter" });
    expect((await loads())[a.id]).toBe(0);
    expect((await createServiceRequest(admin.id, walkIn())).engineer?.id).toBe(a.id);

    // Cancelled jobs also drop out of b's count.
    const bJob = j1.engineer!.id === b.id ? j1 : j2;
    await changeServiceStatus({ id: admin.id, role: "admin" }, { requestId: bJob.id, to: "cancelled", note: "Customer withdrew" });
    expect((await loads())[b.id]).toBe(0);
  });

  it("only considers active, available engineers who take the device type", async () => {
    await makeUser("engineer", { disabledAt: new Date() });
    await makeUser("engineer", { passwordHash: null }); // invited, never signed in
    const busy = await makeUser("engineer");
    await db.update(schema.engineerProfiles).set({ isAvailable: false }).where(eq(schema.engineerProfiles.userId, busy.id));
    const printers = await makeUser("engineer");
    await db.update(schema.engineerProfiles).set({ skills: ["printer"] }).where(eq(schema.engineerProfiles.userId, printers.id));
    const inShop = await makeUser("engineer");
    await db.update(schema.engineerProfiles).set({ takesOnSite: false }).where(eq(schema.engineerProfiles.userId, inShop.id));

    expect((await createServiceRequest(admin.id, walkIn({ deviceType: "printer" }))).engineer?.id).toBe(printers.id);
    // Laptop: printers-only engineer can't take it; only inShop is left.
    expect((await createServiceRequest(admin.id, walkIn({ deviceType: "laptop" }))).engineer?.id).toBe(inShop.id);
    // On-site laptop: nobody eligible, so it stays unassigned.
    const onSite = await createServiceRequest(
      admin.id,
      walkIn({ location: "on_site", address: { label: "Home", recipientName: "W", phone: "9876543210", line1: "1 Street", line2: "", landmark: "", city: "Chennai", state: "Tamil Nadu", postalCode: "600001", mapsUrl: "" } }),
    );
    expect(onSite.engineer).toBeNull();
    const [job] = await db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, onSite.id));
    expect(job.status).toBe("open");
  });

  it("breaks ties consistently: least recently assigned first", async () => {
    const a = await makeUser("engineer");
    const b = await makeUser("engineer");
    const first = await createServiceRequest(admin.id, walkIn());
    expect(first.engineer?.id).toBe(a.id); // both never assigned: older account first
    const second = await createServiceRequest(admin.id, walkIn());
    expect(second.engineer?.id).toBe(b.id); // a has 1, b has 0
    // Both now have 1; a was assigned longer ago.
    expect((await createServiceRequest(admin.id, walkIn())).engineer?.id).toBe(a.id);
  });

  it("spreads simultaneous requests evenly instead of piling onto one engineer", async () => {
    const engineers = [await makeUser("engineer"), await makeUser("engineer"), await makeUser("engineer")];
    const results = await Promise.all(Array.from({ length: 9 }, () => createServiceRequest(admin.id, walkIn())));
    expect(results.every((r) => r.engineer)).toBe(true);
    const l = await loads();
    expect(engineers.map((e) => l[e.id])).toEqual([3, 3, 3]);
    const [{ n }] = await db.select({ n: count() }).from(schema.serviceAssignments).where(eq(schema.serviceAssignments.method, "auto"));
    expect(n).toBe(9);
  });

  it("records each decision in the assignment history", async () => {
    const a = await makeUser("engineer");
    const b = await makeUser("engineer");
    const job = await createServiceRequest(admin.id, walkIn());
    await overrideAssignment(admin.id, job.id, { engineerId: job.engineer!.id === a.id ? b.id : a.id }, "Customer asked for them");
    const history = await db.select().from(schema.serviceAssignments).where(eq(schema.serviceAssignments.requestId, job.id));
    expect(history.map((h) => h.method).sort()).toEqual(["auto", "manual"]);
    expect(history.find((h) => h.method === "manual")?.reason).toBe("Customer asked for them");
    expect(history.find((h) => h.method === "manual")?.decidedById).toBe(admin.id);
  });

  it("requires a reason to override", async () => {
    await makeUser("engineer");
    const job = await createServiceRequest(admin.id, walkIn());
    await expect(overrideAssignment(admin.id, job.id, { unassign: true }, "  ")).rejects.toThrow(/reason/);
  });
});

describe("walk-in service requests", () => {
  beforeEach(reset);

  it("stores a walk-in without creating an account", async () => {
    const admin = await makeUser("admin");
    const before = await db.select({ n: count() }).from(schema.users);
    const job = await createServiceRequest(admin.id, walkIn());
    const [row] = await db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, job.id));
    expect(row.customerId).toBeNull();
    expect(row.contactName).toBe("Walk In");
    expect(row.contactPhone).toBe("+91 98765 43210");
    expect(await db.select({ n: count() }).from(schema.users)).toEqual(before);
  });

  it("rejects on-site jobs without an address", async () => {
    const admin = await makeUser("admin");
    await expect(createServiceRequest(admin.id, walkIn({ location: "on_site" }))).rejects.toThrow();
  });
});
