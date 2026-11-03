import { describe, expect, it } from "vitest";
import { checkVisit, distanceKm } from "@/lib/service-location";

const shop = { latitude: 8.203, longitude: 77.3056 };
const area = { shop, radiusKm: 20 };
const kerala = { state: "Kerala", postalCode: "695502" };

describe("on-site visit area", () => {
  it("measures distances in kilometres", () => {
    expect(distanceKm(shop, shop)).toBe(0);
    // Neyoor to Kanyakumari town is roughly 26 km as the crow flies.
    expect(distanceKm(shop, { latitude: 8.0883, longitude: 77.5385 })).toBeGreaterThan(24);
    expect(distanceKm(shop, { latitude: 8.0883, longitude: 77.5385 })).toBeLessThan(29);
  });

  it("takes the whole district, and beyond it only a pin inside the radius", () => {
    expect(checkVisit({ state: "Tamil Nadu", postalCode: "629 165" }, null, area)).toEqual({ ok: true });
    expect(checkVisit(kerala, null, area)).toMatchObject({ ok: false, message: expect.stringMatching(/share your location/) });
    expect(checkVisit(kerala, { latitude: 8.3, longitude: 77.25 }, area)).toEqual({ ok: true });
    expect(checkVisit(kerala, { latitude: 8.5, longitude: 77.0 }, area)).toMatchObject({ ok: false, message: expect.stringMatching(/about 4\d km/) });
    // No shop pin, or a zero radius: the district only.
    expect(checkVisit(kerala, { latitude: 8.3, longitude: 77.25 }, { shop: null, radiusKm: 20 })).toMatchObject({ ok: false, message: expect.stringMatching(/only available/) });
    expect(checkVisit(kerala, { latitude: 8.3, longitude: 77.25 }, { shop, radiusKm: 0 })).toMatchObject({ ok: false });
  });
});

describe("shop phone numbers", () => {
  it("splits a field holding two numbers into separate call links", async () => {
    const { formatPhone, phoneNumbers, telHref } = await import("@/config/site");
    expect(formatPhone("97912-30446")).toBe("+91 97912 30446");
    expect(formatPhone("+91 9791593446")).toBe("+91 97915 93446");
    expect(formatPhone("04651 222333")).toBe("04651 222333");
    expect(phoneNumbers("97912-30446, 97915-93446")).toEqual(["97912-30446", "97915-93446"]);
    expect(phoneNumbers("97912 30446 / 04651 222333; or 97915-93446")).toEqual(["97912 30446", "04651 222333", "97915-93446"]);
    expect(phoneNumbers("")).toEqual([]);
    expect(telHref("97912-30446")).toBe("tel:+919791230446");
    expect(telHref("+91 97915 93446")).toBe("tel:+919791593446");
    expect(telHref("04651 222333")).toBe("tel:04651222333");
  });
});
