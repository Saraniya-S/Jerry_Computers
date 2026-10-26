"use client";

import Link from "next/link";
import { MailCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useActionState, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { resendCode, verifyCode, type FormState } from "@/app/(auth)/actions";
import { AuthHeading, FormAlert, item, list, SubmitButton } from "./ui";

const LENGTH = 6;
const COOLDOWN_MS = 60_000;
const empty = () => Array<string>(LENGTH).fill("");

type Props = {
  purpose: "register" | "login";
  /** Masked address the code went to. */
  email: string;
  /** Epoch ms when "Resend" unlocks. */
  resendAvailableAt: number;
  next?: string;
  remember: boolean;
};

/** Six single-digit boxes for the emailed code. Typing advances, pasting fills, the last digit submits. */
export function OtpForm({ purpose, email, resendAvailableAt, next, remember }: Props) {
  const reduce = useReducedMotion();
  const [digits, setDigits] = useState(empty);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, action] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await verifyCode(prev, formData);
    // A wrong code clears the boxes so the next attempt starts fresh.
    setDigits(empty());
    requestAnimationFrame(() => inputs.current[0]?.focus());
    return result;
  }, {});

  const [unlockAt, setUnlockAt] = useState(resendAvailableAt);
  const [resendState, resendAction, resending] = useActionState<FormState>(async () => {
    const result = await resendCode();
    if (result.message) {
      setUnlockAt(Date.now() + COOLDOWN_MS);
      setDigits(empty());
    }
    return result;
  }, {});

  // The clock starts after hydration so server and client render the same first frame.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  const wait = now === null ? null : Math.max(0, Math.ceil((unlockAt - now) / 1000));

  useEffect(() => inputs.current[0]?.focus(), []);

  function fill(start: number, chars: string) {
    const clean = chars.replace(/\D/g, "").slice(0, LENGTH - start);
    if (!clean) return;
    const nextDigits = [...digits];
    for (let i = 0; i < clean.length; i++) nextDigits[start + i] = clean[i];
    setDigits(nextDigits);
    const last = Math.min(start + clean.length, LENGTH - 1);
    inputs.current[last]?.focus();
  }

  // Submit once all six digits are in, after the hidden "code" field has the new value.
  const code = digits.join("");
  const submitted = useRef("");
  useEffect(() => {
    if (code.length === LENGTH && submitted.current !== code) {
      submitted.current = code;
      formRef.current?.requestSubmit();
    }
    if (code.length < LENGTH) submitted.current = "";
  }, [code]);

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      const nextDigits = [...digits];
      nextDigits[i - 1] = "";
      setDigits(nextDigits);
      inputs.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      inputs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < LENGTH - 1) {
      inputs.current[i + 1]?.focus();
    }
  }

  function onPaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    fill(i, e.clipboardData.getData("text"));
  }

  const codeError = state.fieldErrors?.code;

  return (
    <motion.div variants={list} initial={reduce ? false : "hidden"} animate="show">
      <motion.div variants={item} className="mb-6 grid size-12 place-items-center rounded-2xl bg-mint-soft text-leaf">
        <MailCheck className="size-6" aria-hidden />
      </motion.div>
      <AuthHeading title={purpose === "register" ? "Verify your" : "Check your"} accent={purpose === "register" ? "email" : "inbox"}>
        <p>
          We sent a 6-digit code to <span className="font-medium text-fg">{email}</span>. It expires in 10 minutes.
        </p>
      </AuthHeading>

      <motion.form ref={formRef} variants={item} action={action} className="mt-8">
        <input type="hidden" name="code" value={code} />
        {next && <input type="hidden" name="next" value={next} />}
        {!remember && <input type="hidden" name="remember" value="0" />}

        <fieldset>
          <legend className="sr-only">Verification code</legend>
          <div className="grid grid-cols-6 gap-2 sm:gap-2.5">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={d}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  if (value.length > 1) fill(i, value);
                  else if (value) fill(i, value);
                  else setDigits((cur) => cur.map((c, j) => (j === i ? "" : c)));
                }}
                onKeyDown={(e) => onKeyDown(i, e)}
                onPaste={(e) => onPaste(i, e)}
                onFocus={(e) => e.target.select()}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={LENGTH}
                aria-label={`Digit ${i + 1}`}
                aria-invalid={codeError ? true : undefined}
                style={{ outline: "none" }}
                className={`aspect-[4/5] w-full rounded-2xl border bg-ink-950 text-center font-mono text-2xl font-semibold text-fg caret-brand transition-[border-color,background-color,box-shadow] focus:bg-ink-850 focus:ring-4 ${
                  codeError
                    ? "border-red-400 focus:border-red-500 focus:ring-red-500/15"
                    : d
                      ? "border-brand/40 focus:border-brand focus:ring-[var(--brand-glow)]"
                      : "border-line-strong focus:border-brand focus:ring-[var(--brand-glow)]"
                }`}
              />
            ))}
          </div>
        </fieldset>

        <div className="mt-4 grid gap-3">
          {codeError && <FormAlert>{codeError}</FormAlert>}
          {state.error && <FormAlert>{state.error}</FormAlert>}
          {resendState.message && !codeError && <FormAlert tone="success">{resendState.message}</FormAlert>}
          {resendState.error && <FormAlert>{resendState.error}</FormAlert>}
        </div>

        <SubmitButton pendingLabel="Verifying…">{purpose === "register" ? "Verify and continue" : "Verify and sign in"}</SubmitButton>
      </motion.form>

      <motion.div variants={item} className="mt-6 flex flex-wrap items-center justify-between gap-2 text-sm">
        <form action={resendAction}>
          <button
            type="submit"
            disabled={wait === null || wait > 0 || resending}
            className="font-medium text-brand transition-opacity hover:underline hover:underline-offset-4 disabled:cursor-not-allowed disabled:text-fg-dim disabled:no-underline"
          >
            {resending ? "Sending…" : wait ? `Resend code in ${wait}s` : "Resend code"}
          </button>
        </form>
        <Link href="/login" className="text-fg-muted hover:text-fg">
          Use a different account
        </Link>
      </motion.div>
    </motion.div>
  );
}
