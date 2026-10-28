"use client";

import Link from "next/link";
import { FolderTree, Lock, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteCategoryAction, saveCategoryAction } from "@/app/admin/categories/actions";
import { SelectField, TextField, ToggleCard } from "@/components/forms/controls";
import { slugify, type CategoryInput } from "@/lib/admin/product";
import { ConfirmDialog, dangerButton, ResultAlert, smallButton, smallPrimary, Spinner, useAdminAction } from "./actions-ui";

type Cat = { id: string; slug: string; name: string; description: string; parentId: string | null; isActive: boolean; sortOrder: number; products: number };
type Dept = Cat & { children: Cat[] };
type Draft = { name: string; slug: string; parentId: string; description: string; isActive: boolean; sortOrder: number };

/** The category tree: fixed departments with editable sub-categories. */
export function CategoryManager({ tree, initialQuery }: { tree: Dept[]; initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const [editing, setEditing] = useState<{ id: string | null; value: Draft; slugTouched: boolean } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy, result } = useAdminAction();

  const needle = q.trim().toLowerCase();
  const visible = tree
    .map((d) => ({ ...d, children: d.children.filter((c) => !needle || c.name.toLowerCase().includes(needle) || d.name.toLowerCase().includes(needle)) }))
    .filter((d) => !needle || d.name.toLowerCase().includes(needle) || d.children.length);

  function save() {
    if (!editing) return;
    run("save", () => saveCategoryAction(editing.id, editing.value as CategoryInput), (r) => {
      setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
      if (r.ok) setEditing(null);
    });
  }
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setEditing((cur) => cur && { ...cur, value: { ...cur.value, [k]: v } });

  return (
    <div className="grid gap-5 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex h-9 min-w-56 items-center gap-2 rounded-lg border border-line-strong bg-ink-850 px-3 text-sm">
          <Search className="size-4 text-fg-dim" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter categories" aria-label="Filter categories" style={{ outline: "none" }} className="min-w-0 flex-1 bg-transparent" />
        </label>
        <button type="button" onClick={() => setEditing({ id: null, value: { name: "", slug: "", parentId: tree[0]?.id ?? "", description: "", isActive: true, sortOrder: 0 }, slugTouched: false })} className={smallPrimary}>
          <Plus className="size-4" aria-hidden /> Add sub-category
        </button>
      </div>
      {result && <ResultAlert result={result} />}

      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="grid gap-4 rounded-2xl border border-line bg-ink-950 p-4 sm:p-5"
        >
          <h2 className="text-sm font-medium text-fg">{editing.id ? "Edit sub-category" : "New sub-category"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Name"
              value={editing.value.name}
              error={errors.name}
              onChange={(e) => {
                const name = e.target.value;
                setEditing((cur) => cur && { ...cur, value: { ...cur.value, name, slug: cur.slugTouched ? cur.value.slug : slugify(name) } });
              }}
            />
            <SelectField label="Department" options={tree.map((d) => ({ value: d.id, label: d.name }))} value={editing.value.parentId} error={errors.parentId} onChange={(e) => set("parentId", e.target.value)} />
            <TextField
              label="Web address"
              value={editing.value.slug}
              error={errors.slug}
              onChange={(e) => setEditing((cur) => cur && { ...cur, slugTouched: true, value: { ...cur.value, slug: slugify(e.target.value) } })}
            />
            <TextField label="Sort order" type="number" min={0} value={String(editing.value.sortOrder)} onChange={(e) => set("sortOrder", Math.max(0, Math.floor(Number(e.target.value) || 0)))} hint="Lower numbers come first." />
          </div>
          <TextField label="Description" optional value={editing.value.description} error={errors.description} onChange={(e) => set("description", e.target.value)} maxLength={300} />
          <ToggleCard title="Active" description="Inactive sub-categories can't be picked for products." checked={editing.value.isActive} onChange={(v) => set("isActive", v)} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(null)} className={smallButton}>
              Cancel
            </button>
            <button type="submit" disabled={busy !== null} className={smallPrimary}>
              {busy === "save" && <Spinner />} Save
            </button>
          </div>
        </form>
      )}

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-fg-muted">No categories match “{q}”.</p>
      ) : (
        <ul className="grid gap-3">
          {visible.map((d) => (
            <li key={d.id} className="overflow-hidden rounded-xl border border-line">
              <div className="flex items-center justify-between gap-3 bg-ink-950 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <FolderTree className="size-4 text-brand" aria-hidden />
                  <span className="font-medium text-fg">{d.name}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-fg-dim" title="Store departments are fixed">
                    <Lock className="size-3" aria-hidden /> Department
                  </span>
                </div>
                <Link href={`/admin/products?category=${d.slug}`} className="text-xs tabular-nums text-fg-muted hover:text-brand">
                  {d.products} product{d.products === 1 ? "" : "s"}
                </Link>
              </div>
              {d.children.length > 0 ? (
                <ul className="divide-y divide-line">
                  {d.children.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 pl-11 pr-4 text-sm">
                      <span className="min-w-0">
                        <span className="text-fg">{c.name}</span>
                        {!c.isActive && <span className="ml-2 text-xs text-fg-dim">(inactive)</span>}
                        {c.description && <span className="block truncate text-xs text-fg-dim">{c.description}</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs tabular-nums text-fg-muted">{c.products} product{c.products === 1 ? "" : "s"}</span>
                        <button
                          type="button"
                          aria-label={`Edit ${c.name}`}
                          className={smallButton}
                          onClick={() => setEditing({ id: c.id, slugTouched: true, value: { name: c.name, slug: c.slug, parentId: c.parentId ?? d.id, description: c.description, isActive: c.isActive, sortOrder: c.sortOrder } })}
                        >
                          <Pencil className="size-3.5" aria-hidden />
                        </button>
                        <ConfirmDialog
                          title={`Delete ${c.name}?`}
                          confirmLabel="Delete"
                          onConfirm={() => deleteCategoryAction(c.id)}
                          trigger={(open) => (
                            <button type="button" onClick={open} aria-label={`Delete ${c.name}`} className={dangerButton}>
                              <Trash2 className="size-3.5" aria-hidden />
                            </button>
                          )}
                        >
                          {c.products ? `${c.products} product${c.products === 1 ? " is" : "s are"} in it, so it can't be deleted until they're moved.` : "No products use it."}
                        </ConfirmDialog>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-2.5 pl-11 pr-4 text-xs text-fg-dim">No sub-categories.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
