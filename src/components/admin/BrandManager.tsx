"use client";

import Link from "next/link";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteBrandAction, saveBrandAction } from "@/app/admin/categories/actions";
import { EmptyState } from "@/components/account/PageHeader";
import { TextField, ToggleCard } from "@/components/forms/controls";
import { ConfirmDialog, dangerButton, ResultAlert, smallButton, smallPrimary, Spinner, useAdminAction } from "./actions-ui";
import { FilterBar, SearchInput } from "./ui";

type Brand = { id: string; name: string; isActive: boolean; products: number };

export function BrandManager({ brands, query }: { brands: Brand[]; query: string }) {
  const [editing, setEditing] = useState<{ id: string | null; name: string; isActive: boolean } | null>(null);
  const [error, setError] = useState<string | undefined>();
  const { run, busy, result } = useAdminAction();

  function save() {
    if (!editing) return;
    run("save", () => saveBrandAction(editing.id, { name: editing.name, isActive: editing.isActive }), (r) => {
      setError(r.ok ? undefined : r.fieldErrors?.name);
      if (r.ok) setEditing(null);
    });
  }

  return (
    <>
      <FilterBar resetHref="/admin/brands">
        <SearchInput value={query} placeholder="Brand name" label="Search brands" />
      </FilterBar>
      <div className="grid gap-4 p-5 sm:p-7">
        <div className="flex justify-end">
          <button type="button" onClick={() => setEditing({ id: null, name: "", isActive: true })} className={smallPrimary}>
            <Plus className="size-4" aria-hidden /> Add brand
          </button>
        </div>
        {result && <ResultAlert result={result} />}
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="grid gap-4 rounded-2xl border border-line bg-ink-950 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <TextField label="Brand name" value={editing.name} error={error} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
            <ToggleCard title="Active" description="Inactive brands can't be picked for new products." checked={editing.isActive} onChange={(v) => setEditing({ ...editing, isActive: v })} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(null)} className={smallButton}>
                Cancel
              </button>
              <button type="submit" disabled={busy !== null} className={smallPrimary}>
                {busy === "save" && <Spinner />} Save
              </button>
            </div>
          </form>
        )}
        {brands.length === 0 ? (
          <EmptyState icon={<Tags className="size-5" aria-hidden />} title={query ? "No brands match" : "No brands yet"}>
            {query ? "Try another search." : "Add the manufacturers you stock, then choose one on each product."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {brands.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-fg">
                  {b.name} {!b.isActive && <span className="ml-1 text-xs text-fg-dim">(inactive)</span>}
                </span>
                <span className="flex items-center gap-2">
                  <Link href={`/admin/products?brand=${b.id}`} className="text-xs tabular-nums text-fg-muted hover:text-brand">
                    {b.products} product{b.products === 1 ? "" : "s"}
                  </Link>
                  <button type="button" aria-label={`Edit ${b.name}`} onClick={() => setEditing({ id: b.id, name: b.name, isActive: b.isActive })} className={smallButton}>
                    <Pencil className="size-3.5" aria-hidden />
                  </button>
                  <ConfirmDialog
                    title={`Delete ${b.name}?`}
                    confirmLabel="Delete"
                    onConfirm={() => deleteBrandAction(b.id)}
                    trigger={(open) => (
                      <button type="button" onClick={open} aria-label={`Delete ${b.name}`} className={dangerButton}>
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    )}
                  >
                    {b.products ? `${b.products} product${b.products === 1 ? " uses" : "s use"} it, so it can't be deleted. Switch it off instead.` : "No products use it."}
                  </ConfirmDialog>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
