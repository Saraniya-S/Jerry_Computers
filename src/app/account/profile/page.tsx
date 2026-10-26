import type { Metadata } from "next";
import { BadgeCheck, LogOut } from "lucide-react";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { ProfileForm } from "@/components/account/ProfileForm";
import { GoogleIcon } from "@/components/auth/ui";
import { requireCustomer } from "@/lib/server/auth";
import { signOutEverywhere } from "../actions";

export const metadata: Metadata = { title: "Profile & security" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const viewer = await requireCustomer();
  return (
    <>
      <PageHeader title="Profile & security" description="Your contact details and how you sign in." />
      <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[220px_1fr] lg:gap-10">
        <SectionIntro title="Personal details" text="Used on orders, invoices and service tickets." />
        <ProfileForm firstName={viewer.firstName} lastName={viewer.lastName} phone={viewer.phone ?? ""} />

        <hr className="border-line lg:col-span-2" />

        <SectionIntro title="Email" text="Codes and order updates go here." />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-ink-950 px-4 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-fg">{viewer.email}</p>
            <p className="text-xs text-fg-dim">To change your email, contact the shop.</p>
          </div>
          {viewer.emailVerifiedAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-mint-soft px-2.5 py-1 text-xs font-medium text-leaf">
              <BadgeCheck className="size-3.5" aria-hidden /> Verified {dateFmt.format(viewer.emailVerifiedAt)}
            </span>
          )}
        </div>

        <hr className="border-line lg:col-span-2" />

        <SectionIntro title="Sign-in methods" text="Signing in with a password also asks for a code by email." />
        <ul className="divide-y divide-line rounded-xl border border-line">
          <li className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm">
            <span className="text-fg">Email &amp; password</span>
            <span className={viewer.hasPassword ? "text-leaf-mid" : "text-fg-dim"}>{viewer.hasPassword ? "On" : "Not set"}</span>
          </li>
          <li className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm">
            <span className="flex items-center gap-2 text-fg">
              <GoogleIcon /> Google
            </span>
            <span className={viewer.hasGoogle ? "text-leaf-mid" : "text-fg-dim"}>{viewer.hasGoogle ? "Connected" : "Not connected"}</span>
          </li>
        </ul>

        <hr className="border-line lg:col-span-2" />

        <SectionIntro title="Sessions" text="Signed in on a shared or lost device?" />
        <form action={signOutEverywhere} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3.5">
          <p className="text-sm text-fg-muted">Sign out of every device, including this one.</p>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-red-300 px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
          >
            <LogOut className="size-4" aria-hidden /> Sign out everywhere
          </button>
        </form>
      </div>
    </>
  );
}

function SectionIntro({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-sm font-medium text-fg">{title}</h2>
      <p className="mt-1 text-sm text-fg-muted">{text}</p>
    </div>
  );
}
