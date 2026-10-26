import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthFormSkeleton } from "@/components/auth/AuthFormSkeleton";
import { redirectIfSignedIn } from "@/lib/server/auth";
import { googleEnabled } from "@/lib/server/env";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <Register />
    </Suspense>
  );
}

async function Register() {
  await redirectIfSignedIn();
  return <AuthForm mode="register" googleEnabled={googleEnabled} />;
}
