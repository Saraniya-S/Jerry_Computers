import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { ContactDetailsForm, PasswordReset } from "@/components/account/StaffProfileForms";
import { mobileInputValue } from "@/lib/customer";
import { requireStaff } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";

export const metadata: Metadata = { title: "Profile" };

export default function StaffProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const me = await requireStaff(["ecommerce_staff"], "/staff/profile");
  const [user] = await db.select({ firstName: schema.users.firstName, lastName: schema.users.lastName, phone: schema.users.phone, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, me.id));
  return (
    <>
      <PageHeader title="Profile" description={`${user.email} · E-commerce staff`} />
      <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[1fr_360px]">
        <section className="grid gap-4 rounded-xl border border-line p-4 sm:p-5">
          <h2 className="text-sm font-medium text-fg">Contact details</h2>
          <ContactDetailsForm initial={{ firstName: user.firstName, lastName: user.lastName, phone: mobileInputValue(user.phone) }} />
        </section>
        <div className="grid content-start gap-4">
          <section className="grid gap-3 rounded-xl border border-line p-4 text-sm sm:p-5">
            <h2 className="font-medium text-fg">Password</h2>
            <p className="text-fg-muted">We&apos;ll email you a one-time link to set a new password.</p>
            <PasswordReset />
          </section>
          <p className="text-xs text-fg-dim">Your role and access are managed by an admin.</p>
        </div>
      </div>
    </>
  );
}
