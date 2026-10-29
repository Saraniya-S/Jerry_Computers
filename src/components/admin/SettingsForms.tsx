"use client";

import { LoaderCircle, Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { saveHomeAction, saveShopAction, saveStoreAction, type SettingsResult } from "@/app/admin/settings/actions";
import { primaryButton } from "@/components/account/buttons";
import { FormAlert } from "@/components/auth/ui";
import { SelectField, TextField, ToggleCard } from "@/components/forms/controls";
import { indianStates } from "@/lib/customer";
import { accentParts, type HomeSettings, type ShopSettings } from "@/lib/settings";
import { ImageUploader } from "./ImageUploader";

const area =
  "w-full rounded-xl border border-line-strong bg-ink-850 px-3.5 py-3 text-[0.95rem] text-fg placeholder:text-fg-dim focus:border-brand focus:ring-4 focus:ring-[var(--brand-glow)]";

function useSave() {
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [pending, start] = useTransition();
  const save = (run: () => Promise<SettingsResult>) => {
    setResult(null);
    start(async () => setResult(await run()));
  };
  return { result, pending, save };
}

function SaveBar({ pending, result, label }: { pending: boolean; result: SettingsResult | null; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending} className={`${primaryButton} disabled:opacity-80`}>
        {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
        {pending ? "Saving…" : label}
      </button>
      {result && (
        <div className="min-w-0 flex-1">
          <FormAlert tone={result.ok ? "success" : "error"}>{result.ok ? result.message : result.error}</FormAlert>
        </div>
      )}
    </div>
  );
}

function Section({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-line py-6 last:border-0 lg:grid-cols-[220px_1fr] lg:gap-10">
      <div>
        <h2 className="text-sm font-medium text-fg">{title}</h2>
        {text && <p className="mt-1 text-sm text-fg-muted">{text}</p>}
      </div>
      <div className="grid max-w-2xl gap-4">{children}</div>
    </section>
  );
}

export function ShopForm({ initial }: { initial: ShopSettings }) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { result, pending, save } = useSave();
  const set = <K extends keyof ShopSettings>(k: K, value: ShopSettings[K]) => setV((c) => ({ ...c, [k]: value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(async () => {
          const r = await saveShopAction(v);
          setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
          return r;
        });
      }}
      className="px-5 sm:px-7"
    >
      <Section title="Business" text="Printed on invoices.">
        <TextField label="Legal / trading name" optional value={v.legalName} error={errors.legalName} onChange={(e) => set("legalName", e.target.value)} placeholder="Jerry Computers" />
        <TextField label="GSTIN" optional maxLength={15} value={v.gstin} error={errors.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase())} />
      </Section>
      <Section title="Shop address" text="Shown in the contact section and footer. The state decides CGST + SGST or IGST on invoices.">
        <TextField label="Street address" value={v.address} error={errors.address} onChange={(e) => set("address", e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <TextField label="City" value={v.city} error={errors.city} onChange={(e) => set("city", e.target.value)} />
          <TextField label="PIN code" inputMode="numeric" maxLength={6} value={v.postalCode} error={errors.postalCode} onChange={(e) => set("postalCode", e.target.value.replace(/\D/g, ""))} />
        </div>
        <SelectField label="State" options={indianStates} placeholder="Choose a state" value={v.state} error={errors.state} onChange={(e) => set("state", e.target.value as ShopSettings["state"])} />
        <TextField label="Map link" optional value={v.mapUrl} error={errors.mapUrl} onChange={(e) => set("mapUrl", e.target.value)} placeholder="https://maps.app.goo.gl/…" />
      </Section>
      <Section title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Phone" value={v.phone} error={errors.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" />
          <TextField label="Email" type="email" value={v.email} error={errors.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <TextField label="Service email" optional type="email" value={v.serviceEmail} error={errors.serviceEmail} onChange={(e) => set("serviceEmail", e.target.value)} />
      </Section>
      <Section title="Opening hours">
        {v.hours.map((h, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input aria-label="Days" value={h.days} placeholder="Mon – Sat" onChange={(e) => set("hours", v.hours.map((x, j) => (j === i ? { ...x, days: e.target.value } : x)))} style={{ outline: "none" }} className="h-10 rounded-lg border border-line-strong bg-ink-850 px-3 text-sm focus:border-brand" />
            <input aria-label="Hours" value={h.hours} placeholder="10:00 – 20:00" onChange={(e) => set("hours", v.hours.map((x, j) => (j === i ? { ...x, hours: e.target.value } : x)))} style={{ outline: "none" }} className="h-10 rounded-lg border border-line-strong bg-ink-850 px-3 text-sm focus:border-brand" />
            <button type="button" aria-label="Remove row" onClick={() => set("hours", v.hours.filter((_, j) => j !== i))} className="grid size-10 place-items-center rounded-lg text-fg-dim hover:bg-ink-900">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
        {v.hours.length < 7 && (
          <button type="button" onClick={() => set("hours", [...v.hours, { days: "", hours: "" }])} className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-line-strong px-3 text-sm hover:bg-ink-900">
            <Plus className="size-4" aria-hidden /> Add hours
          </button>
        )}
      </Section>
      <Section title="Social links" text="Shown in the footer.">
        {v.social.map((s, i) => (
          <div key={i} className="grid grid-cols-[140px_1fr_auto] gap-2">
            <input aria-label="Name" value={s.label} placeholder="Instagram" onChange={(e) => set("social", v.social.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} style={{ outline: "none" }} className="h-10 rounded-lg border border-line-strong bg-ink-850 px-3 text-sm focus:border-brand" />
            <input aria-label="Link" value={s.href} placeholder="https://…" onChange={(e) => set("social", v.social.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)))} style={{ outline: "none" }} className="h-10 rounded-lg border border-line-strong bg-ink-850 px-3 text-sm focus:border-brand" />
            <button type="button" aria-label="Remove link" onClick={() => set("social", v.social.filter((_, j) => j !== i))} className="grid size-10 place-items-center rounded-lg text-fg-dim hover:bg-ink-900">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
        {errors.social && <p className="text-[0.8rem] text-red-600">Each link needs a name and a full https:// address.</p>}
        {v.social.length < 8 && (
          <button type="button" onClick={() => set("social", [...v.social, { label: "", href: "" }])} className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-line-strong px-3 text-sm hover:bg-ink-900">
            <Plus className="size-4" aria-hidden /> Add link
          </button>
        )}
      </Section>
      <div className="py-6">
        <SaveBar pending={pending} result={result} label="Save shop details" />
      </div>
    </form>
  );
}

export function StoreForm({ initial }: { initial: { shipping: string; codEnabled: boolean } }) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { result, pending, save } = useSave();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(async () => {
          const r = await saveStoreAction(v);
          setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
          return r;
        });
      }}
      className="px-5 sm:px-7"
    >
      <Section title="Checkout" text="Applies to new orders.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Delivery charge" prefix="₹" inputMode="decimal" value={v.shipping} error={errors.shipping} onChange={(e) => setV({ ...v, shipping: e.target.value })} hint="Added to every order." />
        </div>
        <ToggleCard
          title="Cash on delivery"
          description="Master switch. COD is offered only when every item in the cart allows it (set on each product)."
          checked={v.codEnabled}
          onChange={(codEnabled) => setV({ ...v, codEnabled })}
        />
      </Section>
      <div className="pb-6">
        <SaveBar pending={pending} result={result} label="Save checkout settings" />
      </div>
    </form>
  );
}

export function HomeForm({ initial }: { initial: HomeSettings }) {
  const [v, setV] = useState(initial);
  const { result, pending, save } = useSave();
  const set = <K extends keyof HomeSettings>(k: K, value: HomeSettings[K]) => setV((c) => ({ ...c, [k]: value }));
  const accentHint = "Wrap a word in *asterisks* to colour it.";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(() => saveHomeAction(v));
      }}
      className="px-5 sm:px-7"
    >
      <Section title="Hero" text="The first screen of the homepage.">
        <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <TextField label="Badge" value={v.heroBadge} onChange={(e) => set("heroBadge", e.target.value)} maxLength={20} />
          <TextField label="Tagline" value={v.heroEyebrow} onChange={(e) => set("heroEyebrow", e.target.value)} maxLength={60} />
        </div>
        <TextField label="Headline" value={v.heroTitle} onChange={(e) => set("heroTitle", e.target.value)} maxLength={80} hint={accentHint} />
        <Preview text={v.heroTitle} />
        <div>
          <label htmlFor="hero-sub" className="mb-1.5 block text-sm font-medium text-fg">
            Intro
          </label>
          <textarea id="hero-sub" rows={3} maxLength={240} value={v.heroSubtitle} onChange={(e) => set("heroSubtitle", e.target.value)} style={{ outline: "none" }} className={area} />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-fg">What we do (up to 5)</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {v.heroPillars.map((p, i) => (
              <div key={i} className="relative">
                <input aria-label={`Pillar ${i + 1}`} value={p} maxLength={20} onChange={(e) => set("heroPillars", v.heroPillars.map((x, j) => (j === i ? e.target.value : x)))} style={{ outline: "none" }} className="h-10 w-full rounded-lg border border-line-strong bg-ink-850 px-3 pr-8 text-sm focus:border-brand" />
                {v.heroPillars.length > 1 && (
                  <button type="button" aria-label="Remove" onClick={() => set("heroPillars", v.heroPillars.filter((_, j) => j !== i))} className="absolute right-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-fg-dim hover:bg-ink-900">
                    <X className="size-3.5" aria-hidden />
                  </button>
                )}
              </div>
            ))}
            {v.heroPillars.length < 5 && (
              <button type="button" onClick={() => set("heroPillars", [...v.heroPillars, ""])} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong text-sm text-fg-muted hover:text-fg">
                <Plus className="size-4" aria-hidden /> Add
              </button>
            )}
          </div>
        </fieldset>
        <ImageUploader label="Background photo wall" value={v.heroImages} onChange={(heroImages) => set("heroImages", heroImages)} max={40} />
        <p className="-mt-2 text-[0.8rem] text-fg-dim">Leave empty to keep the built-in product photos. Add 12 or more for the best effect.</p>
      </Section>
      <Section title="About">
        <TextField label="Headline" value={v.aboutTitle} onChange={(e) => set("aboutTitle", e.target.value)} maxLength={80} hint={accentHint} />
        <Preview text={v.aboutTitle} />
        <div>
          <label htmlFor="about-body" className="mb-1.5 block text-sm font-medium text-fg">
            Text
          </label>
          <textarea id="about-body" rows={4} maxLength={500} value={v.aboutBody} onChange={(e) => set("aboutBody", e.target.value)} style={{ outline: "none" }} className={area} />
        </div>
      </Section>
      <Section title="Why choose us" text="The four stacked cards. Their tags and illustrations stay as designed.">
        {v.reasons.map((r, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-line bg-ink-950 p-3">
            <p className="font-mono text-xs text-fg-dim">Card {i + 1}</p>
            <TextField label="Title" value={r.title} maxLength={80} onChange={(e) => set("reasons", v.reasons.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <textarea aria-label={`Card ${i + 1} text`} rows={2} maxLength={300} value={r.body} onChange={(e) => set("reasons", v.reasons.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} style={{ outline: "none" }} className={area} />
          </div>
        ))}
      </Section>
      <Section title="Contact" text="Phone, email and hours come from Shop settings.">
        <TextField label="Headline" value={v.contactTitle} onChange={(e) => set("contactTitle", e.target.value)} maxLength={80} hint={accentHint} />
        <Preview text={v.contactTitle} />
        <TextField label="Text" value={v.contactBody} onChange={(e) => set("contactBody", e.target.value)} maxLength={240} />
      </Section>
      <div className="sticky bottom-3 z-10 my-6 rounded-2xl border border-line bg-ink-850/95 p-4 shadow-[0_16px_40px_-20px_var(--shadow)] backdrop-blur">
        <SaveBar pending={pending} result={result} label="Publish homepage" />
      </div>
    </form>
  );
}

function Preview({ text }: { text: string }) {
  return (
    <p className="-mt-2 rounded-lg bg-ink-950 px-3 py-2 text-lg font-medium tracking-[-0.02em] text-fg" aria-label="Preview">
      {accentParts(text).map((p, i) =>
        p.accent ? (
          <span key={i} className="font-serif font-normal italic">
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  );
}
