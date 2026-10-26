import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthFormSkeleton } from "@/components/auth/AuthFormSkeleton";
import { redirectIfSignedIn, safeNext } from "@/lib/server/auth";
import { googleEnabled } from "@/lib/server/env";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <Login searchParams={searchParams} />
    </Suspense>
  );
}

async function Login({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  await redirectIfSignedIn();
  const { next, error } = await searchParams;
  return (
    <AuthForm
      mode="login"
      googleEnabled={googleEnabled}
      next={typeof next === "string" ? safeNext(next, "") || undefined : undefined}
      errorCode={typeof error === "string" ? error : undefined}
    />
  );
}
