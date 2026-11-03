import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { engineerWorkloads } from "@/lib/server/admin/assignment";
import { createServiceRequest } from "@/lib/server/admin/service-requests";
import { db, schema } from "@/lib/server/db";
import { cancelLeave, decideLeave, leaveDaysInRange, leaveRequests, requestLeave, upcomingLeave } from "@/lib/server/engineer/leave";
import { istDay } from "@/lib/service-request-form";
import { makeUser, reset, walkIn } from "./helpers";

const dayFrom = (offset: number) => istDay(new Date(Date.now() + offset * 86_400_000));
const status = async (id: string) => (await engineerWorkloads()).find((e) => e.id === id)!.ineligible;
const assignee = async (adminId: string) => {
  const { id } = await createServiceRequest(adminId, walkIn());
  return (await db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, id)))[0].assignedEngineerId;
};
const inbox = (id: string) => db.select().from(schema.notifications).where(eq(schema.notifications.userId, id));

describe("engineer leave", () => {
  let admin: Awaited<ReturnType<typeof makeUser>>, a: Awaited<ReturnType<typeof makeUser>>, b: Awaited<ReturnType<typeof makeUser>>;
  beforeEach(async () => {
    await reset();
    admin = await makeUser("admin");
    a = await makeUser("engineer");
    b = await makeUser("engineer");
  });

  it("checks the dates and refuses overlapping requests", async () => {
    await expect(requestLeave(a.id, { startsOn: dayFrom(-1), endsOn: dayFrom(1) })).rejects.toThrow(/today or a later day/);
    await expect(requestLeave(a.id, { startsOn: dayFrom(3), endsOn: dayFrom(2) })).rejects.toThrow(/can't be before/);
    await expect(requestLeave(a.id, { startsOn: dayFrom(1), endsOn: dayFrom(70) })).rejects.toThrow(/up to 60 days/i);
    await requestLeave(a.id, { startsOn: dayFrom(2), endsOn: dayFrom(4), reason: "Wedding" });
    await expect(requestLeave(a.id, { startsOn: dayFrom(4), endsOn: dayFrom(5) })).rejects.toThrow(/already have leave/);
    expect(await upcomingLeave(a.id)).toMatchObject([{ startsOn: dayFrom(2), endsOn: dayFrom(4), reason: "Wedding", status: "pending" }]);
    expect(await inbox(admin.id)).toMatchObject([{ kind: "engineer.leave_requested", href: "/admin/leave" }]);
  });

  it("only stops new jobs once an admin approves, and tells the engineer", async () => {
    const leave = await requestLeave(a.id, { startsOn: dayFrom(0), endsOn: dayFrom(2), reason: "Fever" });
    // Still pending: a keeps getting jobs.
    expect(await status(a.id)).toBeNull();
    expect((await leaveRequests()).pending).toMatchObject([{ leave: { id: leave.id }, firstName: a.firstName }]);

    await decideLeave(admin.id, leave.id, true);
    expect(await status(a.id)).toMatch(/^On leave until /);
    expect(await assignee(admin.id)).toBe(b.id);
    expect(await assignee(admin.id)).toBe(b.id);
    expect((await inbox(a.id)).map((n) => n.kind)).toContain("engineer.leave_approved");
    await expect(decideLeave(admin.id, leave.id, false, "x")).rejects.toThrow(/already approved/);
    expect((await leaveRequests()).decided).toMatchObject([{ leave: { status: "approved" } }]);
    expect((await leaveDaysInRange(dayFrom(1), dayFrom(10))).get(a.id)).toBe(2);
  });

  it("needs a reason to reject, and a rejected request never takes effect", async () => {
    const leave = await requestLeave(a.id, { startsOn: dayFrom(0), endsOn: dayFrom(1) });
    await expect(decideLeave(admin.id, leave.id, false, "  ")).rejects.toThrow(/Say why/);
    await decideLeave(admin.id, leave.id, false, "Short-staffed that week");
    expect(await status(a.id)).toBeNull();
    expect(await upcomingLeave(a.id)).toMatchObject([{ status: "rejected", decisionNote: "Short-staffed that week" }]);
    expect((await inbox(a.id)).find((n) => n.kind === "engineer.leave_rejected")).toMatchObject({ body: "Short-staffed that week" });
    await expect(cancelLeave(a.id, leave.id)).rejects.toThrow(/isn't there/);
    // The same days can be asked for again.
    await requestLeave(a.id, { startsOn: dayFrom(0), endsOn: dayFrom(1) });
  });

  it("withdraws a request, cancels approved leave ahead of time, and ends leave under way", async () => {
    const asked = await requestLeave(a.id, { startsOn: dayFrom(3), endsOn: dayFrom(4) });
    await cancelLeave(a.id, asked.id);
    expect(await upcomingLeave(a.id)).toHaveLength(0);

    const [started] = await db.insert(schema.engineerLeave).values({ engineerId: a.id, startsOn: dayFrom(-2), endsOn: dayFrom(2), status: "approved" }).returning();
    expect(await status(a.id)).toMatch(/On leave/);
    await expect(cancelLeave(b.id, started.id)).rejects.toThrow(/isn't there/);
    await cancelLeave(a.id, started.id);
    const [kept] = await db.select().from(schema.engineerLeave).where(eq(schema.engineerLeave.id, started.id));
    expect(kept.endsOn).toBe(dayFrom(-1));
    expect(await status(a.id)).toBeNull();
    expect((await inbox(admin.id)).map((n) => n.kind)).toContain("engineer.leave_cancelled");
  });
});
