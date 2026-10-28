"use client";

import { ArrowLeft, ArrowRight, ImagePlus, LoaderCircle, Star, X } from "lucide-react";
import { useRef, useState } from "react";

/** Upload, order and remove images. The first image is the main one. */
export function ImageUploader({ value, onChange, max = 8, label = "Photos" }: { value: string[]; onChange: (urls: string[]) => void; max?: number; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const body = new FormData();
    for (const f of Array.from(files).slice(0, max - value.length)) body.append("files", f);
    try {
      const res = await fetch("/api/admin/uploads", { method: "POST", body });
      const json = (await res.json()) as { urls?: string[]; error?: string };
      if (!res.ok || !json.urls) throw new Error(json.error ?? "Upload failed.");
      onChange([...value, ...json.urls].slice(0, max));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-fg">
        {label} <span className="font-normal text-fg-dim">· {value.length}/{max}, the first is the main image</span>
      </p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {value.map((src, i) => (
          <div key={src} className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-ink-950">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded file */}
            <img src={src} alt="" className="size-full object-contain p-2" />
            {i === 0 && (
              <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-medium text-white">
                <Star className="size-2.5" aria-hidden /> Main
              </span>
            )}
            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <span className="flex gap-1">
                <IconBtn label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowLeft className="size-3.5" aria-hidden />
                </IconBtn>
                <IconBtn label="Move later" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
                  <ArrowRight className="size-3.5" aria-hidden />
                </IconBtn>
              </span>
              <IconBtn label="Remove image" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <X className="size-3.5" aria-hidden />
              </IconBtn>
            </div>
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong bg-ink-950 text-xs text-fg-muted transition-colors hover:border-brand/40 hover:text-fg disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
            {busy ? "Uploading…" : "Add images"}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => upload(e.target.files)} />
      <p className="mt-1.5 text-[0.8rem] text-fg-dim">JPEG, PNG, WebP or GIF, up to 5 MB each. Square photos on a plain background look best.</p>
      {error && <p className="mt-1 text-[0.8rem] text-red-600">{error}</p>}
    </div>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-7 place-items-center rounded-md bg-ink-850/95 text-fg shadow-sm hover:bg-white disabled:opacity-40"
    >
      {children}
    </button>
  );
}
