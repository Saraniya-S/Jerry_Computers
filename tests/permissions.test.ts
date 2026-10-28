import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { changeRole, createStaff, mayManage, setDisabled } from "@/lib/server/admin/users";
import { db, schema } from "@/lib/server/db";
import { can, permissions } from "@/lib/server/permissions";
import { actorOf, makeUser, reset } from "./helpers";

describe("permission matrix", () => {
  it("keeps e-commerce staff to orders and payments", () => {
    const staffCan = (Object.keys(permissions) as (keyof typeof permissions)[]).filter((p) => can("ecommerce_staff", p));
    expect(staffCan.sort()).toEqual(["orders.fulfil", "orders.view", "payments.record"]);
  });

  it("gives customers and engineers no admin permissions", () => {
    for (const role of ["customer", "engineer"] as const) {
      expect((Object.keys(permissions) as (keyof typeof permissions)[]).some((p) => can(role, p))).toBe(false);
    }
  });

  it("reserves refunds, staff management and catalogue changes for admins", () => {
    for (const p of ["payments.refund", "staff.manage", "catalogue.manage", "inventory.adjust", "service.manage", "engineers.manage"] as const) {
      expect(can("admin", p)).toBe(true);
      expect(can("ecommerce_staff", p)).toBe(false);
    }
  });
});

describe("account management rules", () => {
  beforeEach(reset);

  it("stops non-admins and ordinary admins from granting admin", async () => {
    const owner = actorOf(await makeUser("admin", { isSuperAdmin: true }));
    const admin = actorOf(await makeUser("admin"));
    const staff = actorOf(await makeUser("ecommerce_staff"));
    const engineer = await makeUser("engineer");

    expect(mayManage(staff, { id: staff.id, role: "ecommerce_staff", isSuperAdmin: false }, "admin")).toBe(false);
    await expect(changeRole(staff, staff.id, "admin")).rejects.toThrow();
    await expect(createStaff(staff, { role: "admin", firstName: "X", lastName: "", email: "x@test.local", phone: "+91 98765 43210" })).rejects.toThrow();
    await expect(changeRole(admin, engineer.id, "admin")).rejects.toThrow(/super admin/);
    await expect(changeRole(admin, admin.id, "ecommerce_staff")).rejects.toThrow(/own role/);
    await changeRole(owner, engineer.id, "admin");
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, engineer.id));
    expect(u.role).toBe("admin");
  });

  it("protects the super admin and your own account", async () => {
    const owner = await makeUser("admin", { isSuperAdmin: true });
    const admin = actorOf(await makeUser("admin"));
    await expect(setDisabled(admin, owner.id, true)).rejects.toThrow();
    await expect(setDisabled(admin, admin.id, true)).rejects.toThrow(/your own/);
  });

  it("won't turn a customer account into staff", async () => {
    const owner = actorOf(await makeUser("admin", { isSuperAdmin: true }));
    const customer = await makeUser("customer");
    await expect(changeRole(owner, customer.id, "ecommerce_staff")).rejects.toThrow(/Customer accounts/);
  });

  it("logs role changes", async () => {
    const owner = actorOf(await makeUser("admin", { isSuperAdmin: true }));
    const staff = await makeUser("ecommerce_staff");
    await changeRole(owner, staff.id, "engineer");
    const logs = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.entityId, staff.id));
    expect(logs[0]).toMatchObject({ action: "user.role_change", actorId: owner.id });
    // Becoming an engineer creates their engineer settings.
    expect(await db.select().from(schema.engineerProfiles).where(eq(schema.engineerProfiles.userId, staff.id))).toHaveLength(1);
  });
});
