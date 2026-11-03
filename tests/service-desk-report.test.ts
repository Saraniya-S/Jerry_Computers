import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { addHelper } from "@/lib/server/admin/job-team";
import { serviceDeskReport, serviceDeskRows } from "@/lib/server/admin/service-desk-report";
import { changeServiceStatus, createServiceRequest } from "@/lib/server/admin/service-requests";
import { db, schema } from "@/lib/server/db";
import { decideLeave, requestLeave } from "@/lib/server/engineer/leave";
import { istDay } from "@/lib/service-request-form";
import { makeUser, reset, walkIn } from "./helpers";

type U = Awaited<ReturnType<typeof makeUser>>;
const as = (u: U) => ({ id: u.id, role: u.role });
const today = istDay();

describe("service desk report", () => {
  let admin: U, a: U, b: U;
  beforeEach(async () => {
    await reset();
    admin = await makeUser("admin");
    a = await makeUser("engineer");
    b = await makeUser("engineer");
  });

  it("counts jobs received, completed, handed back and open, with each engineer's share", async () => {
    // Three jobs: they go to a, b, a by workload.
    const [j1, j2, j3] = [await createServiceRequest(admin.id, walkIn()), await createServiceRequest(admin.id, walkIn({ deviceType: "printer" })), await createServiceRequest(admin.id, walkIn())];
    const [lead1] = await db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, j1.id));
    const engineer = lead1.assignedEngineerId === a.id ? a : b;
    const other = engineer === a ? b : a;
    await changeServiceStatus(as(engineer), { requestId: j1.id, to: "accepted" });
    await changeServiceStatus(as(engineer), { requestId: j1.id, to: "completed", note: "Fixed" });
    await changeServiceStatus(as(other), { requestId: j2.id, to: "unable_to_complete", note: "Needs a specialist" });
    await addHelper(as(admin), { requestId: j3.id, engineerId: other.id });
    const leave = await requestLeave(other.id, { startsOn: today, endsOn: today });
    await decideLeave(admin.id, leave.id, true);

    const r = await serviceDeskReport({ from: today, to: today });
    expect(r.headline).toMatchObject({ created: 3, completed: 1, cancelled: 0, handedBack: 1 });
    expect(r.backlog).toMatchObject({ open: 2, handedBack: 1, under1d: 2 });
    expect(r.byDay).toEqual([{ day: today, created: 3, completed: 1 }]);
    expect(r.byDevice.find((d) => d.device === "printer")).toMatchObject({ created: 1, completed: 0 });
    expect(r.oldest.map((o) => o.id).sort()).toEqual([j2.id, j3.id].sort());
    expect(r.engineers.find((e) => e.id === engineer.id)).toMatchObject({ completed: 1 });
    expect(r.engineers.find((e) => e.id === other.id)).toMatchObject({ handedBack: 1, helped: 1, leaveDays: 1 });

    const rows = await serviceDeskRows({ from: today, to: today });
    expect(rows).toHaveLength(3);
    expect(rows.find((x) => x.seq === j3.seq)).toMatchObject({ helpers: 1 });
  });

  it("is empty for a quiet period", async () => {
    const r = await serviceDeskReport({ from: "2020-01-01", to: "2020-01-03" });
    expect(r.headline).toMatchObject({ created: 0, completed: 0, hoursToComplete: null });
    expect(r.byDay.map((d) => d.day)).toEqual(["2020-01-01", "2020-01-02", "2020-01-03"]);
  });
});
