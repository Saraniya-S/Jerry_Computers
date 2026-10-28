"use client";

import { SlidersHorizontal } from "lucide-react";
import { useId, useRef, useState } from "react";
import { adjustStockAction } from "@/app/admin/inventory/actions";
import { SelectField, TextField } from "@/components/forms/controls";
import { ResultAlert, smallButton, smallPrimary, Spinner, useAdminAction } from "./actions-ui";

const reasons = [
  { value: "restock", label: "Restock (goods received)" },
  { value: "customer_return", label: "Customer return" },
  { value: "correction", label: "Correction (miscount)" },
  { value: "damaged", label: "Damaged / written off" },
] as const;

/** Opens a dialog to add, remove or set stock for one product or variant, with a reason. */
export function StockAdjuster({ productId, variantId, label, current }: { productId: string; variantId: string | null; label: string; current: number }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [mode, setMode] = useState<"add" | "set">("add");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<(typeof reasons)[number]["value"]>("restock");
  const [note, setNote] = useState("");
  const { run, busy, result, setResult } = useAdminAction();

  const n = Number.parseInt(qty, 10);
  const after = Number.isFinite(n) ? (mode === "set" ? n : current + n) : null;

  return (
    <>
      <button
        type="button"
        className={smallButton}
        onClick={() => {
          setQty("");
          setNote("");
          setMode("add");
          setReason("restock");
          setResult(null);
          ref.current?.showModal();
        }}
      >
        <SlidersHorizontal className="size-3.5" aria-hidden /> Adjust
      </button>
      <dialog ref={ref} aria-labelledby={titleId} className="m-auto w-[min(30rem,92vw)] rounded-2xl border border-line bg-ink-850 p-0 text-left text-fg shadow-2xl backdrop:bg-[rgb(28_25_56/0.35)]">
        <form
          className="grid gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            run("save", () => adjustStockAction({ productId, variantId, mode, quantity: n, reason, note, expectedStock: current }), (r) => r.ok && ref.current?.close());
          }}
        >
          <div>
            <h2 id={titleId} className="text-base font-semibold">
              Adjust stock
            </h2>
            <p className="mt-0.5 whitespace-normal text-sm text-fg-muted">
              {label} · <span className="tabular-nums">{current}</span> available now
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Adjustment type">
            {(
              [
                ["add", "Add or remove"],
                ["set", "Set counted stock"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)} className={`h-9 rounded-lg border text-sm ${mode === k ? "border-brand bg-brand/[0.06] font-medium text-fg" : "border-line-strong text-fg-muted"}`}>
                {l}
              </button>
            ))}
          </div>
          <TextField
            label={mode === "add" ? "Change" : "Counted stock"}
            type="number"
            inputMode="numeric"
            min={mode === "set" ? 0 : undefined}
            step={1}
            required
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            hint={mode === "add" ? "Use a minus sign to remove, e.g. -2." : "The number actually on the shelf."}
          />
          <SelectField label="Reason" options={reasons.map((r) => ({ value: r.value, label: r.label }))} value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} />
          <TextField label="Note" optional={reason === "restock" || reason === "customer_return"} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={reason === "restock" ? "Supplier invoice no." : "What happened"} />
          {after !== null && (
            <p className={`text-sm ${after < 0 ? "text-red-600" : "text-fg-muted"}`}>
              After this: <span className="font-semibold tabular-nums text-fg">{after}</span> available
            </p>
          )}
          {result && !result.ok && <ResultAlert result={result} />}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => ref.current?.close()} className={smallButton}>
              Cancel
            </button>
            <button type="submit" disabled={busy !== null || !Number.isFinite(n)} className={smallPrimary}>
              {busy && <Spinner />} Save adjustment
            </button>
          </div>
        </form>
      </dialog>
      {result?.ok && <span className="sr-only" role="status">{result.message}</span>}
    </>
  );
}
