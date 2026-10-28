import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { requireCustomer } from "@/lib/server/auth";
import { mobileInputValue } from "@/lib/customer";

export const metadata: Metadata = { title: "Set up your account" };

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink-950" aria-busy="true" />}>
      <Onboarding />
    </Suspense>
  );
}

async function Onboarding() {
  const viewer = await requireCustomer();
  if (viewer.onboardedAt) redirect("/account");
  return <OnboardingFlow firstName={viewer.firstName} lastName={viewer.lastName} phone={mobileInputValue(viewer.phone)} email={viewer.email} />;
}
