import { z } from "zod";
import { addressSchema, contactSchema } from "@/lib/customer";
import type { DeviceType, ServicePriority, ServiceStatus } from "@/lib/server/db/schema";

/** Service desk rules shared by the admin forms, the engineer area and the server. */

export const deviceTypeLabel: Record<DeviceType, string> = {
  laptop: "Laptop",
  desktop: "Desktop",
  cctv: "CCTV system",
  printer: "Printer",
  ups: "UPS",
  other: "Other",
};
export const deviceTypes = Object.keys(deviceTypeLabel) as DeviceType[];

export const serviceStatusLabel: Record<ServiceStatus, string> = {
  open: "Unassigned",
  assigned: "Assigned",
  in_progress: "In progress",
  awaiting_parts: "Awaiting parts",
  completed: "Completed",
  cancelled: "Cancelled",
};
export const serviceStatuses = Object.keys(serviceStatusLabel) as ServiceStatus[];

export const priorityLabel: Record<ServicePriority, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };
export const priorities = Object.keys(priorityLabel) as ServicePriority[];

/**
 * Workload policy: a job counts toward its engineer's active tickets while it is assigned, in
 * progress or awaiting parts. Unassigned (open) jobs belong to nobody; completed and cancelled
 * jobs are closed and never count.
 */
export const ACTIVE_SERVICE_STATUSES = ["assigned", "in_progress", "awaiting_parts"] as const satisfies readonly ServiceStatus[];
export const CLOSED_SERVICE_STATUSES = ["completed", "cancelled"] as const satisfies readonly ServiceStatus[];
export const isActiveStatus = (s: ServiceStatus) => (ACTIVE_SERVICE_STATUSES as readonly ServiceStatus[]).includes(s);
export const isClosedStatus = (s: ServiceStatus) => (CLOSED_SERVICE_STATUSES as readonly ServiceStatus[]).includes(s);

/** Allowed status moves. Assignment itself (open ⇄ assigned) happens through assignment, not here. */
export const serviceFlow: Record<ServiceStatus, ServiceStatus[]> = {
  open: ["cancelled"],
  assigned: ["in_progress", "awaiting_parts", "completed", "cancelled"],
  in_progress: ["awaiting_parts", "completed", "cancelled"],
  awaiting_parts: ["in_progress", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};
/** Engineers move their own jobs along but can't cancel them. */
export const engineerFlow = (from: ServiceStatus) => serviceFlow[from].filter((s) => s !== "cancelled");

export const serviceNumber = (seq: number) => `SR-${String(seq).padStart(6, "0")}`;

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

/** A request created by staff, for an account customer or a walk-in without one. */
export const serviceRequestInput = z
  .object({
    customerId: z.union([z.string().uuid(), z.literal("")]).transform((v) => v || null),
    /** Walk-in / phone contact. Ignored when customerId is set. */
    contact: contactSchema.extend({ email: z.union([z.string().trim().toLowerCase().email("Enter a valid email."), z.literal("")]).transform((v) => v || null) }).optional(),
    source: z.enum(["walk_in", "phone", "online"]),
    location: z.enum(["in_shop", "on_site"]),
    address: addressSchema.extend({ mapsUrl: z.union([z.string().trim().url("Enter a full map link."), z.literal("")]).transform((v) => v || null) }).optional(),
    deviceType: z.enum(deviceTypes as [DeviceType, ...DeviceType[]], { error: "Choose the device type." }),
    deviceBrand: optional(60),
    deviceModel: optional(80),
    serialNumber: optional(80),
    accessories: optional(200),
    issue: z.string().trim().min(5, "Describe the problem.").max(2000),
    priority: z.enum(priorities as [ServicePriority, ...ServicePriority[]]),
  })
  .superRefine((v, ctx) => {
    if (!v.customerId && !v.contact) ctx.addIssue({ code: "custom", path: ["contact"], message: "Choose a customer or enter the walk-in's details." });
    if (v.location === "on_site" && !v.address) ctx.addIssue({ code: "custom", path: ["address"], message: "On-site jobs need the service address." });
  });
export type ServiceRequestInput = z.input<typeof serviceRequestInput>;
