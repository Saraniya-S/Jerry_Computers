import { z } from "zod";
import { indianStates } from "@/lib/customer";

/** Shop details and store rules edited from Admin → Settings. Shared by server and admin forms. */

const text = (max: number) => z.string().trim().max(max).default("");

export const shopSchema = z.object({
  /** Name printed on invoices; defaults to the store name. */
  legalName: text(120),
  address: text(300),
  city: text(60),
  state: z.union([z.enum(indianStates), z.literal("")]).default(""),
  postalCode: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[1-9]\d{5}$/.test(v), "Enter a 6-digit PIN code.")
    .default(""),
  phone: text(30),
  email: z.union([z.string().trim().email("Enter a valid email."), z.literal("")]).default(""),
  serviceEmail: z.union([z.string().trim().email("Enter a valid email."), z.literal("")]).default(""),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), "Enter a valid 15-character GSTIN.")
    .default(""),
  mapUrl: z.union([z.string().trim().url("Enter a full link, starting https://"), z.literal("")]).default(""),
  hours: z.array(z.object({ days: text(40), hours: text(40) })).max(7).default([]),
  social: z.array(z.object({ label: text(30), href: z.string().trim().url() })).max(8).default([]),
});
export type ShopSettings = z.infer<typeof shopSchema>;

export const storeSchema = z.object({
  /** Delivery charge in paise, added to every order. */
  shippingPaise: z.number().int().min(0).max(10_000_00).default(0),
  /** Master switch; each product also has to allow cash on delivery. */
  codEnabled: z.boolean().default(true),
});
export type StoreSettings = z.infer<typeof storeSchema>;

/** Every order carries the delivery charge; there's no free-delivery threshold. */
export function shippingFor(store: StoreSettings) {
  return store.shippingPaise;
}

const line = (max: number, fallback: string) => z.string().trim().min(1).max(max).catch(fallback).default(fallback);

const defaultReasons = [
  { title: "Products and repairs, under one roof.", body: "Buy the hardware and get it installed, serviced or repaired by the same team — no juggling separate shops and technicians." },
  { title: "Service requests, handled properly.", body: "Every job is logged as a service request and moves through clear stages, from intake and diagnosis to repair and testing." },
  { title: "Seven categories, one team.", body: "Laptops, desktops, components, CCTV, printers, UPS and accessories — supported by people who work across all of them." },
  { title: "Know where things stand.", body: "Clear updates on your orders and service requests, plus dedicated technical assistance when you have questions." },
];

/** Homepage copy. Wrap a word in *asterisks* to show it in the accent style. */
export const homeSchema = z.object({
  heroBadge: line(20, "New"),
  heroEyebrow: line(60, "Hardware & service, one counter"),
  heroTitle: line(80, "Technology that *works* for you."),
  heroSubtitle: line(240, "Premium computer hardware, expert repairs and reliable support — from laptops and custom PCs to CCTV, printers and UPS."),
  heroPillars: z.array(z.string().trim().min(1).max(20)).min(1).max(5).catch(["Sales", "Repairs", "Installation", "Support"]).default(["Sales", "Repairs", "Installation", "Support"]),
  /** Uploaded photos for the hero tile wall; empty uses the built-in set. */
  heroImages: z.array(z.string().regex(/^\/uploads\//)).max(40).default([]),
  aboutTitle: line(80, "Hardware and help, in *one* place."),
  aboutBody: line(500, "We sell computer hardware and look after it — installation, repairs and maintenance from the same team, whether it's a laptop, a custom PC, CCTV, a printer or a UPS."),
  reasons: z
    .array(z.object({ title: z.string().trim().min(1).max(80), body: z.string().trim().min(1).max(300) }))
    .length(4)
    .catch(defaultReasons)
    .default(defaultReasons),
  contactTitle: line(80, "Let's get your tech *sorted.*"),
  contactBody: line(240, "Questions about a product, or something that needs fixing? Reach the right team below."),
});
export type HomeSettings = z.infer<typeof homeSchema>;

/** "Technology that *works* for you." → [{ text: "Technology that " }, { text: "works", accent: true }, …] */
export function accentParts(s: string) {
  return s.split(/(\*[^*]+\*)/).filter(Boolean).map((part) => (part.startsWith("*") && part.endsWith("*") ? { text: part.slice(1, -1), accent: true } : { text: part, accent: false }));
}

/** Shop contact details shaped for display, with the address on separate lines. */
export function shopContact(shop: ShopSettings) {
  const address = [shop.address, [shop.city, shop.state].filter(Boolean).join(", ") + (shop.postalCode ? ` ${shop.postalCode}` : "")].map((l) => l.trim()).filter(Boolean).join("\n");
  return {
    address: address || null,
    mapUrl: shop.mapUrl || null,
    phone: shop.phone || null,
    email: shop.email || null,
    serviceEmail: shop.serviceEmail || null,
    hours: shop.hours.filter((h) => h.days && h.hours),
    social: shop.social,
  };
}
