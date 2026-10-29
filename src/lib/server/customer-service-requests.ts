import "server-only";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ServiceId } from "@/data/services";
import { deviceForVisual, istDay, onlineRequestInput, PREFERENCE_DAYS, type OnlineRequestInput } from "@/lib/service-request-form";
import { serviceNumber } from "@/lib/service-desk";
import { FieldError } from "./admin/catalogue";
import { createServiceRequest } from "./admin/service-requests";
import { isUniqueViolation } from "./admin/tx";
import { db, schema } from "./db";
import { notifyAdmins } from "./notifications";

/** Why a submission can't go ahead, so the form can send the customer to the right place. */
export class SubmitBlocked extends Error {
  constructor(
    public reason: "signin" | "verify" | "disabled",
    message: string,
  ) {
    super(message);
  }
}

export type SubmittedRequest = { id: string; ticket: string; assigned: boolean; engineerFirstName: string | null; duplicate: boolean };

async function existingSubmission(customerId: string, clientRequestId: string): Promise<SubmittedRequest | null> {
  const engineer = alias(schema.users, "engineer");
  const [row] = await db
    .select({ id: schema.serviceRequests.id, seq: schema.serviceRequests.seq, engineerFirst: engineer.firstName })
    .from(schema.serviceRequests)
    .leftJoin(engineer, eq(engineer.id, schema.serviceRequests.assignedEngineerId))
    .where(and(eq(schema.serviceRequests.customerId, customerId), eq(schema.serviceRequests.clientRequestId, clientRequestId)));
  return row ? { id: row.id, ticket: serviceNumber(row.seq), assigned: Boolean(row.engineerFirst), engineerFirstName: row.engineerFirst, duplicate: true } : null;
}

/**
 * A service request from the public request page, for the signed-in customer. Goes through the
 * same createServiceRequest as staff-logged jobs (ticket number, automatic assignment, history).
 * The same clientRequestId returns the first ticket instead of creating another.
 */
export async function createOnlineServiceRequest(customerId: string, input: OnlineRequestInput): Promise<SubmittedRequest> {
  const parsed = onlineRequestInput.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[i.path.join(".")] ??= i.message;
    throw new FieldError(fields);
  }
  const v = parsed.data;

  const [customer] = await db.select().from(schema.users).where(eq(schema.users.id, customerId));
  if (!customer || customer.role !== "customer") throw new SubmitBlocked("signin", "Sign in with a customer account to request a service.");
  if (customer.disabledAt) throw new SubmitBlocked("disabled", "This account has been switched off. Contact the shop.");
  if (!customer.emailVerifiedAt) throw new SubmitBlocked("verify", "Verify your email address before requesting a service.");

  const earlier = await existingSubmission(customerId, v.clientRequestId);
  if (earlier) return earlier;

  const [service] = await db
    .select()
    .from(schema.services)
    .where(and(eq(schema.services.slug, v.serviceSlug), eq(schema.services.isActive, true)));
  if (!service) throw new FieldError({ serviceSlug: "That service isn't available. Choose another." });
  if (v.problemType && !service.includes.includes(v.problemType)) throw new FieldError({ problemType: "Choose a problem from the list, or “Something else”." });

  const today = istDay();
  const last = istDay(new Date(Date.now() + PREFERENCE_DAYS * 86_400_000));
  if (v.preferredDate && (v.preferredDate < today || v.preferredDate > last)) throw new FieldError({ preferredDate: `Choose a day between today and ${PREFERENCE_DAYS} days from now.` });
  if (v.preferredWindow && !v.preferredDate) throw new FieldError({ preferredDate: "Choose a day for that time." });
  if (!customer.phone && !v.phone) throw new FieldError({ phone: "Enter a mobile number so the shop can reach you." });

  try {
    const created = await createServiceRequest(
      customerId,
      {
        customerId,
        contact: v.phone ? { firstName: customer.firstName, lastName: customer.lastName, phone: v.phone, email: "" } : undefined,
        source: "online",
        location: v.location,
        address: v.location === "on_site" ? (v.address as never) : undefined,
        deviceType: deviceForVisual[(service.visual as ServiceId) ?? "diagnostics"] ?? "other",
        deviceBrand: v.deviceBrand,
        deviceModel: v.deviceModel,
        serialNumber: v.serialNumber,
        accessories: "",
        issue: v.issue,
        priority: "normal",
      },
      {
        serviceId: service.id,
        problemType: v.problemType || null,
        preferredDate: v.preferredDate || null,
        preferredWindow: v.preferredWindow || null,
        clientRequestId: v.clientRequestId,
      },
    );
    const ticket = serviceNumber(created.seq);
    await notifyAdmins(db, {
      kind: "service.online",
      title: `New online request ${ticket}`,
      body: `${service.label} · ${v.location === "on_site" ? "on-site" : "in shop"}${created.engineer ? `, assigned to ${created.engineer.firstName}` : ", waiting for an engineer"}`,
      href: `/admin/service-requests/${created.id}`,
    });
    return { id: created.id, ticket, assigned: Boolean(created.engineer), engineerFirstName: created.engineer?.firstName ?? null, duplicate: false };
  } catch (err) {
    // A second click that raced the first one: hand back the ticket the first one created.
    if (isUniqueViolation(err, "service_requests_client_request_key")) {
      const first = await existingSubmission(customerId, v.clientRequestId);
      if (first) return first;
    }
    throw err;
  }
}

/* Reads for the customer's own account: only their requests, and no internal notes. */

const r = schema.serviceRequests;

export async function listMyServiceRequests(customerId: string) {
  const engineer = alias(schema.users, "engineer");
  return db
    .select({ r, serviceLabel: schema.services.label, engineerFirst: engineer.firstName })
    .from(r)
    .leftJoin(schema.services, eq(schema.services.id, r.serviceId))
    .leftJoin(engineer, eq(engineer.id, r.assignedEngineerId))
    .where(eq(r.customerId, customerId))
    .orderBy(desc(r.createdAt))
    .limit(100);
}

export async function getMyServiceRequest(customerId: string, id: string) {
  const engineer = alias(schema.users, "engineer");
  const [row] = await db
    .select({ r, serviceLabel: schema.services.label, serviceTitle: schema.services.title, engineerFirst: engineer.firstName })
    .from(r)
    .leftJoin(schema.services, eq(schema.services.id, r.serviceId))
    .leftJoin(engineer, eq(engineer.id, r.assignedEngineerId))
    .where(and(eq(r.id, id), eq(r.customerId, customerId)));
  if (!row) return null;
  // Status changes only: notes on events are for staff.
  const timeline = await db
    .select({ toStatus: schema.serviceEvents.toStatus, at: schema.serviceEvents.createdAt })
    .from(schema.serviceEvents)
    .where(and(eq(schema.serviceEvents.requestId, id), isNotNull(schema.serviceEvents.toStatus), sql`${schema.serviceEvents.fromStatus} is distinct from ${schema.serviceEvents.toStatus}`))
    .orderBy(asc(schema.serviceEvents.createdAt));
  return { ...row, timeline };
}
