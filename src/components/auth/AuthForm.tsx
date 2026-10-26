"use client";

import Link from "next/link";
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useActionState, useState } from "react";
import { login, register, type FormState } from "@/app/(auth)/actions";
import { AuthHeading, Field, FormAlert, GoogleIcon, item, list, SubmitButton } from "./ui";

type Mode = "login" | "register";

const copy = {
  login: {
    title: "Welcome",
    accent: "back",
    intro: "Sign in to follow your orders and service requests.",
    submit: "Log in",
    pending: "Checking…",
  },
  register: {
    title: "Create your",
    accent: "account",
    intro: "One account for purchases, repairs and support.",
    submit: "Create account",
    pending: "Creating account…",
  },
} satisfies Record<Mode, Record<string, string>>;

const queryErrors: Record<string, string> = {
  google_unavailable: "Google sign-in isn't set up yet. Use your email and password.",
  google_failed: "Google sign-in didn't complete. Please try again.",
  google_unverified: "That Google account's email isn't verified with Google.",
  google_staff: "Staff, engineer and admin accounts sign in with email and password.",
};

type Props = {
  mode: Mode;
  googleEnabled: boolean;
  /** Where to go after signing in, already checked to be a local path. */
  next?: string;
  /** An error code from the URL, e.g. after a failed Google sign-in. */
  errorCode?: string;
};

/** Sign-in / sign-up form. Both steps end on the emailed one-time code screen. */
export function AuthForm({ mode, googleEnabled, next, errorCode }: Props) {
  const reduce = useReducedMotion();
  const [state, action] = useActionState<FormState, FormData>(mode === "login" ? login : register, {});
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [forgotNote, setForgotNote] = useState(false);
  const t = copy[mode];
  const v = state.values ?? {};
  const fe = state.fieldErrors ?? {};
  const topError = state.error ?? (errorCode ? queryErrors[errorCode] : undefined);

  return (
    <motion.div key={mode} variants={list} initial={reduce ? false : "hidden"} animate="show">
      <AuthHeading title={t.title} accent={t.accent}>
        <p>{t.intro}</p>
      </AuthHeading>

      <motion.div variants={item} className="mt-8">
        {googleEnabled ? (
          <a href={`/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`} className={googleClass}>
            <GoogleIcon /> Continue with Google
          </a>
        ) : (
          <button type="button" className={googleClass} aria-describedby="google-off" disabled>
            <GoogleIcon /> Continue with Google
          </button>
        )}
        {!googleEnabled && (
          <p id="google-off" className="mt-2 text-center text-xs text-fg-dim">
            Google sign-in will be available once it&apos;s configured.
          </p>
        )}
      </motion.div>

      <motion.div variants={item} className="my-6 flex items-center gap-3" aria-hidden>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-line-strong" />
        <span className="text-xs uppercase tracking-[0.14em] text-fg-dim">or with email</span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-line-strong" />
      </motion.div>

      <motion.form variants={item} action={action} noValidate className="grid gap-3">
        {next && <input type="hidden" name="next" value={next} />}
        {topError && <FormAlert>{topError}</FormAlert>}

        {mode === "register" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              icon={UserRound}
              label="First name"
              name="firstName"
              autoComplete="given-name"
              required
              defaultValue={v.firstName}
              error={fe.firstName}
            />
            <Field label="Last name" name="lastName" autoComplete="family-name" required defaultValue={v.lastName} error={fe.lastName} />
          </div>
        )}
        <Field icon={Mail} label="Email" name="email" type="email" autoComplete="email" required defaultValue={v.email} error={fe.email} />
        <Field
          icon={LockKeyhole}
          label="Password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fe.password}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="grid size-8 place-items-center rounded-full text-fg-dim transition-colors hover:bg-ink-900 hover:text-fg"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
            </button>
          }
        />

        {mode === "register" ? (
          <>
            <StrengthMeter password={password} />
            <div>
              <label className="mt-1 flex items-start gap-3 text-sm leading-snug text-fg-muted">
                <input
                  type="checkbox"
                  name="terms"
                  required
                  aria-invalid={fe.terms ? true : undefined}
                  className="mt-0.5 size-4 shrink-0 accent-brand"
                />
                <span>
                  I agree to the{" "}
                  <Link href="/policies/terms" className={inlineLink}>
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/policies/privacy" className={inlineLink}>
                    Privacy policy
                  </Link>
                </span>
              </label>
              {fe.terms && <p className="mt-1.5 px-1 text-[0.8rem] text-red-600">{fe.terms}</p>}
            </div>
          </>
        ) : (
          <div className="mt-1 flex items-center justify-between text-sm">
            <label className="flex items-center gap-2.5 text-fg-muted">
              <input type="checkbox" name="remember" defaultChecked className="size-4 shrink-0 accent-brand" />
              Keep me signed in
            </label>
            <button type="button" onClick={() => setForgotNote(true)} className="font-medium text-brand hover:underline hover:underline-offset-4">
              Forgot password?
            </button>
          </div>
        )}
        {forgotNote && (
          <FormAlert tone="info">Password reset isn&apos;t available yet. Contact the shop and we&apos;ll help you get back in.</FormAlert>
        )}

        <SubmitButton pendingLabel={t.pending}>{t.submit}</SubmitButton>
        <p className="text-center text-xs text-fg-dim">We&apos;ll email you a 6-digit code to confirm it&apos;s you.</p>
      </motion.form>
    </motion.div>
  );
}

const googleClass =
  "flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-line-strong bg-ink-850 text-[0.95rem] font-medium text-fg shadow-[0_1px_2px_var(--line)] transition-[background-color,border-color,transform,opacity] hover:border-fg/25 hover:bg-ink-950 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-55";

const inlineLink = "font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg";

const strengthLabels = ["Too short", "Weak", "Fair", "Good", "Strong"];
const strengthColors = ["bg-line-strong", "bg-red-400", "bg-amber-400", "bg-leaf-mid", "bg-leaf"];

/** Four-segment strength hint for new passwords; advisory only, the server requires 8+ characters. */
function StrengthMeter({ password }: { password: string }) {
  const score =
    password.length < 8
      ? 0
      : 1 + [/[a-z]/.test(password) && /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password) || password.length >= 14].filter(Boolean)
          .length;
  return (
    <div className="flex items-center gap-3 px-1" aria-live="polite">
      <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1 rounded-full transition-colors duration-300 ${score >= i ? strengthColors[score] : "bg-line"}`} />
        ))}
      </div>
      <span className="w-16 text-right text-xs text-fg-dim">{password ? strengthLabels[score] : "8+ chars"}</span>
    </div>
  );
}
