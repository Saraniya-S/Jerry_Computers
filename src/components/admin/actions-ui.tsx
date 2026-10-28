"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { FormAlert } from "@/components/auth/ui";
import type { ActionResult } from "@/lib/admin/result";

/** Runs a server action with a busy flag and keeps its result for an alert. */
export function useAdminAction() {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  function run(key: string, action: () => Promise<ActionResult>, onDone?: (r: ActionResult) => void) {
    setBusy(key);
    setResult(null);
    start(async () => {
      const r = await action();
      setBusy(null);
      setResult(r);
      onDone?.(r);
    });
  }
  return { run, busy, result, setResult };
}

export function ResultAlert({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return <FormAlert tone={result.ok ? "success" : "error"}>{result.ok ? result.message : result.error}</FormAlert>;
}

export const smallButton =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-ink-850 px-3 text-sm text-fg transition-colors hover:bg-ink-900 disabled:opacity-60";
export const smallPrimary = "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-[var(--brand-hover)] disabled:opacity-60";
export const dangerButton = "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60";

export const Spinner = () => <LoaderCircle className="size-4 animate-spin" aria-hidden />;

/**
 * A confirmation dialog for destructive or important actions. With `reason`, the person must type
 * one, and it is passed to onConfirm.
 */
export function ConfirmDialog({
  trigger,
  title,
  children,
  confirmLabel,
  tone = "danger",
  reason,
  onConfirm,
}: {
  trigger: (open: () => void) => ReactNode;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  /** Label for a required reason field. */
  reason?: string;
  onConfirm: (reason: string) => Promise<ActionResult>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const { run, busy, result, setResult } = useAdminAction();

  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open) ref.current?.close();
  }, [open]);

  return (
    <>
      {trigger(() => {
        setText("");
        setResult(null);
        setOpen(true);
      })}
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        aria-labelledby={titleId}
        className="m-auto w-[min(28rem,92vw)] rounded-2xl border border-line bg-ink-850 p-0 text-fg shadow-2xl backdrop:bg-[rgb(28_25_56/0.35)] backdrop:backdrop-blur-[2px]"
      >
        <form
          method="dialog"
          className="grid gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            run("confirm", () => onConfirm(text.trim()), (r) => r.ok && setOpen(false));
          }}
        >
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          {children && <div className="text-sm leading-relaxed text-fg-muted">{children}</div>}
          {reason && (
            <label className="grid gap-1.5 text-sm font-medium">
              {reason}
              <textarea
                required
                rows={3}
                maxLength={500}
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{ outline: "none" }}
                className="rounded-xl border border-line-strong bg-ink-850 px-3 py-2 text-sm font-normal focus:border-brand focus:ring-4 focus:ring-[var(--brand-glow)]"
              />
            </label>
          )}
          {result && !result.ok && <ResultAlert result={result} />}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className={smallButton}>
              Keep it
            </button>
            <button type="submit" disabled={busy !== null || (Boolean(reason) && !text.trim())} className={tone === "danger" ? `${dangerButton} bg-ink-850` : smallPrimary}>
              {busy && <Spinner />} {confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
