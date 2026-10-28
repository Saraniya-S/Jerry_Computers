import { z } from "zod";
import { addressSchema, contactSchema } from "@/lib/customer";
import { parsePin } from "@/lib/service-location";
import type { DeviceType, ServiceNoteKind, ServicePriority, ServiceStatus } from "@/lib/server/db/schema";

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
  accepted: "Accepted",
  in_progress: "In progress",
  awaiting_parts: "Awaiting parts",
  awaiting_customer: "Awaiting customer",
  unable_to_complete: "Unable to complete",
  completed: "Completed",
  cancelled: "Cancelled",
};
export const serviceStatuses = Object.keys(serviceStatusLabel) as ServiceStatus[];

export const priorityLabel: Record<ServicePriority, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };
export const priorities = Object.keys(priorityLabel) as ServicePriority[];

/**
 * Workload policy: a job counts toward its engineer's active tickets from assignment until it is
 * completed, cancelled or handed back as unable to complete. Unassigned (open) jobs belong to
 * nobody. unable_to_complete waits for an admin to reassign or cancel it.
 */
export const ACTIVE_SERVICE_STATUSES = ["assigned", "accepted", "in_progress", "awaiting_parts", "awaiting_customer"] as const satisfies readonly ServiceStatus[];
export const CLOSED_SERVICE_STATUSES = ["completed", "cancelled"] as const satisfies readonly ServiceStatus[];
/** Not finished, and something an admin may still act on (assign, reassign, cancel). */
export const OPEN_FOR_ADMIN_STATUSES = ["open", ...ACTIVE_SERVICE_STATUSES, "unable_to_complete"] as const satisfies readonly ServiceStatus[];
export const isActiveStatus = (s: ServiceStatus) => (ACTIVE_SERVICE_STATUSES as readonly ServiceStatus[]).includes(s);
export const isClosedStatus = (s: ServiceStatus) => (CLOSED_SERVICE_STATUSES as readonly ServiceStatus[]).includes(s);

/** Status moves an admin may make. Assignment itself (open, unable_to_complete → assigned) goes through assignment, not here. */
export const serviceFlow: Record<ServiceStatus, ServiceStatus[]> = {
  open: ["cancelled"],
  assigned: ["accepted", "in_progress", "awaiting_parts", "awaiting_customer", "completed", "cancelled"],
  accepted: ["in_progress", "awaiting_parts", "awaiting_customer", "completed", "cancelled"],
  in_progress: ["awaiting_parts", "awaiting_customer", "completed", "cancelled"],
  awaiting_parts: ["in_progress", "completed", "cancelled"],
  awaiting_customer: ["in_progress", "completed", "cancelled"],
  unable_to_complete: ["cancelled"],
  completed: [],
  cancelled: [],
};

/** Status moves the assigned engineer may make. Engineers never cancel; they hand a job back as unable to complete. */
const engineerMoves: Record<ServiceStatus, ServiceStatus[]> = {
  open: [],
  assigned: ["accepted", "unable_to_complete"],
  accepted: ["in_progress", "awaiting_customer", "unable_to_complete"],
  in_progress: ["awaiting_parts", "awaiting_customer", "completed", "unable_to_complete"],
  awaiting_parts: ["in_progress", "unable_to_complete"],
  awaiting_customer: ["in_progress", "unable_to_complete"],
  unable_to_complete: [],
  completed: [],
  cancelled: [],
};
export const engineerFlow = (from: ServiceStatus) => engineerMoves[from];

/** Moves that must explain themselves. */
export const NOTE_REQUIRED_STATUSES = ["awaiting_parts", "awaiting_customer", "unable_to_complete", "completed", "cancelled"] as const satisfies readonly ServiceStatus[];
export const noteRequiredFor = (s: ServiceStatus) => (NOTE_REQUIRED_STATUSES as readonly ServiceStatus[]).includes(s);
export const notePrompt: Partial<Record<ServiceStatus, string>> = {
  awaiting_parts: "Which parts, and when are they expected?",
  awaiting_customer: "What are you waiting for from the customer?",
  unable_to_complete: "Why it can't be completed",
  completed: "What was done",
  cancelled: "Why it's cancelled",
};

export const noteKindLabel: Record<ServiceNoteKind, string> = {
  note: "Note",
  inspection: "Initial inspection",
  diagnosis: "Diagnosis",
  work_done: "Work performed",
  parts_used: "Parts used",
  parts_required: "Parts required",
  customer_feedback: "Customer feedback",
  completion: "Completion report",
  follow_up: "Follow-up recommendation",
};
/** Kinds an engineer can add as a work report entry (completion is written by completing the job). */
export const reportKinds = ["inspection", "diagnosis", "work_done", "parts_used", "parts_required", "customer_feedback", "follow_up", "note"] as const satisfies readonly ServiceNoteKind[];

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
    address: addressSchema
      .extend({
        mapsUrl: z.union([z.string().trim().url("Enter a full map link."), z.literal("")]).transform((v) => v || null),
        /** Optional "latitude, longitude" from a dropped pin. */
        pin: z
          .string()
          .trim()
          .max(60)
          .default("")
          .transform((v, ctx) => {
            if (!v) return null;
            const p = parsePin(v);
            if (!p) {
              ctx.addIssue({ code: "custom", message: "Enter it as latitude, longitude, e.g. 12.9716, 80.2209." });
              return z.NEVER;
            }
            return p;
          }),
      })
      .transform(({ pin, ...a }) => ({ ...a, latitude: pin?.latitude ?? null, longitude: pin?.longitude ?? null }))
      .optional(),
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
