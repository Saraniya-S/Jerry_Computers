"use client";

import { Check, ChevronDown } from "lucide-react";
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

/** Labelled form controls (label above, hint or error below), used by onboarding and account settings. */

const control =
  "h-11 w-full rounded-xl border bg-ink-850 px-3.5 text-[0.95rem] text-fg placeholder:text-fg-dim transition-[border-color,box-shadow] focus:ring-4";
const ok = "border-line-strong focus:border-brand focus:ring-[var(--brand-glow)]";
const bad = "border-red-400 focus:border-red-500 focus:ring-red-500/15";

type FieldShellProps = { id: string; label: ReactNode; hint?: ReactNode; error?: string; optional?: boolean; children: ReactNode };

export function FieldShell({ id, label, hint, error, optional, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-fg">
        {label}
        {optional && <span className="text-xs font-normal text-fg-dim">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="mt-1.5 text-[0.8rem] text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="mt-1.5 text-[0.8rem] text-fg-dim">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  /** Fixed text inside the field before the input, e.g. "+91". */
  prefix?: string;
};

export function TextField({ label, hint, error, optional, prefix, className = "", ...props }: TextFieldProps) {
  const id = useId();
  const describedBy = error || hint ? `${id}-msg` : undefined;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      {prefix ? (
        <div className={`flex items-center overflow-hidden rounded-xl border bg-ink-850 focus-within:ring-4 ${error ? "border-red-400 focus-within:ring-red-500/15" : "border-line-strong focus-within:border-brand focus-within:ring-[var(--brand-glow)]"}`}>
          <span className="flex h-11 items-center border-r border-line bg-ink-950 px-3 text-[0.95rem] text-fg-muted">{prefix}</span>
          <input
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            style={{ outline: "none" }}
            className={`h-11 min-w-0 flex-1 bg-transparent px-3 text-[0.95rem] text-fg placeholder:text-fg-dim ${className}`}
            {...props}
          />
        </div>
      ) : (
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          style={{ outline: "none" }}
          className={`${control} ${error ? bad : ok} ${className}`}
          {...props}
        />
      )}
    </FieldShell>
  );
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  options: readonly (string | { value: string; label: string })[];
  placeholder?: string;
};

export function SelectField({ label, hint, error, options, placeholder, className = "", ...props }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          style={{ outline: "none" }}
          className={`${control} ${error ? bad : ok} appearance-none pr-10 ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => {
            const opt = typeof o === "string" ? { value: o, label: o } : o;
            return (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            );
          })}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-dim" aria-hidden />
      </div>
    </FieldShell>
  );
}

/** A bordered card with a title, description and switch, like the reference's "Private workspace" row. */
export function ToggleCard({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-ink-950 px-4 py-3.5">
      <div>
        <p id={`${id}-t`} className="text-sm font-medium text-fg">
          {title}
        </p>
        <p className="mt-0.5 text-[0.8rem] text-fg-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-t`}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-brand" : "bg-ink-700"}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] duration-200 ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

/** Multi-select pills. */
export function ChipGroup<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  options: { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
}) {
  const id = useId();
  return (
    <fieldset aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend className="mb-1.5 text-sm font-medium text-fg">{label}</legend>
      {hint && (
        <p id={`${id}-hint`} className="-mt-0.5 mb-2.5 text-[0.8rem] text-fg-dim">
          {hint}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors ${
                on ? "border-brand bg-brand text-white" : "border-line-strong bg-ink-850 text-fg-muted hover:border-fg/30 hover:text-fg"
              }`}
            >
              {on && <Check className="size-3.5" aria-hidden />}
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Two or three mutually exclusive options as a segmented control. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; description?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-fg">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={`rounded-xl border px-4 py-3 text-left transition-[border-color,box-shadow,background-color] ${
                on ? "border-brand bg-brand/[0.04] ring-4 ring-[var(--brand-glow)]" : "border-line-strong bg-ink-850 hover:border-fg/30"
              }`}
            >
              <span className="flex items-center justify-between text-sm font-medium text-fg">
                {o.label}
                <span className={`grid size-4 place-items-center rounded-full border ${on ? "border-brand bg-brand" : "border-line-strong"}`}>
                  {on && <span className="size-1.5 rounded-full bg-white" />}
                </span>
              </span>
              {o.description && <span className="mt-0.5 block text-[0.8rem] text-fg-muted">{o.description}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
