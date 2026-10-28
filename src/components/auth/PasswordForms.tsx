"use client";

import Link from "next/link";
import { Eye, EyeOff, KeyRound, LockKeyhole, Mail, MailCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useActionState, useState } from "react";
import { requestPasswordReset, setPasswordAction, type FormState } from "@/app/(auth)/actions";
import { AuthHeading, Field, FormAlert, item, list, SubmitButton } from "./ui";

export function ForgotPasswordForm() {
  const reduce = useReducedMotion();
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {});
  return (
    <motion.div variants={list} initial={reduce ? false : "hidden"} animate="show">
      <motion.div variants={item} className="mb-6 grid size-12 place-items-center rounded-2xl bg-mint-soft text-leaf">
        <KeyRound className="size-6" aria-hidden />
      </motion.div>
      <AuthHeading title="Forgot your" accent="password?">
        <p>Enter your email and we&apos;ll send a link to choose a new one.</p>
      </AuthHeading>
      {state.message ? (
        <motion.div variants={item} className="mt-8 grid gap-4">
          <FormAlert tone="success">{state.message}</FormAlert>
          <Link href="/login" className="text-sm font-medium text-brand hover:underline">
            Back to sign in
          </Link>
        </motion.div>
      ) : (
        <motion.form variants={item} action={action} noValidate className="mt-8 grid gap-3">
          <Field icon={Mail} label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.fieldErrors?.email} />
          <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
          <Link href="/login" className="mt-2 text-center text-sm text-fg-muted hover:text-fg">
            Remembered it? Sign in
          </Link>
        </motion.form>
      )}
    </motion.div>
  );
}

export function SetPasswordForm({ token, name, email, invite }: { token: string; name: string; email: string; invite: boolean }) {
  const reduce = useReducedMotion();
  const [state, action] = useActionState<FormState, FormData>(setPasswordAction, {});
  const [show, setShow] = useState(false);
  const fe = state.fieldErrors ?? {};
  const toggle = (
    <button
      type="button"
      onClick={() => setShow((s) => !s)}
      className="grid size-8 place-items-center rounded-full text-fg-dim transition-colors hover:bg-ink-900 hover:text-fg"
      aria-label={show ? "Hide password" : "Show password"}
    >
      {show ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
    </button>
  );
  return (
    <motion.div variants={list} initial={reduce ? false : "hidden"} animate="show">
      <motion.div variants={item} className="mb-6 grid size-12 place-items-center rounded-2xl bg-mint-soft text-leaf">
        <MailCheck className="size-6" aria-hidden />
      </motion.div>
      <AuthHeading title={invite ? `Welcome, ${name}` : "Choose a new"} accent={invite ? "" : "password"}>
        <p>
          {invite ? "Set a password for " : "For "}
          <span className="font-medium text-fg">{email}</span>. Use at least 8 characters.
        </p>
      </AuthHeading>
      <motion.form variants={item} action={action} noValidate className="mt-8 grid gap-3">
        <input type="hidden" name="token" value={token} />
        {state.error && <FormAlert>{state.error}</FormAlert>}
        <Field icon={LockKeyhole} label="New password" name="password" type={show ? "text" : "password"} autoComplete="new-password" required error={fe.password} trailing={toggle} />
        <Field icon={LockKeyhole} label="Repeat password" name="confirm" type={show ? "text" : "password"} autoComplete="new-password" required error={fe.confirm} />
        <SubmitButton pendingLabel="Saving…">{invite ? "Set password" : "Save new password"}</SubmitButton>
      </motion.form>
    </motion.div>
  );
}
