"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCustomer } from "@/lib/server/auth";
import { CATALOGUE_TAG } from "@/lib/server/catalogue";
import { OrderError, placeOrder } from "@/lib/server/orders";

const schema = z.object({
  addressId: z.string().uuid("Choose a delivery address."),
  paymentMethod: z.enum(["cod", "online"], { error: "Choose how you'd like to pay." }),
  note: z
    .string()
    .trim()
    .max(500)
    .transform((v) => v || null),
});

export async function placeOrderAction(_: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const viewer = await requireCustomer();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  let orderId: string;
  try {
    orderId = (await placeOrder(viewer.id, parsed.data)).id;
    // Stock went down.
    updateTag(CATALOGUE_TAG);
  } catch (err) {
    if (err instanceof OrderError) return { error: err.message };
    throw err;
  }
  // Online orders go straight to Razorpay on the order page.
  redirect(`/account/orders/${orderId}?placed=1${parsed.data.paymentMethod === "online" ? "&pay=1" : ""}`);
}
