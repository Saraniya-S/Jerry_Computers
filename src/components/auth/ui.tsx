"use client";

import { ArrowRight, CircleAlert, CircleCheck, LoaderCircle, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

const ease = [0.22, 1, 0.36, 1] as const;

export const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

export const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
};

export function AuthHeading({ title, accent, children }: { title: string; accent: string; children: ReactNode }) {
  return (
    <>
      <motion.h1 variants={item} className="text-[2.6rem] font-medium leading-[1.05] tracking-[-0.04em] text-fg">
        {title} <span className="font-serif font-normal italic text-brand">{accent}</span>
      </motion.h1>
      <motion.div variants={item} className="mt-3 text-[0.95rem] text-fg-muted">
        {children}
      </motion.div>
    </>
  );
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "placeholder"> & {
  label: string;
  icon?: LucideIcon;
  trailing?: ReactNode;
  error?: string;
};

/** Input with a floating label: it sits inside the field and lifts once focused or filled. */
export function Field({ label, icon: Icon, trailing, error, className = "", ...props }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={className}>
      <div
        className={`group relative flex h-14 items-center rounded-2xl border bg-ink-950 transition-[border-color,background-color,box-shadow] focus-within:bg-ink-850 focus-within:ring-4 ${
          error
            ? "border-red-400 focus-within:border-red-500 focus-within:ring-red-500/15"
            : "border-line-strong focus-within:border-brand focus-within:ring-[var(--brand-glow)]"
        }`}
      >
        {Icon && <Icon className="ml-4 size-[18px] shrink-0 text-fg-dim transition-colors group-focus-within:text-brand" aria-hidden />}
        <div className="relative h-full min-w-0 flex-1">
          <input
            id={id}
            placeholder=" "
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            // The wrapper draws the focus ring; skip the global :focus-visible outline here.
            style={{ outline: "none" }}
            className={`peer h-full w-full bg-transparent pb-1.5 pt-5 text-[0.95rem] text-fg outline-none ${Icon ? "pl-3" : "pl-4"} ${trailing ? "pr-1" : "pr-4"}`}
            {...props}
          />
          <label
            htmlFor={id}
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 truncate text-[0.95rem] text-fg-dim transition-all duration-200 peer-focus:top-[1.05rem] peer-focus:text-[0.7rem] peer-focus:text-brand peer-[:not(:placeholder-shown)]:top-[1.05rem] peer-[:not(:placeholder-shown)]:text-[0.7rem] ${Icon ? "left-3" : "left-4"}`}
          >
            {label}
          </label>
        </div>
        {trailing && <div className="mr-2">{trailing}</div>}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 px-1 text-[0.8rem] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** Primary submit button; shows a spinner and disables itself while its form is submitting. */
export function SubmitButton({ children, pendingLabel }: { children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-[0.95rem] font-medium text-white shadow-[0_10px_24px_-10px_var(--brand-glow),inset_0_1px_0_rgb(255_255_255/0.15)] transition-[background-color,transform,opacity] hover:bg-[var(--brand-hover)] active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
    >
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" aria-hidden /> {pendingLabel}
        </>
      ) : (
        <>
          {children}
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
        </>
      )}
    </button>
  );
}

export function FormAlert({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  const reduce = useReducedMotion();
  const styles = {
    error: "border-red-300/60 bg-red-50 text-red-700",
    success: "border-leaf-mid/25 bg-mint-soft text-leaf",
    info: "border-brand/20 bg-brand/[0.05] text-fg-muted",
  }[tone];
  const Icon = tone === "error" ? CircleAlert : CircleCheck;
  return (
    <motion.div
      role={tone === "error" ? "alert" : "status"}
      initial={reduce ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm leading-relaxed ${styles}`}
    >
      {tone !== "info" && <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <div>{children}</div>
    </motion.div>
  );
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}
