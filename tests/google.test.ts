import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/lib/server/db";
import { googleSignIn, type GoogleProfile } from "@/lib/server/google";
import { makeUser, reset } from "./helpers";

const profile = (email: string, sub = `sub-${email}`): GoogleProfile => ({ sub, email, emailVerified: true, givenName: "G", familyName: "User" });
const user = async (id: string) => (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0];

describe("Google sign-in", () => {
  beforeEach(reset);

  it("signs in admins and e-commerce staff by their account email, and links that Google account", async () => {
    for (const role of ["admin", "ecommerce_staff"] as const) {
      const u = await makeUser(role);
      const r = await googleSignIn(profile(u.email));
      expect(r).toMatchObject({ ok: true, isNew: false, user: { id: u.id, role, googleSub: `sub-${u.email}` } });
      // The password still works too.
      expect((await user(u.id)).passwordHash).toBe("x");
    }
  });

  it("never creates a staff account, and keeps engineers on email and password", async () => {
    const engineer = await makeUser("engineer");
    expect(await googleSignIn(profile(engineer.email))).toEqual({ ok: false, code: "google_staff" });
    expect((await user(engineer.id)).googleSub).toBeNull();
    // An unknown email becomes a customer, never staff.
    const r = await googleSignIn(profile("new-person@test.local"));
    expect(r).toMatchObject({ ok: true, isNew: true, user: { role: "customer" } });
  });

  it("refuses switched-off staff, staff who haven't accepted their invite, and a different Google account", async () => {
    const off = await makeUser("admin", { disabledAt: new Date() });
    expect(await googleSignIn(profile(off.email))).toEqual({ ok: false, code: "account_disabled" });
    const invited = await makeUser("ecommerce_staff", { passwordHash: null });
    expect(await googleSignIn(profile(invited.email))).toEqual({ ok: false, code: "google_invite" });

    const staff = await makeUser("ecommerce_staff");
    expect((await googleSignIn(profile(staff.email, "sub-first"))).ok).toBe(true);
    expect(await googleSignIn(profile(staff.email, "sub-other"))).toEqual({ ok: false, code: "google_mismatch" });
    expect((await googleSignIn(profile(staff.email, "sub-first"))).ok).toBe(true);
  });

  it("refuses an email Google hasn't verified", async () => {
    const admin = await makeUser("admin");
    expect(await googleSignIn({ ...profile(admin.email), emailVerified: false })).toEqual({ ok: false, code: "google_unverified" });
  });
});
