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
