import type { AddressDraft } from "@/components/forms/AddressFields";

export type RequestService = { slug: string; label: string; title: string; description: string; includes: string[]; visual: string };
export type SavedAddress = Omit<AddressDraft, "label"> & { id: string; label: string; isDefault: boolean };
export type RequestAccount = { firstName: string; verified: boolean; phone: string | null; addresses: SavedAddress[] };
export type ShopInfo = { name: string; address: string; place: string; phone: string; email: string; mapUrl: string; hours: { days: string; hours: string }[] };

/** The customer's problem isn't in the service's list. */
export const OTHER = "__other";
export const STEPS = ["Service", "Device", "Service method", "Review"] as const;

export type Draft = {
  serviceSlug: string;
  /** "" = nothing picked yet, OTHER = something else, otherwise one of the service's listed problems. */
  problemType: string;
  deviceBrand: string;
  deviceModel: string;
  serialNumber: string;
  issue: string;
  location: "" | "in_shop" | "on_site";
  /** A saved address id, or "new" for one typed here. */
  addressChoice: string;
  address: AddressDraft;
  /** "lat, lng" from the browser, only when the customer shared it. */
  pin: string;
  pinAccuracy: number | null;
  preferredDate: string;
  preferredWindow: string;
  phone: string;
  /** Sent with the request so a retry or double click returns the same ticket. */
  clientRequestId: string;
};
