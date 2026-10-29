import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { requireCustomer, returnTo } from "@/lib/server/auth";
import { mobileInputValue } from "@/lib/customer";

export const metadata: Metadata = { title: "Set up your account" };

export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink-950" aria-busy="true" />}>
      <Onboarding searchParams={searchParams} />
    </Suspense>
  );
}

async function Onboarding({ searchParams }: Pick<PageProps<"/onboarding">, "searchParams">) {
  const viewer = await requireCustomer();
  // Where the customer was heading before signing up (e.g. a half-filled service request).
  const next = returnTo("customer", (await searchParams).next);
  if (viewer.onboardedAt) redirect(next);
  return (
    <OnboardingFlow
      firstName={viewer.firstName}
      lastName={viewer.lastName}
      phone={mobileInputValue(viewer.phone)}
      email={viewer.email}
      continueTo={next === "/account" ? undefined : { href: next, label: next.startsWith("/services/request") ? "Continue your service request" : "Continue" }}
    />
  );
}
