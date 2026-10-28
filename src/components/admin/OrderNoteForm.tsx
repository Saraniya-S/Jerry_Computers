"use client";

import { useState } from "react";
import { addOrderNoteAction } from "@/app/admin/actions";
import { ResultAlert, smallButton, Spinner, useAdminAction } from "./actions-ui";

/** Adds an internal note to an order. Customers never see these. */
export function OrderNoteForm({ orderId }: { orderId: string }) {
  const [note, setNote] = useState("");
  const { run, busy, result } = useAdminAction();
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run("note", () => addOrderNoteAction(orderId, note), (r) => r.ok && setNote(""));
      }}
    >
      <label htmlFor={`order-note-${orderId}`} className="sr-only">
        Internal note
      </label>
      <textarea
        id={`order-note-${orderId}`}
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={1000}
        placeholder="Internal note (not shown to the customer)"
        style={{ outline: "none" }}
        className="w-full rounded-xl border border-line-strong bg-ink-850 px-3 py-2 text-sm text-fg placeholder:text-fg-dim focus:border-brand focus:ring-4 focus:ring-[var(--brand-glow)]"
      />
      {result && !result.ok && <ResultAlert result={result} />}
      <button type="submit" disabled={busy !== null || !note.trim()} className={`${smallButton} w-fit`}>
        {busy && <Spinner />} Add note
      </button>
    </form>
  );
}
