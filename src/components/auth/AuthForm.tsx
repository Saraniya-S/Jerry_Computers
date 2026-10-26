"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { useState, type FormEvent, type InputHTMLAttributes } from "react";

type Mode = "login" | "register";

const ease = [0.22, 1, 0.36, 1] as const;

const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
};

const field =
  "h-[50px] w-full rounded-lg border border-line-strong bg-ink-850 px-4 text-[0.95rem] text-fg placeholder:text-fg-dim outline-none transition-[border-color,background-color] focus:border-brand focus:bg-ink-850 focus:ring-4 focus:ring-[var(--brand-glow)]";

const oauthButton =
  "flex h-[50px] items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-ink-850 text-[0.95rem] text-fg transition-[background-color,border-color,transform] hover:border-fg/30 hover:bg-ink-900 active:scale-[0.99]";

const copy = {
  login: {
    title: "Welcome back",
    switchText: "Don't have an account?",
    switchLink: "Sign up",
    switchHref: "/register",
    submit: "Log in",
    divider: "Or log in with",
  },
  register: {
    title: "Create an account",
    switchText: "Already have an account?",
    switchLink: "Log in",
    switchHref: "/login",
    submit: "Create account",
    divider: "Or register with",
  },
} satisfies Record<Mode, Record<string, string>>;

/** Sign-in / sign-up form. Accounts are not live yet, so every action shows a notice instead of submitting. */
export function AuthForm({ mode }: { mode: Mode }) {
  const reduce = useReducedMotion();
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState(false);
  const t = copy[mode];

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(true);
  }

  return (
    <motion.div variants={list} initial={reduce ? false : "hidden"} animate="show">
      <motion.h1 variants={item} className="text-4xl font-medium tracking-[-0.035em] text-fg sm:text-[2.75rem]">
        {t.title}
      </motion.h1>
      <motion.p variants={item} className="mt-4 text-[0.95rem] text-fg-muted">
        {t.switchText}{" "}
        <Link href={t.switchHref} className="text-brand underline underline-offset-2 hover:text-fg">
          {t.switchLink}
        </Link>
      </motion.p>

      <motion.form variants={item} onSubmit={onSubmit} className="mt-10 grid gap-4">
        {mode === "register" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="firstName" placeholder="First name" autoComplete="given-name" required />
            <Input name="lastName" placeholder="Last name" autoComplete="family-name" required />
          </div>
        )}
        <Input name="email" type="email" placeholder="Email" autoComplete="email" required />
        <div className="relative">
          <Input
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={mode === "register" ? 8 : undefined}
            required
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-dim transition-colors hover:text-fg"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        </div>

        {mode === "register" ? (
          <label className="mt-1 flex items-center gap-3 text-sm text-fg-muted">
            <input type="checkbox" name="terms" required className="size-5 shrink-0 accent-brand" />
            <span>
              I agree to the{" "}
              <Link href="/policies/terms" className="text-brand underline underline-offset-2 hover:text-fg">
                Terms &amp; Conditions
              </Link>
            </span>
          </label>
        ) : (
          <div className="mt-1 flex items-center justify-between text-sm">
            <label className="flex items-center gap-3 text-fg-muted">
              <input type="checkbox" name="remember" className="size-5 shrink-0 accent-brand" />
              Remember me
            </label>
            <button type="button" onClick={() => setNotice(true)} className="text-brand underline underline-offset-2 hover:text-fg">
              Forgot password?
            </button>
          </div>
        )}

        <button
          type="submit"
          className="mt-5 h-[50px] rounded-lg bg-brand text-[0.95rem] font-medium text-white transition-[background-color,transform] hover:bg-[var(--brand-hover)] active:scale-[0.99]"
        >
          {t.submit}
        </button>
      </motion.form>

      {notice && (
        <div role="status" className="mt-5 rounded-lg border border-brand/30 bg-brand/[0.06] p-4 text-sm leading-relaxed text-fg-muted">
          Customer accounts are not available yet. Sign-in will open here when the store and service portal launch.
        </div>
      )}

      <motion.div variants={item} className="my-8 flex items-center gap-4" aria-hidden>
        <div className="h-px flex-1 bg-line-strong" />
        <span className="text-xs text-fg-dim">{t.divider}</span>
        <div className="h-px flex-1 bg-line-strong" />
      </motion.div>

      <motion.div variants={item}>
        <button type="button" className={`${oauthButton} w-full`} onClick={() => setNotice(true)}>
          <GoogleIcon /> Continue with Google
        </button>
      </motion.div>
    </motion.div>
  );
}

function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input aria-label={props.placeholder} className={`${field} ${className}`} {...props} />;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}
