import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { Badge } from "@/components/admin/ui";
import { ContactDetailsForm, PasswordReset } from "@/components/account/StaffProfileForms";
import { mobileInputValue } from "@/lib/customer";
import { requireStaff } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { deviceTypeLabel } from "@/lib/service-desk";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const me = await requireStaff(["engineer"]);
  const [[user], [profile]] = await Promise.all([
    db.select({ firstName: schema.users.firstName, lastName: schema.users.lastName, phone: schema.users.phone, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, me.id)),
    db.select().from(schema.engineerProfiles).where(eq(schema.engineerProfiles.userId, me.id)),
  ]);
  return (
    <>
      <PageHeader title="Profile" description={user.email} />
      <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[1fr_360px]">
        <section className="grid gap-4 rounded-xl border border-line p-4 sm:p-5">
          <h2 className="text-sm font-medium text-fg">Contact details</h2>
          <ContactDetailsForm initial={{ firstName: user.firstName, lastName: user.lastName, phone: mobileInputValue(user.phone) }} />
        </section>
        <div className="grid content-start gap-4">
          <section className="grid gap-3 rounded-xl border border-line p-4 text-sm sm:p-5">
            <h2 className="font-medium text-fg">Job settings</h2>
            <p className="flex flex-wrap gap-1.5">
              {(profile?.isAvailable ?? true) ? <Badge tone="good">Available for new jobs</Badge> : <Badge tone="warn">Not taking new jobs</Badge>}
              {(profile?.takesOnSite ?? true) ? <Badge>On-site visits</Badge> : <Badge tone="muted">In-shop only</Badge>}
            </p>
            <p className="text-fg-muted">Devices: {profile?.skills.length ? profile.skills.map((s) => deviceTypeLabel[s]).join(", ") : "all types"}</p>
            <p className="text-xs text-fg-dim">These decide which new jobs reach you, so an admin sets them. Ask the shop if they need changing.</p>
          </section>
          <section className="grid gap-3 rounded-xl border border-line p-4 text-sm sm:p-5">
            <h2 className="font-medium text-fg">Password</h2>
            <p className="text-fg-muted">We&apos;ll email you a one-time link to set a new password.</p>
            <PasswordReset />
          </section>
        </div>
      </div>
    </>
  );
}
