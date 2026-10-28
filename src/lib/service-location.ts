import type { ServiceAddress } from "@/lib/server/db/schema";

export type LocationLinks = {
  /** Where the link points from: a saved pin, a link the customer shared, or the typed address. */
  source: "pin" | "shared_link" | "address";
  view: string;
  directions: string;
};

const validPin = (a: ServiceAddress) =>
  typeof a.latitude === "number" && typeof a.longitude === "number" && Math.abs(a.latitude) <= 90 && Math.abs(a.longitude) <= 180 && !(a.latitude === 0 && a.longitude === 0);

const fullAddress = (a: ServiceAddress) => (a.line1?.trim() && a.city?.trim() && a.postalCode?.trim() ? [a.line1, a.line2, a.landmark, a.city, a.state, a.postalCode].filter(Boolean).join(", ") : null);

/**
 * Map and directions links for an on-site job, from saved data only: a pin, else the customer's
 * shared map link, else a complete street address. Null when there's nothing reliable to navigate to.
 */
export function locationLinks(a: ServiceAddress | null | undefined): LocationLinks | null {
  if (!a) return null;
  if (validPin(a)) {
    const q = `${a.latitude},${a.longitude}`;
    return { source: "pin", view: `https://www.google.com/maps/search/?api=1&query=${q}`, directions: `https://www.google.com/maps/dir/?api=1&destination=${q}` };
  }
  const text = fullAddress(a);
  if (a.mapsUrl) return { source: "shared_link", view: a.mapsUrl, directions: text ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(text)}` : a.mapsUrl };
  if (text) {
    const q = encodeURIComponent(text);
    return { source: "address", view: `https://www.google.com/maps/search/?api=1&query=${q}`, directions: `https://www.google.com/maps/dir/?api=1&destination=${q}` };
  }
  return null;
}

/** "12.9716, 80.2209" → numbers, or null if it isn't a valid latitude/longitude pair. */
export function parsePin(text: string) {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(text);
  if (!m) return null;
  const latitude = Number(m[1]);
  const longitude = Number(m[2]);
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
}
