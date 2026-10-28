import "server-only";
import { ZodError } from "zod";
import type { ActionResult } from "@/lib/admin/result";
import { OrderError } from "../orders";
import { FieldError } from "./catalogue";
import { AdminError } from "./tx";

/**
 * Runs an admin mutation and turns rule violations into a result the form can show. Anything
 * unexpected (including Next.js redirects from auth checks) is rethrown.
 */
export async function attempt(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    return { ok: true, message: await fn() };
  } catch (err) {
    if (err instanceof FieldError) return { ok: false, error: err.message, fieldErrors: err.fields };
    if (err instanceof AdminError || err instanceof OrderError) return { ok: false, error: err.message };
    if (err instanceof ZodError) return { ok: false, error: err.issues[0]?.message ?? "Some of the details aren't valid." };
    throw err;
  }
}

export const uuidOrNull = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
