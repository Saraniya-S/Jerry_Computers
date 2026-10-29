/** Which illustration a service card draws (see ServiceVisual). */
export type ServiceId = "laptop" | "desktop" | "cctv" | "printer" | "ups" | "diagnostics";

export const serviceVisuals: { id: ServiceId; label: string }[] = [
  { id: "laptop", label: "Laptop health check" },
  { id: "desktop", label: "Desktop components" },
  { id: "cctv", label: "CCTV cameras" },
  { id: "printer", label: "Printer queue" },
  { id: "ups", label: "UPS battery" },
  { id: "diagnostics", label: "Diagnostics checklist" },
];

/** A service as shown on the site. Stored in the database and edited in Admin → Services. */
/** Services don't have pages of their own: links open the request form with the service chosen. */
export const serviceRequestHref = (slug: string) => `/services/request?service=${encodeURIComponent(slug)}`;

export type Service = {
  id: string;
  slug: string;
  /** Two-digit position, e.g. "01". */
  index: string;
  label: string;
  title: string;
  description: string;
  includes: string[];
  visual: ServiceId;
};
