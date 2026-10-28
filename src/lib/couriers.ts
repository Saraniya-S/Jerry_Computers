import { z } from "zod";

/**
 * Couriers staff can pick when dispatching. Tracking is recorded by staff: no courier API is
 * connected, so the app never fetches or invents tracking events. To add live tracking, write a
 * provider that turns a courier's webhook or API response into shipment events with
 * source = "<courier>-api" (see recordShipmentEvent in src/lib/server/admin/shipments.ts).
 */
export const couriers = [
  { code: "bluedart", name: "Blue Dart" },
  { code: "dtdc", name: "DTDC" },
  { code: "delhivery", name: "Delhivery" },
  { code: "indiapost", name: "India Post (Speed Post)" },
  { code: "professional", name: "The Professional Couriers" },
  { code: "ecom", name: "Ecom Express" },
  { code: "xpressbees", name: "Xpressbees" },
  { code: "own", name: "Own delivery (shop staff)" },
  { code: "other", name: "Other courier" },
] as const;
export type CourierCode = (typeof couriers)[number]["code"];

export const shipmentStatusLabel = {
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  returned: "Returned to shop",
  lost: "Lost",
} as const;

/** Statuses a shipment can move to from each status. delivered, returned and lost are final. */
export const shipmentFlow = {
  in_transit: ["out_for_delivery", "delivered", "returned", "lost"],
  out_for_delivery: ["in_transit", "delivered", "returned", "lost"],
  delivered: [],
  returned: [],
  lost: [],
} as const satisfies Record<keyof typeof shipmentStatusLabel, readonly (keyof typeof shipmentStatusLabel)[]>;

export const dispatchInput = z
  .object({
    courierCode: z.enum(couriers.map((c) => c.code) as [CourierCode, ...CourierCode[]], { error: "Choose the courier." }),
    /** Required for "other". */
    courierName: z.string().trim().max(80).default(""),
    trackingNumber: z
      .string()
      .trim()
      .min(3, "Enter the tracking (AWB) number.")
      .max(60)
      .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only."),
    trackingUrl: z.union([z.string().trim().url("Enter a full link, starting https://").startsWith("https://", "Use an https:// link."), z.literal("")]).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.courierCode === "other" && !v.courierName) ctx.addIssue({ code: "custom", path: ["courierName"], message: "Enter the courier's name." });
  });
export type DispatchInput = z.input<typeof dispatchInput>;

export function courierName(v: { courierCode: CourierCode; courierName: string }) {
  return v.courierCode === "other" ? v.courierName : couriers.find((c) => c.code === v.courierCode)!.name;
}
