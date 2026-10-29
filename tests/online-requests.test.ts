import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { changeServiceStatus, addServiceNote } from "@/lib/server/admin/service-requests";
import { returnTo } from "@/lib/server/auth";
import { createOnlineServiceRequest, getMyServiceRequest, listMyServiceRequests, SubmitBlocked } from "@/lib/server/customer-service-requests";
import { db, schema } from "@/lib/server/db";
import { istDay } from "@/lib/service-request-form";
import { makeUser, reset } from "./helpers";

const id = () => crypto.randomUUID();
const base = (over: Record<string, unknown> = {}) => ({
  serviceSlug: "laptop-repair",
  problemType: "Battery and charging faults",
  deviceBrand: "Dell",
  deviceModel: "Inspiron 15",
  serialNumber: "",
  issue: "Battery drains in twenty minutes and won't charge past 40%.",
  location: "in_shop" as const,
  phone: "",
  preferredDate: "",
  preferredWindow: "" as const,
  clientRequestId: id(),
  ...over,
});
const onSiteAddress = { label: "Home", recipientName: "Anita", phone: "9876543210", line1: "5 Lake View Road", line2: "", landmark: "", city: "Chennai", state: "Tamil Nadu", postalCode: "600041", mapsUrl: "", pin: "" };
const job = async (rid: string) => (await db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, rid)))[0];

describe("online service requests", () => {
  let customer: Awaited<ReturnType<typeof makeUser>>;
  beforeEach(async () => {
    await reset();
    customer = await makeUser("customer", { emailVerifiedAt: new Date() });
  });

  it("only verified, enabled customer accounts can send a request", async () => {
    const unverified = await makeUser("customer", { emailVerifiedAt: null });
    await expect(createOnlineServiceRequest(unverified.id, base())).rejects.toMatchObject({ reason: "verify" });
    const off = await makeUser("customer", { emailVerifiedAt: new Date(), disabledAt: new Date() });
    await expect(createOnlineServiceRequest(off.id, base())).rejects.toMatchObject({ reason: "disabled" });
    const staff = await makeUser("ecommerce_staff");
    await expect(createOnlineServiceRequest(staff.id, base())).rejects.toBeInstanceOf(SubmitBlocked);
    expect(await db.select().from(schema.serviceRequests)).toHaveLength(0);
  });

  it("creates a real ticket through the normal workflow and auto-assigns a matching engineer", async () => {
    const printers = await makeUser("engineer");
    await db.update(schema.engineerProfiles).set({ skills: ["printer"] }).where(eq(schema.engineerProfiles.userId, printers.id));
    const laptops = await makeUser("engineer");
    const res = await createOnlineServiceRequest(customer.id, base());
    expect(res).toMatchObject({ assigned: true, engineerFirstName: laptops.firstName, duplicate: false });
    expect(res.ticket).toMatch(/^SR-\d{6}$/);
    const row = await job(res.id);
    expect(row).toMatchObject({ customerId: customer.id, source: "online", location: "in_shop", deviceType: "laptop", problemType: "Battery and charging faults", status: "assigned", assignedEngineerId: laptops.id, serviceAddress: null });
    const [svc] = await db.select().from(schema.services).where(eq(schema.services.slug, "laptop-repair"));
    expect(row.serviceId).toBe(svc.id);
    expect(row.contactName).toBe(`${customer.firstName} Test`);
  });

  it("stays unassigned when nobody can take it, without claiming otherwise", async () => {
    const res = await createOnlineServiceRequest(customer.id, base());
    expect(res).toMatchObject({ assigned: false, engineerFirstName: null });
    expect((await job(res.id)).status).toBe("open");
  });

  it("returns the first ticket for a retried or double-clicked submission", async () => {
    await makeUser("engineer");
    const input = base();
    const [a, b] = await Promise.all([createOnlineServiceRequest(customer.id, input), createOnlineServiceRequest(customer.id, input)]);
    expect(a.id).toBe(b.id);
    const again = await createOnlineServiceRequest(customer.id, input);
    expect(again).toMatchObject({ id: a.id, duplicate: true });
    expect(await db.select().from(schema.serviceRequests)).toHaveLength(1);
    expect(await db.select().from(schema.serviceAssignments)).toHaveLength(1);
  });

  it("validates the service, problem, preference and contact on the server", async () => {
    await expect(createOnlineServiceRequest(customer.id, base({ serviceSlug: "made-up" }))).rejects.toMatchObject({ fields: { serviceSlug: expect.any(String) } });
    await expect(createOnlineServiceRequest(customer.id, base({ problemType: "Free upgrade" }))).rejects.toMatchObject({ fields: { problemType: expect.any(String) } });
    await expect(createOnlineServiceRequest(customer.id, base({ issue: "broken" }))).rejects.toMatchObject({ fields: { issue: expect.any(String) } });
    await expect(createOnlineServiceRequest(customer.id, base({ preferredDate: "2020-01-01" }))).rejects.toMatchObject({ fields: { preferredDate: expect.any(String) } });
    await expect(createOnlineServiceRequest(customer.id, base({ preferredWindow: "morning" }))).rejects.toMatchObject({ fields: { preferredDate: expect.any(String) } });
    await db.update(schema.services).set({ isActive: false }).where(eq(schema.services.slug, "ups-maintenance"));
    try {
      await expect(createOnlineServiceRequest(customer.id, base({ serviceSlug: "ups-maintenance", problemType: "" }))).rejects.toMatchObject({ fields: { serviceSlug: expect.any(String) } });
    } finally {
      await db.update(schema.services).set({ isActive: true }).where(eq(schema.services.slug, "ups-maintenance"));
    }
    const noPhone = await makeUser("customer", { emailVerifiedAt: new Date(), phone: null });
    await expect(createOnlineServiceRequest(noPhone.id, base())).rejects.toMatchObject({ fields: { phone: expect.any(String) } });
    const ok = await createOnlineServiceRequest(noPhone.id, base({ phone: "9876501234", preferredDate: istDay(), preferredWindow: "evening" }));
    expect(await job(ok.id)).toMatchObject({ contactPhone: "+91 98765 01234", preferredDate: istDay(), preferredWindow: "evening" });
  });

  it("needs an address on-site, keeps a shared pin, and never needs one in-shop", async () => {
    await expect(createOnlineServiceRequest(customer.id, base({ location: "on_site" }))).rejects.toMatchObject({ fields: { address: expect.any(String) } });
    const res = await createOnlineServiceRequest(customer.id, base({ location: "on_site", serviceSlug: "cctv-installation", problemType: "Maintenance visits", address: { ...onSiteAddress, pin: "13.041800, 80.234100" } }));
    const row = await job(res.id);
    expect(row.deviceType).toBe("cctv");
    expect(row.serviceAddress).toMatchObject({ city: "Chennai", latitude: 13.0418, longitude: 80.2341 });
    const noPin = await createOnlineServiceRequest(customer.id, base({ location: "on_site", address: onSiteAddress }));
    expect((await job(noPin.id)).serviceAddress).toMatchObject({ latitude: null, longitude: null });
  });

  it("shows customers only their own requests, with status changes but no staff notes", async () => {
    const eng = await makeUser("engineer");
    const mine = await createOnlineServiceRequest(customer.id, base());
    const other = await makeUser("customer", { emailVerifiedAt: new Date() });
    const theirs = await createOnlineServiceRequest(other.id, base());
    await addServiceNote({ id: eng.id, role: "engineer" }, { requestId: mine.id, kind: "diagnosis", note: "INTERNAL: board damaged" });
    await changeServiceStatus({ id: eng.id, role: "engineer" }, { requestId: mine.id, to: "accepted" });

    expect((await listMyServiceRequests(customer.id)).map((r) => r.r.id)).toEqual([mine.id]);
    expect(await getMyServiceRequest(customer.id, theirs.id)).toBeNull();
    const detail = await getMyServiceRequest(customer.id, mine.id);
    expect(detail?.timeline.map((t) => t.toStatus)).toEqual(["open", "assigned", "accepted"]);
    expect(JSON.stringify(detail?.timeline)).not.toContain("INTERNAL");
    expect(detail?.engineerFirst).toBe(eng.firstName);
  });
});

describe("returning after sign-in", () => {
  it("sends each role back only into its own areas", () => {
    expect(returnTo("customer", "/services/request")).toBe("/services/request");
    expect(returnTo("customer", "/services/request?service=laptop-repair")).toBe("/services/request?service=laptop-repair");
    expect(returnTo("customer", "/checkout")).toBe("/checkout");
    expect(returnTo("customer", "/admin")).toBe("/account");
    expect(returnTo("customer", "//evil.example")).toBe("/account");
    expect(returnTo("ecommerce_staff", "/staff/orders")).toBe("/staff/orders");
    expect(returnTo("ecommerce_staff", "/admin")).toBe("/staff");
    expect(returnTo("engineer", "/admin/orders")).toBe("/engineer");
    expect(returnTo("admin", "/admin/orders")).toBe("/admin/orders");
  });
});
