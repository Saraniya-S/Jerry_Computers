import { z } from "zod";
import type { DeviceType } from "@/lib/server/db/schema";
import type { ServiceId } from "@/data/services";

/** Rules for the public Request a Service form, shared by the form (per-step checks) and the server. */

/** Which device type each service catalogue illustration stands for. */
export const deviceForVisual: Record<ServiceId, DeviceType> = {
  laptop: "laptop",
  desktop: "desktop",
  cctv: "cctv",
  printer: "printer",
  ups: "ups",
  diagnostics: "other",
};

export const preferredWindows = [
  { value: "morning", label: "Morning (9 am – 12 pm)" },
  { value: "afternoon", label: "Afternoon (12 – 4 pm)" },
  { value: "evening", label: "Evening (4 – 7 pm)" },
] as const;
export type PreferredWindow = (typeof preferredWindows)[number]["value"];

const prefDay = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/** "Mon, 2 Nov · Morning", or null when the customer gave no preference. */
export function preferredLabel(date: string | null | undefined, window: string | null | undefined) {
  if (!date) return null;
  const w = preferredWindows.find((x) => x.value === window)?.label.split(" (")[0];
  return `${prefDay.format(new Date(`${date}T12:00:00+05:30`))}${w ? ` · ${w}` : ""}`;
}

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .default("");

/** yyyy-mm-dd in shop time (IST). */
export const istDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
export const PREFERENCE_DAYS = 30;

export const stepDevice = z.object({
  deviceBrand: optional(60),
  deviceModel: z.string().trim().min(1, "Enter the model or the name of the device.").max(80),
  serialNumber: optional(80),
  issue: z.string().trim().min(10, "Tell us a bit more about the problem (at least 10 characters).").max(2000),
});

export const stepService = z.object({
  serviceSlug: z.string().trim().min(1, "Choose a service."),
  /** One of the service's listed problems, or "" for something else. */
  problemType: optional(120),
});

export const onlineRequestInput = stepService.merge(stepDevice).extend({
  location: z.enum(["in_shop", "on_site"], { error: "Choose on-site or in-shop service." }),
  /** For on-site: the address form's values plus an optional "lat, lng" pin. */
  address: z.unknown().optional(),
  /** Needed only if the account has no mobile number. */
  phone: optional(20),
  preferredDate: z
    .string()
    .trim()
    .default("")
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Choose a valid date."),
  preferredWindow: z.union([z.enum(preferredWindows.map((w) => w.value) as [PreferredWindow, ...PreferredWindow[]]), z.literal("")]).default(""),
  clientRequestId: z.string().uuid(),
});
export type OnlineRequestInput = z.input<typeof onlineRequestInput>;

/** Customer-facing wording for job statuses. Internal hand-backs read as "being reviewed". */
export const customerStatusLabel: Record<string, string> = {
  open: "Received",
  assigned: "Engineer assigned",
  accepted: "Accepted by engineer",
  in_progress: "In progress",
  awaiting_parts: "Waiting for parts",
  awaiting_customer: "Waiting for you",
  unable_to_complete: "Being reviewed by the shop",
  completed: "Completed",
  cancelled: "Cancelled",
};
