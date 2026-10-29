"use client";

import Link from "next/link";
import { LoaderCircle, Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { saveProductAction } from "@/app/admin/products/actions";
import { FormAlert } from "@/components/auth/ui";
import { ChipGroup, SelectField, TextField, ToggleCard } from "@/components/forms/controls";
import { ProductArt } from "@/components/products/ProductArt";
import { productCategories, productUses, type ProductCategoryId, type ProductUse } from "@/data/products";
import { gstRates, slugify, type ProductInput } from "@/lib/admin/product";
import { ImageUploader } from "./ImageUploader";

export type ProductFormValue = Omit<ProductInput, "category" | "uses" | "brandId" | "subcategoryId"> & {
  category: ProductCategoryId | "";
  uses: ProductUse[];
  brandId: string;
  subcategoryId: string;
};

export type ProductFormOptions = { brands: { id: string; name: string; isActive: boolean }[]; subcategories: { id: string; name: string; department: string }[] };

export const emptyProduct: ProductFormValue = {
  name: "",
  slug: "",
  sku: "",
  brandId: "",
  subcategoryId: "",
  category: "",
  summary: "",
  description: "",
  uses: [],
  specs: [],
  images: [],
  price: "",
  mrp: "",
  gstRateBp: 1800,
  stock: 0,
  lowStockThreshold: 2,
  isActive: true,
  isFeatured: false,
  codAvailable: false,
  artVariant: 0,
};

const area =
  "w-full rounded-xl border border-line-strong bg-ink-850 px-3.5 py-3 text-[0.95rem] text-fg placeholder:text-fg-dim focus:border-brand focus:ring-4 focus:ring-[var(--brand-glow)]";

/** Add or edit a product. Saves the whole product at once. */
export function ProductForm({ id, initial, options, archived = false }: { id: string | null; initial: ProductFormValue; options: ProductFormOptions; archived?: boolean }) {
  const [v, setV] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(id));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof ProductFormValue>(k: K, value: ProductFormValue[K]) => setV((cur) => ({ ...cur, [k]: value }));

  function save() {
    setResult(null);
    start(async () => {
      const res = await saveProductAction(id, { ...v, category: v.category as ProductCategoryId });
      if (res.ok) {
        setErrors({});
        setResult({ ok: true, text: res.message });
      } else {
        setErrors(res.fieldErrors ?? {});
        setResult({ ok: false, text: res.error ?? "Couldn't save." });
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="grid gap-8 p-5 sm:p-7 xl:grid-cols-[1fr_340px]"
    >
      <div className="grid content-start gap-6">
        <Card title="Basics">
          <TextField
            label="Product name"
            value={v.name}
            error={errors.name}
            onChange={(e) => {
              const name = e.target.value;
              setV((cur) => ({ ...cur, name, slug: slugTouched ? cur.slug : slugify(name) }));
            }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="SKU"
              value={v.sku}
              error={errors.sku}
              onChange={(e) => set("sku", e.target.value.toUpperCase())}
              placeholder="e.g. LEN-IP5-14-I5"
              hint="Unique across all products and variants."
              autoCapitalize="characters"
            />
            <SelectField
              label="Brand"
              options={[{ value: "", label: "No brand" }, ...options.brands.filter((b) => b.isActive || b.id === v.brandId).map((b) => ({ value: b.id, label: b.name }))]}
              value={v.brandId}
              error={errors.brandId}
              onChange={(e) => set("brandId", e.target.value)}
              hint={
                <>
                  Add brands under <Link href="/admin/brands" className="underline">Brands</Link>.
                </>
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Department"
              options={productCategories.map((c) => ({ value: c.id, label: c.label }))}
              placeholder="Choose a department"
              value={v.category}
              error={errors.category}
              onChange={(e) => setV((cur) => ({ ...cur, category: e.target.value as ProductCategoryId, subcategoryId: "" }))}
            />
            <SelectField
              label="Sub-category"
              options={[{ value: "", label: "None" }, ...options.subcategories.filter((c) => c.department === v.category).map((c) => ({ value: c.id, label: c.name }))]}
              value={v.subcategoryId}
              error={errors.subcategoryId}
              onChange={(e) => set("subcategoryId", e.target.value)}
              disabled={!v.category}
            />
          </div>
          <TextField
            label="Web address"
            prefix="/products/"
            value={v.slug}
            error={errors.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", slugify(e.target.value));
            }}
            hint={id ? "Changing it breaks old links to this product." : "Filled in from the name."}
          />
          <TextField label="One-line summary" value={v.summary} error={errors.summary} onChange={(e) => set("summary", e.target.value)} maxLength={200} />
          <div>
            <label htmlFor="desc" className="mb-1.5 block text-sm font-medium text-fg">
              Description <span className="font-normal text-fg-dim">· optional</span>
            </label>
            <textarea id="desc" rows={6} value={v.description} onChange={(e) => set("description", e.target.value)} style={{ outline: "none" }} className={area} />
          </div>
        </Card>

        <Card title="Photos">
          <ImageUploader value={v.images} onChange={(images) => set("images", images)} />
          {v.images.length === 0 && v.category && (
            <div>
              <p className="mb-2 text-sm text-fg-muted">Until there are photos, the store shows this artwork:</p>
              <div className="flex gap-2">
                {[0, 1, 2].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set("artVariant", n)}
                    aria-pressed={v.artVariant === n}
                    aria-label={`Artwork style ${n + 1}`}
                    className={`relative size-20 overflow-hidden rounded-xl border bg-[radial-gradient(80%_80%_at_50%_30%,var(--art-a),var(--art-b))] ${v.artVariant === n ? "border-brand ring-4 ring-[var(--brand-glow)]" : "border-line"}`}
                  >
                    <ProductArt category={v.category as ProductCategoryId} variant={n as 0 | 1 | 2} className="absolute inset-0 size-full p-2" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title="Specifications">
          {v.specs.length > 0 && (
            <div className="grid gap-2">
              {v.specs.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                  <input
                    aria-label={`Spec ${i + 1} name`}
                    value={s.label}
                    placeholder="e.g. Processor"
                    onChange={(e) => set("specs", v.specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    style={{ outline: "none" }}
                    className="h-10 rounded-lg border border-line-strong bg-ink-850 px-3 text-sm text-fg focus:border-brand"
                  />
                  <input
                    aria-label={`Spec ${i + 1} value`}
                    value={s.value}
                    placeholder="e.g. Intel Core i5-1335U"
                    onChange={(e) => set("specs", v.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                    style={{ outline: "none" }}
                    className="h-10 rounded-lg border border-line-strong bg-ink-850 px-3 text-sm text-fg focus:border-brand"
                  />
                  <button type="button" aria-label="Remove spec" onClick={() => set("specs", v.specs.filter((_, j) => j !== i))} className="grid size-10 place-items-center rounded-lg text-fg-dim hover:bg-ink-900 hover:text-fg">
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => set("specs", [...v.specs, { label: "", value: "" }])}
            className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-line-strong px-3 text-sm text-fg hover:bg-ink-900"
          >
            <Plus className="size-4" aria-hidden /> Add a spec
          </button>
        </Card>
      </div>

      <div className="grid content-start gap-6">
        <Card title="Price and stock">
          <TextField label="Selling price" prefix="₹" inputMode="decimal" value={v.price} error={errors.price} onChange={(e) => set("price", e.target.value)} hint="Including GST. Leave empty to show “Price on enquiry”." />
          <TextField label="MRP" optional prefix="₹" inputMode="decimal" value={v.mrp} error={errors.mrp} onChange={(e) => set("mrp", e.target.value)} hint="Shown struck through with the saving." />
          <SelectField
            label="GST rate"
            options={gstRates.map((r) => r.label)}
            value={gstRates.find((r) => r.bp === v.gstRateBp)?.label ?? "18%"}
            onChange={(e) => set("gstRateBp", gstRates.find((r) => r.label === e.target.value)!.bp)}
            hint="Used to split tax out on the invoice."
          />
          {id ? (
            <div className="rounded-xl border border-line bg-ink-950 px-4 py-3 text-sm">
              <p className="text-fg">
                <span className="font-semibold tabular-nums">{v.stock}</span> on the shelf
              </p>
              <p className="mt-0.5 text-[0.8rem] text-fg-muted">
                Restocks and corrections are logged in <Link href={`/admin/inventory?product=${id}`} className="underline">Inventory</Link>.
              </p>
            </div>
          ) : (
            <TextField
              label="Opening stock"
              type="number"
              min={0}
              value={String(v.stock)}
              error={errors.stock}
              onChange={(e) => set("stock", Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              hint="Logged as the opening balance."
            />
          )}
          <TextField
            label="Low-stock level"
            type="number"
            min={0}
            value={String(v.lowStockThreshold)}
            error={errors.lowStockThreshold}
            onChange={(e) => set("lowStockThreshold", Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            hint="Flagged as low stock at or below this."
          />
        </Card>

        <Card title="Visibility">
          {archived ? (
            <p className="rounded-xl bg-ink-900 px-4 py-3 text-sm text-fg-muted">Archived products stay out of the store. Restore it first to sell it again.</p>
          ) : (
            <ToggleCard title="Show in the store" description="Hidden products can't be found or bought." checked={v.isActive} onChange={(x) => set("isActive", x)} />
          )}
          <ToggleCard title="Featured" description="Highlighted first in the catalogue." checked={v.isFeatured} onChange={(x) => set("isFeatured", x)} />
          <ToggleCard title="Cash on delivery" description="Allow paying on delivery for this product. Orders with any item without it are paid online." checked={v.codAvailable} onChange={(x) => set("codAvailable", x)} />
          <ChipGroup label="Good for" options={productUses.map((u) => ({ value: u.id, label: u.label }))} value={v.uses} onChange={(uses) => set("uses", uses)} />
        </Card>

        <div className="sticky bottom-3 grid gap-3 rounded-2xl border border-line bg-ink-850/95 p-4 shadow-[0_16px_40px_-20px_var(--shadow)] backdrop-blur">
          {result && <FormAlert tone={result.ok ? "success" : "error"}>{result.text}</FormAlert>}
          <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand text-sm font-medium text-white hover:bg-[var(--brand-hover)] disabled:opacity-70">
            {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            {pending ? "Saving…" : id ? "Save changes" : "Create product"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line">
      <h2 className="border-b border-line bg-ink-950 px-4 py-3 text-sm font-medium text-fg sm:px-5">{title}</h2>
      <div className="grid gap-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}
