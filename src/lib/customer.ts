import { z } from "zod";
import { productCategories, type ProductCategoryId } from "@/data/products";

/** Customer profile and address rules, shared by the forms and the server actions. */

export const indianStates = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export const addressLabels = ["Home", "Office", "Shop", "Other"] as const;

/** Digits of an Indian mobile number without the +91, or null if it isn't one. */
export function mobileDigits(value: string) {
  let d = value.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

export function formatMobile(digits: string) {
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

/** The 10-digit part of a stored "+91 xxxxx xxxxx" number, for editing. */
export function mobileInputValue(stored: string | null | undefined) {
  return stored ? (mobileDigits(stored) ?? stored) : "";
}

const mobile = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const d = mobileDigits(v);
    if (!d) {
      ctx.addIssue({ code: "custom", message: "Enter a 10-digit Indian mobile number." });
      return z.NEVER;
    }
    return formatMobile(d);
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

export const addressSchema = z.object({
  label: z.enum(addressLabels, { error: "Choose a label." }),
  recipientName: z.string().trim().min(1, "Enter who should receive it.").max(80),
  phone: mobile,
  line1: z.string().trim().min(3, "Enter the house or building and street.").max(120),
  line2: optionalText(120),
  landmark: optionalText(80),
  city: z.string().trim().min(2, "Enter the city or town.").max(60),
  state: z.enum(indianStates, { error: "Choose a state." }),
  postalCode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, "Enter a 6-digit PIN code."),
});
export type AddressInput = z.infer<typeof addressSchema>;

const categoryIds = productCategories.map((c) => c.id) as [ProductCategoryId, ...ProductCategoryId[]];

export const preferencesSchema = z
  .object({
    customerType: z.enum(["personal", "business"]).default("personal"),
    companyName: optionalText(120),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => v === "" || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), "Enter a valid 15-character GSTIN.")
      .transform((v) => v || null),
    whatsappUpdates: z.boolean().default(false),
    interests: z.array(z.enum(categoryIds)).max(categoryIds.length).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.customerType === "business" && !v.companyName) {
      ctx.addIssue({ code: "custom", path: ["companyName"], message: "Enter your company name." });
    }
  });

export const contactSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(60),
  lastName: z.string().trim().max(60),
  phone: mobile,
});

/** Turns a zod error into { field: firstMessage }. */
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}
