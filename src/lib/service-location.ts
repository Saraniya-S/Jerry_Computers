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

/** Above this (metres) a browser fix is an estimate from the internet connection, not the device's real position. */
export const ROUGH_FIX_METRES = 1000;

/**
 * Reads a location the customer pasted: "lat, lng", or a map link. Coordinates inside a Google Maps
 * link (…/@12.97,80.22,17z, ?q=12.97,80.22, !3d12.97!4d80.22) become a pin; any other http(s) link
 * (e.g. a maps.app.goo.gl share link) is kept as the link. Null when it's neither.
 */
export function parsePastedLocation(text: string): { pin: string; mapsUrl: "" } | { pin: ""; mapsUrl: string } | null {
  const v = text.trim();
  const asPin = (lat: string, lng: string) => (parsePin(`${lat}, ${lng}`) ? { pin: `${Number(lat)}, ${Number(lng)}`, mapsUrl: "" as const } : null);
  const direct = parsePin(v);
  if (direct) return { pin: `${direct.latitude}, ${direct.longitude}`, mapsUrl: "" };
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const n = "(-?\\d{1,3}(?:\\.\\d+)?)";
  const found =
    new RegExp(`!3d${n}!4d${n}`).exec(v) ??
    new RegExp(`@${n},${n}`).exec(v) ??
    new RegExp(`^${n}\\s*,\\s*${n}$`).exec(url.searchParams.get("q") ?? url.searchParams.get("query") ?? url.searchParams.get("ll") ?? url.searchParams.get("destination") ?? "");
  return (found && asPin(found[1], found[2])) || { pin: "", mapsUrl: url.toString() };
}

/**
 * Where engineers go for on-site visits: anywhere in Kanniyakumari district (Tamil Nadu's 629 PIN
 * code area), and beyond it up to the shop's visit radius, measured from the shop's map pin to the
 * customer's. In-shop jobs aren't limited (the customer brings the device in).
 */
export const SERVICE_AREA = { name: "Kanniyakumari district", state: "Tamil Nadu", pinPrefix: "629" } as const;

export function inServiceArea(a: { state?: unknown; postalCode?: unknown } | null | undefined) {
  if (!a) return false;
  const pin = typeof a.postalCode === "string" ? a.postalCode.replace(/\s/g, "") : "";
  return a.state === SERVICE_AREA.state && new RegExp(`^${SERVICE_AREA.pinPrefix}\\d{3}$`).test(pin);
}

type Point = { latitude: number; longitude: number };
/** The shop's map pin and how far beyond the district engineers travel. */
export type VisitArea = { shop: Point | null; radiusKm: number };

/** Great-circle distance in kilometres. */
export function distanceKm(a: Point, b: Point) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The rule in words, for the request form. */
export const visitAreaText = (area: VisitArea) => (area.shop && area.radiusKm > 0 ? `${SERVICE_AREA.name}, or within ${area.radiusKm} km of our shop` : SERVICE_AREA.name);

/**
 * Whether engineers can visit this address. Inside the district is always fine; outside it, the
 * customer's map pin (shared from their device or a map link) has to be within the radius.
 */
export function checkVisit(address: { state?: unknown; postalCode?: unknown } | null | undefined, pin: Point | null, area: VisitArea): { ok: true } | { ok: false; message: string } {
  if (inServiceArea(address)) return { ok: true };
  const reach = area.shop && area.radiusKm > 0;
  const instead = "Or choose in-shop service and bring your device to us.";
  if (!reach) return { ok: false, message: `On-site visits are only available in ${SERVICE_AREA.name} (PIN codes starting ${SERVICE_AREA.pinPrefix}). ${instead}` };
  if (!pin) return { ok: false, message: `This address is outside ${SERVICE_AREA.name}. We also visit within ${area.radiusKm} km of our shop: share your location below so we can check the distance. ${instead}` };
  const km = distanceKm(area.shop!, pin);
  if (km <= area.radiusKm) return { ok: true };
  return { ok: false, message: `That location is about ${Math.round(km)} km from our shop. Outside ${SERVICE_AREA.name} we visit up to ${area.radiusKm} km away. ${instead}` };
}
