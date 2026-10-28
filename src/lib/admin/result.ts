/** What every admin server action returns to its form. */
export type ActionResult = { ok: true; message: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };
