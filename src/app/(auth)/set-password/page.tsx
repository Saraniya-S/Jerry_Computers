import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthFormSkeleton } from "@/components/auth/AuthFormSkeleton";
import { SetPasswordForm } from "@/components/auth/PasswordForms";
import { peekPasswordToken } from "@/lib/server/password-tokens";

export const metadata: Metadata = { title: "Set password" };

export default function SetPasswordPage({ searchParams }: PageProps<"/set-password">) {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <SetPassword searchParams={searchParams} />
    </Suspense>
  );
}

async function SetPassword({ searchParams }: Pick<PageProps<"/set-password">, "searchParams">) {
  const { token } = await searchParams;
  const found = typeof token === "string" ? await peekPasswordToken(token) : null;
  if (!found) {
    return (
      <div>
        <h1 className="text-[2.2rem] font-medium leading-[1.05] tracking-[-0.04em] text-fg">
          This link has <span className="font-serif font-normal italic text-brand">expired</span>
        </h1>
        <p className="mt-3 text-[0.95rem] text-fg-muted">Links work once. Ask for a new reset link, or ask an admin to resend your invitation.</p>
        <Link href="/forgot-password" className="mt-8 flex h-12 items-center justify-center rounded-full bg-brand text-[0.95rem] font-medium text-white hover:bg-[var(--brand-hover)]">
          Get a new link
        </Link>
      </div>
    );
  }
  return <SetPasswordForm token={token as string} name={found.user.firstName} email={found.user.email} invite={found.token.purpose === "invite"} />;
}
