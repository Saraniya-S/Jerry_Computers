"use client";

import Link from "next/link";
import { Archive, ArchiveRestore, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { deleteProductAction, deleteVariantAction, saveVariantAction, setArchivedAction } from "@/app/admin/products/actions";
import { TextField, ToggleCard } from "@/components/forms/controls";
import type { VariantInput } from "@/lib/admin/product";
import { ConfirmDialog, dangerButton, ResultAlert, smallButton, smallPrimary, Spinner, useAdminAction } from "./actions-ui";

type Variant = { id: string; sku: string; name: string; attributes: { label: string; value: string }[]; price: string; stock: number; isActive: boolean };
type Draft = Omit<VariantInput, "attributes"> & { attributes: { label: string; value: string }[] };

const blank: Draft = { sku: "", name: "", attributes: [{ label: "", value: "" }], price: "", stock: 0, isActive: true };

/** Variants, archive and delete for one product. */
export function ProductAdminPanel({ productId, name, archived, deleteBlocker, variants }: { productId: string; name: string; archived: boolean; deleteBlocker: string | null; variants: Variant[] }) {
  const [editing, setEditing] = useState<{ id: string | null; value: Draft } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy, result } = useAdminAction();

  function save() {
    if (!editing) return;
    run("save", () => saveVariantAction(productId, editing.id, editing.value), (r) => {
      setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
      if (r.ok) setEditing(null);
    });
  }
  const set = <K extends keyof Draft>(k: K, value: Draft[K]) => setEditing((cur) => cur && { ...cur, value: { ...cur.value, [k]: value } });

  return (
    <div className="grid gap-6 px-5 pb-7 sm:px-7 xl:grid-cols-[1fr_340px]">
      <section className="rounded-2xl border border-line">
        <div className="flex items-center justify-between border-b border-line bg-ink-950 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-medium text-fg">Variants</h2>
          {!editing && (
            <button type="button" onClick={() => setEditing({ id: null, value: blank })} className={smallButton}>
              <Plus className="size-4" aria-hidden /> Add variant
            </button>
          )}
        </div>
        <div className="grid gap-4 p-4 sm:p-5">
          <p className="text-[0.8rem] text-fg-dim">Options such as memory or storage, each with its own SKU, price and stock. The store currently sells the base product; variants are tracked here and in Inventory.</p>
          {result && <ResultAlert result={result} />}
          {variants.length > 0 && (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {variants.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-fg">
                      {v.name} {!v.isActive && <span className="ml-1 text-xs font-normal text-fg-dim">(off)</span>}
                    </p>
                    <p className="text-xs text-fg-dim">
                      <span className="font-mono">{v.sku}</span>
                      {v.attributes.length > 0 && ` · ${v.attributes.map((a) => `${a.label}: ${a.value}`).join(", ")}`}
                      {v.price && ` · ₹${v.price}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/inventory?product=${productId}`} className="text-xs tabular-nums text-fg-muted hover:text-brand">
                      {v.stock} in stock
                    </Link>
                    <button
                      type="button"
                      onClick={() => setEditing({ id: v.id, value: { ...v, attributes: v.attributes.length ? v.attributes : [{ label: "", value: "" }] } })}
                      className={smallButton}
                      aria-label={`Edit ${v.name}`}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </button>
                    <ConfirmDialog
                      title={`Delete ${v.name}?`}
                      confirmLabel="Delete variant"
                      onConfirm={() => deleteVariantAction(productId, v.id)}
                      trigger={(open) => (
                        <button type="button" onClick={open} className={dangerButton} aria-label={`Delete ${v.name}`}>
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      )}
                    >
                      Only possible while its stock has no history. Otherwise switch it off.
                    </ConfirmDialog>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
              className="grid gap-4 rounded-xl border border-line bg-ink-950 p-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Variant name" value={editing.value.name} error={errors.name} onChange={(e) => set("name", e.target.value)} placeholder="16 GB / 512 GB" />
                <TextField label="SKU" value={editing.value.sku} error={errors.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())} />
                <TextField label="Price" optional prefix="₹" inputMode="decimal" value={editing.value.price} error={errors.price} onChange={(e) => set("price", e.target.value)} hint="Empty uses the product's price." />
                {editing.id ? (
                  <p className="self-end pb-2 text-sm text-fg-muted">Stock changes go through Inventory.</p>
                ) : (
                  <TextField label="Opening stock" type="number" min={0} value={String(editing.value.stock)} error={errors.stock} onChange={(e) => set("stock", Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
                )}
              </div>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium text-fg">Attributes</legend>
                {editing.value.attributes.map((a, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                    <input aria-label={`Attribute ${i + 1} name`} value={a.label} placeholder="RAM" onChange={(e) => set("attributes", editing.value.attributes.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="h-10 rounded-lg border border-line-strong bg-ink-850 px-3 text-sm" />
                    <input aria-label={`Attribute ${i + 1} value`} value={a.value} placeholder="16 GB" onChange={(e) => set("attributes", editing.value.attributes.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} className="h-10 rounded-lg border border-line-strong bg-ink-850 px-3 text-sm" />
                    <button type="button" aria-label="Remove attribute" onClick={() => set("attributes", editing.value.attributes.filter((_, j) => j !== i))} className="grid size-10 place-items-center rounded-lg text-fg-dim hover:bg-ink-900">
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => set("attributes", [...editing.value.attributes, { label: "", value: "" }])} className={`${smallButton} w-fit`}>
                  <Plus className="size-4" aria-hidden /> Add attribute
                </button>
              </fieldset>
              <ToggleCard title="Active" description="Inactive variants are kept for history but not offered." checked={editing.value.isActive} onChange={(x) => set("isActive", x)} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(null)} className={smallButton}>
                  Cancel
                </button>
                <button type="submit" disabled={busy !== null} className={smallPrimary}>
                  {busy === "save" && <Spinner />} {editing.id ? "Save variant" : "Add variant"}
                </button>
              </div>
            </form>
          )}
          {!variants.length && !editing && <p className="text-sm text-fg-muted">No variants. The product is sold as a single item.</p>}
        </div>
      </section>

      <section className="h-fit rounded-2xl border border-line">
        <h2 className="border-b border-line bg-ink-950 px-4 py-3 text-sm font-medium text-fg sm:px-5">Archive or delete</h2>
        <div className="grid gap-3 p-4 sm:p-5">
          {archived ? (
            <ConfirmDialog
              title={`Restore ${name}?`}
              tone="primary"
              confirmLabel="Restore"
              onConfirm={() => setArchivedAction(productId, false)}
              trigger={(open) => (
                <button type="button" onClick={open} className={smallButton}>
                  <ArchiveRestore className="size-4" aria-hidden /> Restore from archive
                </button>
              )}
            >
              It comes back hidden; switch on “Show in the store” when it&apos;s ready.
            </ConfirmDialog>
          ) : (
            <ConfirmDialog
              title={`Archive ${name}?`}
              confirmLabel="Archive"
              onConfirm={() => setArchivedAction(productId, true)}
              trigger={(open) => (
                <button type="button" onClick={open} className={smallButton}>
                  <Archive className="size-4" aria-hidden /> Archive product
                </button>
              )}
            >
              It disappears from the store and customers&apos; carts. Orders, invoices and stock history keep their records.
            </ConfirmDialog>
          )}
          {deleteBlocker ? (
            <p className="text-[0.8rem] text-fg-dim">Can&apos;t be deleted: {deleteBlocker}</p>
          ) : (
            <ConfirmDialog
              title={`Delete ${name} permanently?`}
              confirmLabel="Delete product"
              onConfirm={() => deleteProductAction(productId)}
              trigger={(open) => (
                <button type="button" onClick={open} className={dangerButton}>
                  <Trash2 className="size-4" aria-hidden /> Delete product
                </button>
              )}
            >
              It has never been ordered and its stock has never moved, so nothing else refers to it. This can&apos;t be undone.
            </ConfirmDialog>
          )}
        </div>
      </section>
    </div>
  );
}
