"use client";

import { ArrowDown, ArrowUp, LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteServiceAction, moveServiceAction, saveServiceAction, type ServiceInput, type ServiceResult } from "@/app/admin/services/actions";
import { outlineButton, primaryButton } from "@/components/account/buttons";
import { FormAlert } from "@/components/auth/ui";
import { SelectField, TextField, ToggleCard } from "@/components/forms/controls";
import { ServiceVisual } from "@/components/services/ServiceVisual";
import { serviceVisuals, type ServiceId } from "@/data/services";
import { slugify } from "@/lib/admin/product";

type Row = ServiceInput & { id: string; visual: ServiceId };

const blank: ServiceInput = { label: "", title: "", slug: "", description: "", includes: [""], visual: "diagnostics", isActive: true };

export function ServicesManager({ services }: { services: Row[] }) {
  const [editing, setEditing] = useState<{ id: string | null; value: ServiceInput } | null>(null);
  const [result, setResult] = useState<ServiceResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  function run(key: string, action: () => Promise<ServiceResult>) {
    setBusy(key);
    setResult(null);
    start(async () => {
      setResult(await action());
      setBusy(null);
    });
  }

  return (
    <div className="p-5 sm:p-7">
      <div className="mb-5 flex justify-end">
        <button type="button" onClick={() => setEditing({ id: null, value: blank })} className={primaryButton}>
          <Plus className="size-4" aria-hidden /> Add service
        </button>
      </div>
      {result && (
        <div className="mb-4">
          <FormAlert tone={result.ok ? "success" : "error"}>{result.ok ? result.message : result.error}</FormAlert>
        </div>
      )}
      <ol className="grid gap-3">
        {services.map((s, i) => (
          <li key={s.id} className={`grid gap-4 rounded-xl border p-4 sm:grid-cols-[150px_1fr_auto] ${s.isActive ? "border-line bg-ink-950" : "border-dashed border-line-strong opacity-70"}`}>
            <div className="rounded-lg border border-line bg-ink-850 p-3">
              <ServiceVisual id={s.visual} />
            </div>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                <span className="font-mono text-xs text-fg-dim">{String(i + 1).padStart(2, "0")}</span>
                {s.title}
                {!s.isActive && <span className="rounded-full bg-ink-900 px-2 py-0.5 text-xs font-normal text-fg-dim">Hidden</span>}
              </p>
              <p className="mt-1 text-sm text-fg-muted">{s.description}</p>
              <p className="mt-2 text-xs text-fg-dim">
                {s.label} · /services/{s.slug} · {s.includes.length} items included
              </p>
            </div>
            <div className="flex items-start gap-1.5">
              <IconBtn label="Move up" disabled={i === 0 || busy !== null} onClick={() => run(`up-${s.id}`, () => moveServiceAction(s.id, -1))}>
                <ArrowUp className="size-4" aria-hidden />
              </IconBtn>
              <IconBtn label="Move down" disabled={i === services.length - 1 || busy !== null} onClick={() => run(`down-${s.id}`, () => moveServiceAction(s.id, 1))}>
                <ArrowDown className="size-4" aria-hidden />
              </IconBtn>
              <IconBtn label={`Edit ${s.label}`} onClick={() => setEditing({ id: s.id, value: { ...s, includes: s.includes.length ? s.includes : [""] } })}>
                <Pencil className="size-4" aria-hidden />
              </IconBtn>
              <IconBtn
                label={`Delete ${s.label}`}
                disabled={busy !== null}
                onClick={() => confirm(`Delete “${s.title}”? To keep it but take it off the site, edit it and switch “Show on the site” off.`) && run(`del-${s.id}`, () => deleteServiceAction(s.id))}
              >
                {busy === `del-${s.id}` ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4 text-red-700" aria-hidden />}
              </IconBtn>
            </div>
          </li>
        ))}
      </ol>

      {editing && (
        <ServiceDialog
          key={editing.id ?? "new"}
          id={editing.id}
          initial={editing.value}
          onClose={() => setEditing(null)}
          onSaved={(r) => {
            setEditing(null);
            setResult(r);
          }}
        />
      )}
    </div>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="grid size-9 place-items-center rounded-lg border border-line-strong bg-ink-850 text-fg hover:bg-ink-900 disabled:opacity-40">
      {children}
    </button>
  );
}

function ServiceDialog({ id, initial, onClose, onSaved }: { id: string | null; initial: ServiceInput; onClose: () => void; onSaved: (r: ServiceResult) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [v, setV] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(id));
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
      const res = await saveServiceAction(id, v);
      if (res.ok) onSaved(res);
      else {
        setErrors(res.fieldErrors ?? {});
        setError(res.error);
      }
    });
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="service-title"
      className="m-auto w-[min(600px,calc(100vw-2rem))] rounded-2xl border border-line bg-ink-850 p-0 text-fg shadow-2xl backdrop:bg-[rgb(28_25_56/0.4)] backdrop:backdrop-blur-[2px]"
    >
      <div className="flex max-h-[88dvh] flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="service-title" className="text-base font-semibold">
            {id ? "Edit service" : "Add service"}
          </h2>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-fg-muted hover:bg-ink-900 hover:text-fg" aria-label="Close">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="grid gap-4 overflow-y-auto px-5 py-5">
          <TextField
            label="Title"
            value={v.title}
            error={errors.title}
            onChange={(e) => {
              const title = e.target.value;
              setV((c) => ({ ...c, title, slug: slugTouched ? c.slug : slugify(title) }));
            }}
            placeholder="Laptop Repair and Maintenance"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Short name" value={v.label} error={errors.label} onChange={(e) => setV({ ...v, label: e.target.value })} hint="Used in menus, e.g. “Laptops”." />
            <TextField
              label="Web address"
              prefix="/services/"
              value={v.slug}
              error={errors.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setV({ ...v, slug: slugify(e.target.value) });
              }}
            />
          </div>
          <TextField label="Description" value={v.description} error={errors.description} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={300} />
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-fg">What&apos;s included</legend>
            <div className="grid gap-2">
              {v.includes.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    aria-label={`Included item ${i + 1}`}
                    value={item}
                    onChange={(e) => setV({ ...v, includes: v.includes.map((x, j) => (j === i ? e.target.value : x)) })}
                    style={{ outline: "none" }}
                    className="h-10 flex-1 rounded-lg border border-line-strong bg-ink-850 px-3 text-sm focus:border-brand"
                  />
                  <button type="button" aria-label="Remove item" onClick={() => setV({ ...v, includes: v.includes.filter((_, j) => j !== i) })} className="grid size-10 place-items-center rounded-lg text-fg-dim hover:bg-ink-900">
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setV({ ...v, includes: [...v.includes, ""] })} className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-line-strong px-3 text-sm hover:bg-ink-900">
                <Plus className="size-4" aria-hidden /> Add item
              </button>
            </div>
          </fieldset>
          <SelectField label="Illustration" options={serviceVisuals.map((x) => ({ value: x.id, label: x.label }))} value={v.visual} onChange={(e) => setV({ ...v, visual: e.target.value as ServiceId })} />
          <div className="rounded-lg border border-line bg-ink-950 p-4">
            <ServiceVisual id={v.visual as ServiceId} />
          </div>
          <ToggleCard title="Show on the site" description="Hidden services stay here but disappear from the homepage and menus." checked={v.isActive} onChange={(isActive) => setV({ ...v, isActive })} />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button type="button" onClick={onClose} className={outlineButton}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={pending} className={`${primaryButton} disabled:opacity-80`}>
            {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            {pending ? "Saving…" : "Save service"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
