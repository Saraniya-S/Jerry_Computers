import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthFormSkeleton } from "@/components/auth/AuthFormSkeleton";
import { OtpForm } from "@/components/auth/OtpForm";
import { safeNext } from "@/lib/server/auth";
import { describeChallenge } from "@/lib/server/otp";
import { getChallengeCookie } from "@/lib/server/session";

export const metadata: Metadata = { title: "Enter your code" };

export default function VerifyPage({ searchParams }: PageProps<"/verify">) {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <Verify searchParams={searchParams} />
    </Suspense>
  );
}

async function Verify({ searchParams }: Pick<PageProps<"/verify">, "searchParams">) {
  const [{ next, remember }, challengeId] = await Promise.all([searchParams, getChallengeCookie()]);
  // Expiry and the resend countdown depend on the current time.
  await connection();
  const challenge = challengeId ? await describeChallenge(challengeId) : null;

  if (!challenge) {
    return (
      <div>
        <h1 className="text-[2.2rem] font-medium leading-[1.05] tracking-[-0.04em] text-fg">
          This code has <span className="font-serif font-normal italic text-brand">expired</span>
        </h1>
        <p className="mt-3 text-[0.95rem] text-fg-muted">Codes last 10 minutes. Sign in again and we&apos;ll send a new one.</p>
        <Link
          href="/login"
          className="mt-8 flex h-12 items-center justify-center rounded-full bg-brand text-[0.95rem] font-medium text-white transition-colors hover:bg-[var(--brand-hover)]"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <OtpForm
      // Next keeps visited routes alive; a new challenge must start with fresh boxes and countdown.
      key={challenge.resendAvailableAt.getTime()}
      purpose={challenge.purpose}
      email={maskEmail(challenge.email)}
      resendAvailableAt={challenge.resendAvailableAt.getTime()}
      next={typeof next === "string" ? safeNext(next, "") || undefined : undefined}
      remember={remember !== "0"}
    />
  );
}

/** "jane.doe@gmail.com" → "ja•••••@gmail.com" */
function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}${"•".repeat(Math.max(2, Math.min(6, local.length - 2)))}@${domain}`;
}
