"use client";

import { LoaderCircle, MapPin, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteAddressAction, saveAddressAction, setDefaultAddressAction } from "@/app/account/actions";
import { FormAlert } from "@/components/auth/ui";
import { AddressFields, emptyAddress, type AddressDraft } from "@/components/forms/AddressFields";
import { mobileInputValue } from "@/lib/customer";
import { outlineButton, primaryButton } from "./buttons";
import { EmptyState } from "./PageHeader";

export type SavedAddress = AddressDraft & { id: string; isDefault: boolean; phoneDisplay: string };

/** Address cards with add, edit, delete and make-default. Edits happen in a modal dialog. */
export function AddressBook({ addresses, defaultName, defaultPhone, max }: { addresses: SavedAddress[]; defaultName: string; defaultPhone: string; max: number }) {
  const [editing, setEditing] = useState<{ id?: string; draft: AddressDraft; makeDefault: boolean } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, start] = useTransition();

  const openNew = () => setEditing({ draft: emptyAddress(defaultName, mobileInputValue(defaultPhone)), makeDefault: addresses.length === 0 });

  function run(id: string, action: () => Promise<{ ok: boolean; message?: string }>) {
    setBusyId(id);
    setMessage(null);
    start(async () => {
      const res = await action();
      setBusyId(null);
      if (res.ok && res.message) setMessage(res.message);
    });
  }

  return (
    <div className="p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          {addresses.length} of {max} saved. The default is used for deliveries and on-site visits.
        </p>
        <button type="button" onClick={openNew} disabled={addresses.length >= max} className={`${primaryButton} disabled:opacity-60`}>
          <Plus className="size-4" aria-hidden /> Add address
        </button>
      </div>
      {message && (
        <div className="mb-4">
          <FormAlert tone="success">{message}</FormAlert>
        </div>
      )}

      {addresses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong">
          <EmptyState icon={<MapPin className="size-5" aria-hidden />} title="No addresses yet" action={<button type="button" onClick={openNew} className={outlineButton}>Add your first address</button>}>
            Add where you&apos;d like orders delivered and engineers to visit.
          </EmptyState>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className={`relative flex flex-col rounded-xl border p-4 ${a.isDefault ? "border-brand/40 bg-brand/[0.03]" : "border-line bg-ink-950"}`}>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-ink-850 px-2 py-0.5 text-xs font-medium text-fg shadow-[0_1px_2px_var(--line)]">{a.label}</span>
                {a.isDefault && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-brand px-2 py-0.5 text-xs font-medium text-white">
                    <Star className="size-3" aria-hidden /> Default
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm font-medium text-fg">{a.recipientName}</p>
              <address className="mt-1 text-sm not-italic leading-relaxed text-fg-muted">
                {a.line1}
                {a.line2 && <>, {a.line2}</>}
                <br />
                {a.landmark && (
                  <>
                    Near {a.landmark}
                    <br />
                  </>
                )}
                {a.city}, {a.state} {a.postalCode}
              </address>
              <p className="mt-1 text-sm text-fg-muted">{a.phoneDisplay}</p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => setEditing({ id: a.id, draft: { ...a, phone: mobileInputValue(a.phoneDisplay) }, makeDefault: a.isDefault })}
                  className={iconBtn}
                >
                  <Pencil className="size-3.5" aria-hidden /> Edit
                </button>
                {!a.isDefault && (
                  <button type="button" onClick={() => run(a.id, () => setDefaultAddressAction(a.id))} disabled={busyId === a.id} className={iconBtn}>
                    <Star className="size-3.5" aria-hidden /> Make default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => confirm(`Remove the ${a.label.toLowerCase()} address?`) && run(a.id, () => deleteAddressAction(a.id))}
                  disabled={busyId === a.id}
                  className={`${iconBtn} ml-auto text-red-700 hover:bg-red-50`}
                >
                  {busyId === a.id ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : <Trash2 className="size-3.5" aria-hidden />} Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <AddressDialog
          key={editing.id ?? "new"}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            setMessage(msg);
          }}
        />
      )}
    </div>
  );
}

const iconBtn = "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-fg-muted transition-colors hover:bg-ink-900 hover:text-fg disabled:opacity-50";

function AddressDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: { id?: string; draft: AddressDraft; makeDefault: boolean };
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(initial.draft);
  const [makeDefault, setMakeDefault] = useState(initial.makeDefault);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    // No cleanup: unmounting removes the dialog, and calling close() would fire onClose.
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  function save() {
    setError(null);
    start(async () => {
      const res = await saveAddressAction({ id: initial.id, makeDefault, address: draft });
      if (res.ok) onSaved(res.message);
      else {
        setErrors(res.fieldErrors ?? {});
        if (res.error) setError(res.error);
      }
    });
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="address-dialog-title"
      className="m-auto w-[min(560px,calc(100vw-2rem))] rounded-2xl border border-line bg-ink-850 p-0 text-fg shadow-2xl backdrop:bg-[rgb(28_25_56/0.4)] backdrop:backdrop-blur-[2px]"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="address-dialog-title" className="text-base font-semibold">
            {initial.id ? "Edit address" : "Add address"}
          </h2>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-fg-muted hover:bg-ink-900 hover:text-fg" aria-label="Close">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">
          <AddressFields value={draft} onChange={setDraft} errors={errors} />
          <label className="mt-5 flex items-center gap-2.5 text-sm text-fg">
            <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} className="size-4 accent-brand" />
            Use as my default address
          </label>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button type="button" onClick={onClose} className={outlineButton}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={pending} className={`${primaryButton} disabled:opacity-80`}>
            {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            {pending ? "Saving…" : "Save address"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
