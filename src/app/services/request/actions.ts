"use server";

import { ZodError } from "zod";
import { FieldError } from "@/lib/server/admin/catalogue";
import { AdminError } from "@/lib/server/admin/tx";
import { createOnlineServiceRequest, SubmitBlocked, type SubmittedRequest } from "@/lib/server/customer-service-requests";
import { getSessionUser } from "@/lib/server/session";
import type { OnlineRequestInput } from "@/lib/service-request-form";

export type SubmitResult =
  | { ok: true; request: SubmittedRequest }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; blocked?: "signin" | "verify" | "disabled" | "staff" };

/**
 * Sends the request form. The customer comes from the session, never from the form; the request is
 * created by the same service-desk code staff use, so it gets a real ticket and is auto-assigned.
 */
export async function submitServiceRequestAction(input: OnlineRequestInput): Promise<SubmitResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, blocked: "signin", error: "Sign in or create an account to send your request. Your answers are kept." };
  if (user.role !== "customer") return { ok: false, blocked: "staff", error: "Service requests are sent from a customer account. Staff log jobs from their own area." };
  try {
    return { ok: true, request: await createOnlineServiceRequest(user.id, input) };
  } catch (err) {
    if (err instanceof SubmitBlocked) return { ok: false, blocked: err.reason, error: err.message };
    if (err instanceof FieldError) return { ok: false, error: "Some details need another look.", fieldErrors: err.fields };
    if (err instanceof AdminError) return { ok: false, error: err.message };
    if (err instanceof ZodError) return { ok: false, error: err.issues[0]?.message ?? "Some details aren't valid." };
    console.error("[services] request failed", err);
    return { ok: false, error: "We couldn't send your request just now. Please try again; your answers are kept." };
  }
}
