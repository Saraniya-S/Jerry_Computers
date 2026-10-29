"use client";

import { IndianRupee } from "lucide-react";
import { useState } from "react";
import { SelectField, TextField } from "@/components/forms/controls";
import type { ActionResult } from "@/lib/admin/result";
import { formatPaise } from "@/lib/money";
import { collectionMethodLabel, type CollectionMethodId } from "@/lib/service-desk";
import { ResultAlert, smallButton, smallPrimary, Spinner, useAdminAction } from "./actions-ui";

type Row = { id: string; amountPaise: number; method: CollectionMethodId; note: string | null; createdAt: Date; by: string | null };
type RecordFn = (input: { requestId: string; amount: string; method: string; note: string; correction: boolean }) => Promise<ActionResult>;

const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/**
 * What the shop collected from the customer for this job (no online payment for services). Shared
 * by the admin and engineer job pages; entries are only added, with admin corrections.
 */
export function CollectionsCard({ requestId, rows, totalPaise, canRecord, canCorrect, onRecord }: { requestId: string; rows: Row[]; totalPaise: number; canRecord: boolean; canCorrect: boolean; onRecord: RecordFn }) {
  const [form, setForm] = useState<{ amount: string; method: CollectionMethodId | ""; note: string; correction: boolean } | null>(null);
  const { run, busy, result } = useAdminAction();
  return (
    <section className="grid gap-3 rounded-xl border border-line p-4 text-sm sm:p-5">
      <h2 className="flex items-center justify-between gap-2 font-medium text-fg">
        <span className="inline-flex items-center gap-1.5">
          <IndianRupee className="size-4 text-brand" aria-hidden /> Payment collected
        </span>
        <span className="tabular-nums">{formatPaise(totalPaise)}</span>
      </h2>
      {rows.length ? (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="text-fg">{collectionMethodLabel[r.method]}</span>
                {r.note && <span className="text-fg-muted"> · {r.note}</span>}
                <span className="block text-xs text-fg-dim">
                  {fmt.format(r.createdAt)}
                  {r.by && ` · ${r.by}`}
                </span>
              </span>
              <span className={`shrink-0 tabular-nums ${r.amountPaise < 0 ? "text-red-700" : "text-fg"}`}>
                {r.amountPaise < 0 ? "−" : ""}
                {formatPaise(Math.abs(r.amountPaise))}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-fg-muted">Nothing recorded yet. Services are paid at the shop or to the engineer, not online.</p>
      )}
      {result && <ResultAlert result={result} />}
      {canRecord &&
        (form ? (
          <form
            className="grid gap-3 rounded-lg border border-line bg-ink-950 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              run("save", () => onRecord({ requestId, amount: form.amount, method: form.method, note: form.note, correction: form.correction }), (r) => r.ok && setForm(null));
            }}
          >
            <TextField label={form.correction ? "Amount to take off" : "Amount received"} prefix="₹" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <SelectField label="Paid by" placeholder="Choose" options={Object.entries(collectionMethodLabel).map(([value, label]) => ({ value, label }))} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as CollectionMethodId })} />
            <TextField label="Note" optional={!form.correction} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={200} placeholder={form.correction ? "Why it's being corrected" : "e.g. Advance, UPI ref 4521…"} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className={smallButton}>
                Cancel
              </button>
              <button type="submit" disabled={busy !== null || !form.amount || !form.method || (form.correction && !form.note.trim())} className={smallPrimary}>
                {busy && <Spinner />} Save
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setForm({ amount: "", method: "", note: "", correction: false })} className={`${smallButton} w-fit`}>
              Record payment
            </button>
            {canCorrect && rows.length > 0 && (
              <button type="button" onClick={() => setForm({ amount: "", method: "cash", note: "", correction: true })} className={`${smallButton} w-fit text-fg-muted`}>
                Correct a mistake
              </button>
            )}
          </div>
        ))}
    </section>
  );
}
