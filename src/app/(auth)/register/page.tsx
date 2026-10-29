import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthFormSkeleton } from "@/components/auth/AuthFormSkeleton";
import { redirectIfSignedIn, safeNext } from "@/lib/server/auth";
import { googleEnabled } from "@/lib/server/env";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage({ searchParams }: PageProps<"/register">) {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <Register searchParams={searchParams} />
    </Suspense>
  );
}

async function Register({ searchParams }: Pick<PageProps<"/register">, "searchParams">) {
  await redirectIfSignedIn();
  const { next } = await searchParams;
  // Kept so a new customer comes back to what they were doing (e.g. a service request).
  return <AuthForm mode="register" googleEnabled={googleEnabled} next={typeof next === "string" ? safeNext(next, "") || undefined : undefined} />;
}
