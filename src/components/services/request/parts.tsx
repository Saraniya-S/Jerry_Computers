"use client";

import Link from "next/link";
import {
  BatteryCharging,
  CalendarDays,
  Check,
  CircleCheck,
  Clock,
  Laptop,
  LocateFixed,
  LoaderCircle,
  type LucideIcon,
  MapPin,
  Monitor,
  Pencil,
  Phone,
  Printer,
  Stethoscope,
  Store,
  Cctv,
} from "lucide-react";
import { createElement, useState, type ReactNode } from "react";
import { AddressFields, type AddressDraft } from "@/components/forms/AddressFields";
import { SelectField, TextField } from "@/components/forms/controls";
import { istDay, PREFERENCE_DAYS, preferredWindows } from "@/lib/service-request-form";
import type { SubmittedRequest } from "@/lib/server/customer-service-requests";
import { OTHER, STEPS, type Draft, type RequestAccount, type RequestService, type ShopInfo } from "./types";

type Set = <K extends keyof Draft>(k: K, v: Draft[K]) => void;
type Errors = Record<string, string>;

const icons: Record<string, LucideIcon> = { laptop: Laptop, desktop: Monitor, cctv: Cctv, printer: Printer, ups: BatteryCharging, diagnostics: Stethoscope };
/** The icon for a service's illustration kind. */
export function ServiceIcon({ visual, className }: { visual: string; className?: string }) {
  return createElement(icons[visual] ?? Stethoscope, { className, "aria-hidden": true });
}

const area =
  "w-full rounded-xl border bg-ink-850 px-3.5 py-3 text-[0.95rem] text-fg placeholder:text-fg-dim focus:ring-4";
const areaOk = "border-line-strong focus:border-brand focus:ring-[var(--brand-glow)]";
const areaBad = "border-red-400 focus:border-red-500 focus:ring-red-500/15";
const focusRing = "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-glow)]";

function Err({ id, msg }: { id: string; msg?: string }) {
  return msg ? (
    <p id={id} className="mt-1.5 text-[0.8rem] text-red-600">
      {msg}
    </p>
  ) : null;
}

/** Numbered progress across the top; finished steps can be revisited. */
export function Stepper({ step, onJump }: { step: number; onJump: (i: number) => void }) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Progress">
      {STEPS.map((label, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <li key={label}>
            <button
              type="button"
              onClick={() => onJump(i)}
              disabled={!done}
              aria-current={current ? "step" : undefined}
              className={`group flex w-full flex-col gap-2 text-left disabled:cursor-default ${focusRing} rounded-lg`}
            >
              <span className={`h-1 rounded-full transition-colors ${i <= step ? "bg-brand" : "bg-ink-800"}`} aria-hidden />
              <span className="flex items-center gap-2 text-xs sm:text-sm">
                <span
                  className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-medium ${
                    done ? "bg-brand text-white" : current ? "border border-brand text-brand" : "border border-line-strong text-fg-dim"
                  }`}
                >
                  {done ? <Check className="size-3" aria-hidden /> : i + 1}
                </span>
                <span className={`truncate ${current ? "font-medium text-fg" : done ? "text-fg-muted group-hover:text-fg" : "text-fg-dim"}`}>{label}</span>
                <span className="sr-only">{done ? "(done)" : current ? "(current step)" : ""}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-[-0.01em] text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** Step 1: the service cards, then the problems listed for the chosen service. */
export function ServiceStep({ services, draft, set, errors }: { services: RequestService[]; draft: Draft; set: Set; errors: Errors }) {
  const chosen = services.find((s) => s.slug === draft.serviceSlug);
  return (
    <>
      <Section title="What do you need help with?" description="Pick the service that fits your device.">
        <div role="radiogroup" aria-label="Service" aria-describedby={errors.serviceSlug ? "serviceSlug-msg" : undefined} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {services.map((s) => {
            const on = s.slug === draft.serviceSlug;
            return (
              <button
                key={s.slug}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  if (!on) {
                    set("serviceSlug", s.slug);
                    set("problemType", "");
                  }
                }}
                className={`relative flex h-full flex-col rounded-xl border p-4 text-left transition-[border-color,box-shadow,background-color] ${focusRing} ${
                  on ? "border-brand bg-brand/[0.04] ring-4 ring-[var(--brand-glow)]" : "border-line bg-ink-950 hover:border-brand/30"
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className={`grid size-10 place-items-center rounded-lg ${on ? "bg-brand text-white" : "bg-ink-850 text-brand shadow-[0_1px_2px_var(--line)]"}`}>
                    <ServiceIcon visual={s.visual} className="size-5" />
                  </span>
                  <span className={`grid size-5 place-items-center rounded-full border ${on ? "border-brand bg-brand" : "border-line-strong"}`} aria-hidden>
                    {on && <Check className="size-3 text-white" />}
                  </span>
                </span>
                <span className="mt-3 font-medium text-fg">{s.title}</span>
                <span className="mt-1 text-sm leading-snug text-fg-muted">{s.description}</span>
                {s.includes.length > 0 && (
                  <span className="mt-3 flex flex-wrap gap-1.5">
                    {s.includes.slice(0, 3).map((x) => (
                      <span key={x} className="rounded-md bg-ink-900 px-1.5 py-0.5 text-[11px] text-fg-muted">
                        {x}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <Err id="serviceSlug-msg" msg={errors.serviceSlug} />
      </Section>

      {chosen && (
        <Section title="What's the problem?" description={`Choose the closest match for ${chosen.label.toLowerCase()}. You'll describe it in your own words next.`}>
          <div role="radiogroup" aria-label="Problem" aria-describedby={errors.problemType ? "problemType-msg" : undefined} className="flex flex-wrap gap-2">
            {[...chosen.includes, OTHER].map((p) => {
              const on = draft.problemType === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set("problemType", p)}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors ${focusRing} ${
                    on ? "border-brand bg-brand text-white" : "border-line-strong bg-ink-850 text-fg-muted hover:border-fg/30 hover:text-fg"
                  }`}
                >
                  {on && <Check className="size-3.5" aria-hidden />}
                  {p === OTHER ? "Something else" : p}
                </button>
              );
            })}
          </div>
          <Err id="problemType-msg" msg={errors.problemType} />
        </Section>
      )}
    </>
  );
}

/** Step 2: the device and the problem in the customer's words. */
export function DeviceStep({ service, draft, set, errors }: { service: RequestService | null; draft: Draft; set: Set; errors: Errors }) {
  return (
    <Section title="About your device" description="This helps the engineer bring the right tools and parts.">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Brand" optional value={draft.deviceBrand} error={errors.deviceBrand} onChange={(e) => set("deviceBrand", e.target.value)} placeholder="e.g. Dell, HP, Hikvision" maxLength={60} />
        <TextField
          label="Model or device name"
          value={draft.deviceModel}
          error={errors.deviceModel}
          onChange={(e) => set("deviceModel", e.target.value)}
          placeholder={service?.visual === "cctv" ? "e.g. 8-channel DVR with 6 cameras" : "e.g. Inspiron 15 3520"}
          maxLength={80}
        />
      </div>
      <TextField
        label="Serial number"
        optional
        value={draft.serialNumber}
        error={errors.serialNumber}
        onChange={(e) => set("serialNumber", e.target.value)}
        hint="Usually on a sticker underneath or on the back. Skip it if you can't find it."
        maxLength={80}
      />
      <div>
        <label htmlFor="issue" className="mb-1.5 block text-sm font-medium text-fg">
          Describe the problem
        </label>
        <textarea
          id="issue"
          rows={5}
          value={draft.issue}
          onChange={(e) => set("issue", e.target.value)}
          maxLength={2000}
          aria-invalid={errors.issue ? true : undefined}
          aria-describedby="issue-msg"
          placeholder="What happens, since when, and anything you've already tried."
          style={{ outline: "none" }}
          className={`${area} ${errors.issue ? areaBad : areaOk}`}
        />
        {errors.issue ? (
          <Err id="issue-msg" msg={errors.issue} />
        ) : (
          <p id="issue-msg" className="mt-1.5 text-[0.8rem] text-fg-dim">
            {draft.issue.trim().length}/2000
          </p>
        )}
      </div>
    </Section>
  );
}

type LocState = { status: "idle" } | { status: "asking" } | { status: "shared" } | { status: "error"; message: string };

/** Step 3: on-site (address, optional live location) or in-shop (shop details), plus an optional preferred time. */
export function MethodStep({ draft, set, errors, account, shop }: { draft: Draft; set: Set; errors: Errors; account: RequestAccount | null; shop: ShopInfo | null }) {
  const [loc, setLoc] = useState<LocState>(draft.pin ? { status: "shared" } : { status: "idle" });
  // The days a preference can fall on, fixed when the step opens.
  const [{ today, last }] = useState(() => {
    const now = new Date();
    return { today: istDay(now), last: istDay(new Date(now.getTime() + PREFERENCE_DAYS * 86_400_000)) };
  });
  const addrErrors = Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith("address.")).map(([k, v]) => [k.slice(8), v]));

  function shareLocation() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLoc({ status: "error", message: "This browser can't share a location. Enter the address below." });
      return;
    }
    setLoc({ status: "asking" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set("pin", `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
        set("pinAccuracy", Math.round(pos.coords.accuracy));
        setLoc({ status: "shared" });
      },
      (err) => {
        set("pin", "");
        set("pinAccuracy", null);
        setLoc({
          status: "error",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Location permission was turned down. That's fine: enter the address below and the engineer will use it for directions."
              : "We couldn't get your location just now. Enter the address below instead.",
        });
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  const methods = [
    { value: "on_site" as const, icon: MapPin, title: "On-site service", body: "An engineer comes to your home or office." },
    { value: "in_shop" as const, icon: Store, title: "In-shop service", body: "You bring the device to our shop." },
  ];

  return (
    <>
      <Section title="How would you like it serviced?">
        <div role="radiogroup" aria-label="Service method" aria-describedby={errors.location ? "location-msg" : undefined} className="grid gap-3 sm:grid-cols-2">
          {methods.map((m) => {
            const on = draft.location === m.value;
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set("location", m.value)}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-[border-color,box-shadow,background-color] ${focusRing} ${
                  on ? "border-brand bg-brand/[0.04] ring-4 ring-[var(--brand-glow)]" : "border-line bg-ink-950 hover:border-brand/30"
                }`}
              >
                <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${on ? "bg-brand text-white" : "bg-ink-850 text-brand shadow-[0_1px_2px_var(--line)]"}`}>
                  <m.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 font-medium text-fg">
                    {m.title}
                    <span className={`grid size-5 place-items-center rounded-full border ${on ? "border-brand bg-brand" : "border-line-strong"}`} aria-hidden>
                      {on && <Check className="size-3 text-white" />}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-sm text-fg-muted">{m.body}</span>
                </span>
              </button>
            );
          })}
        </div>
        <Err id="location-msg" msg={errors.location} />
      </Section>

      {draft.location === "on_site" && (
        <Section title="Where should the engineer come?">
          {account && account.addresses.length > 0 && (
            <div role="radiogroup" aria-label="Service address" className="grid gap-2">
              {account.addresses.map((a) => (
                <label key={a.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm ${draft.addressChoice === a.id ? "border-brand bg-brand/[0.04]" : "border-line hover:border-brand/30"}`}>
                  <input type="radio" name="addressChoice" checked={draft.addressChoice === a.id} onChange={() => set("addressChoice", a.id)} className="mt-1 accent-brand" />
                  <span>
                    <span className="font-medium text-fg">
                      {a.label}
                      {a.isDefault && <span className="ml-1.5 text-xs font-normal text-fg-dim">default</span>}
                    </span>
                    <span className="block text-fg-muted">{[a.line1, a.line2, a.city, `${a.state} ${a.postalCode}`].filter(Boolean).join(", ")}</span>
                  </span>
                </label>
              ))}
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${draft.addressChoice === "new" ? "border-brand bg-brand/[0.04]" : "border-line hover:border-brand/30"}`}>
                <input type="radio" name="addressChoice" checked={draft.addressChoice === "new"} onChange={() => set("addressChoice", "new")} className="accent-brand" />
                <span className="font-medium text-fg">A different address</span>
              </label>
            </div>
          )}
          {(!account || !account.addresses.length || draft.addressChoice === "new") && (
            <AddressFields value={draft.address} onChange={(a: AddressDraft) => set("address", a)} errors={addrErrors} />
          )}

          <div className="rounded-xl border border-line bg-ink-950 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">Share your exact location</p>
                <p className="mt-0.5 text-[0.8rem] text-fg-muted">Optional. Gives the engineer turn-by-turn directions. We still need the address above.</p>
              </div>
              <button
                type="button"
                onClick={shareLocation}
                disabled={loc.status === "asking"}
                className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line-strong bg-ink-850 px-4 text-sm text-fg hover:bg-ink-900 disabled:opacity-60 ${focusRing}`}
              >
                {loc.status === "asking" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <LocateFixed className="size-4" aria-hidden />}
                {loc.status === "shared" ? "Update location" : "Use my current location"}
              </button>
            </div>
            <div aria-live="polite">
              {loc.status === "shared" && draft.pin && (
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-leaf">
                  <span className="inline-flex items-center gap-1">
                    <CircleCheck className="size-3.5" aria-hidden /> Location shared{draft.pinAccuracy ? ` (accurate to about ${draft.pinAccuracy} m)` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      set("pin", "");
                      set("pinAccuracy", null);
                      setLoc({ status: "idle" });
                    }}
                    className="text-fg-muted underline hover:text-fg"
                  >
                    Remove
                  </button>
                </p>
              )}
              {loc.status === "error" && <p className="mt-3 text-[0.8rem] text-amber-800">{loc.message}</p>}
            </div>
          </div>
        </Section>
      )}

      {draft.location === "in_shop" && (
        <Section title="Bring your device to the shop">
          {shop ? (
            <div className="grid gap-3 rounded-xl border border-line bg-ink-950 p-4 text-sm sm:grid-cols-2">
              <address className="not-italic leading-relaxed text-fg-muted">
                <span className="block font-medium text-fg">{shop.name}</span>
                {shop.address}
                {shop.place && <span className="block">{shop.place}</span>}
                {shop.mapUrl && (
                  <a href={shop.mapUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-brand hover:underline">
                    <MapPin className="size-3.5" aria-hidden /> Open in maps
                  </a>
                )}
              </address>
              <div className="grid content-start gap-1 text-fg-muted">
                {shop.phone && (
                  <a href={`tel:${shop.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-brand">
                    <Phone className="size-3.5" aria-hidden /> {shop.phone}
                  </a>
                )}
                {shop.hours.map((h) => (
                  <span key={h.days} className="inline-flex items-center gap-1.5">
                    <Clock className="size-3.5" aria-hidden /> {h.days}: {h.hours}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-line bg-ink-950 p-4 text-sm text-fg-muted">The shop&apos;s address will be confirmed when we contact you about your request.</p>
          )}
        </Section>
      )}

      {draft.location && (
        <Section title={draft.location === "on_site" ? "When suits you?" : "When will you drop it off?"} description="Optional. This is a preference, not a booking: the shop will confirm a time with you.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="preferredDate" className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-fg">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4 text-fg-dim" aria-hidden /> Preferred day
                </span>
                <span className="text-xs font-normal text-fg-dim">Optional</span>
              </label>
              <input
                id="preferredDate"
                type="date"
                min={today}
                max={last}
                value={draft.preferredDate}
                onChange={(e) => set("preferredDate", e.target.value)}
                aria-invalid={errors.preferredDate ? true : undefined}
                aria-describedby={errors.preferredDate ? "preferredDate-msg" : undefined}
                style={{ outline: "none" }}
                className={`h-11 w-full rounded-xl border bg-ink-850 px-3.5 text-[0.95rem] text-fg focus:ring-4 ${errors.preferredDate ? areaBad : areaOk}`}
              />
              <Err id="preferredDate-msg" msg={errors.preferredDate} />
            </div>
            <SelectField
              label="Preferred time"
              options={[{ value: "", label: "Any time" }, ...preferredWindows.map((w) => ({ value: w.value, label: w.label }))]}
              value={draft.preferredWindow}
              onChange={(e) => set("preferredWindow", e.target.value)}
            />
          </div>
        </Section>
      )}

      {draft.location && account && !account.phone && (
        <Section title="How can we reach you?">
          <TextField label="Mobile number" prefix="+91" inputMode="tel" value={draft.phone} error={errors.phone} onChange={(e) => set("phone", e.target.value)} hint="Your account has no mobile number yet." />
        </Section>
      )}
    </>
  );
}

const windowLabel = (w: string) => preferredWindows.find((x) => x.value === w)?.label ?? "Any time";
const dayLabel = (d: string) => new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(`${d}T12:00:00+05:30`));

function Row({ label, children, onEdit }: { label: string; children: ReactNode; onEdit?: () => void }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr_auto] sm:items-start sm:gap-4">
      <dt className="text-xs text-fg-dim sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 text-sm text-fg">{children}</dd>
      {onEdit && (
        <button type="button" onClick={onEdit} className={`inline-flex items-center gap-1 justify-self-start text-xs text-brand hover:underline sm:justify-self-end ${focusRing} rounded`}>
          <Pencil className="size-3" aria-hidden /> Edit
        </button>
      )}
    </div>
  );
}

/** Step 4: everything on one card, with an edit link back to each step. */
export function ReviewStep({ draft, service, address, shop, onEdit }: { draft: Draft; service: RequestService | null; address: AddressDraft | null; shop: ShopInfo | null; onEdit: (step: number) => void }) {
  return (
    <Section title="Check your request" description="Make sure everything's right before you send it.">
      <dl className="divide-y divide-line rounded-xl border border-line">
        <Row label="Service" onEdit={() => onEdit(0)}>
          {service?.title ?? "—"}
          {draft.problemType && <span className="block text-fg-muted">{draft.problemType === OTHER ? "Something else" : draft.problemType}</span>}
        </Row>
        <Row label="Device" onEdit={() => onEdit(1)}>
          {[draft.deviceBrand, draft.deviceModel].filter(Boolean).join(" ") || "—"}
          {draft.serialNumber && <span className="block text-fg-muted">Serial {draft.serialNumber}</span>}
        </Row>
        <Row label="Problem" onEdit={() => onEdit(1)}>
          <span className="whitespace-pre-line">{draft.issue}</span>
        </Row>
        <Row label="Service method" onEdit={() => onEdit(2)}>
          {draft.location === "on_site" ? "On-site visit" : "In-shop service"}
        </Row>
        {draft.location === "on_site" && address && (
          <Row label="Address" onEdit={() => onEdit(2)}>
            {address.recipientName && <span className="block">{address.recipientName}</span>}
            <span className="block text-fg-muted">{[address.line1, address.line2, address.landmark && `Near ${address.landmark.replace(/^near\s+/i, "")}`, address.city, `${address.state} ${address.postalCode}`].filter(Boolean).join(", ")}</span>
            {draft.pin && <span className="block text-xs text-leaf">Exact location shared</span>}
          </Row>
        )}
        {draft.location === "in_shop" && (
          <Row label="Shop">
            {shop ? (
              <>
                {shop.name}
                <span className="block text-fg-muted">{[shop.address, shop.place].filter(Boolean).join(", ")}</span>
              </>
            ) : (
              <span className="text-fg-muted">Confirmed when we contact you</span>
            )}
          </Row>
        )}
        <Row label="Preferred time" onEdit={() => onEdit(2)}>
          {draft.preferredDate ? `${dayLabel(draft.preferredDate)} · ${windowLabel(draft.preferredWindow)}` : <span className="text-fg-muted">No preference</span>}
        </Row>
        {draft.phone && (
          <Row label="Mobile" onEdit={() => onEdit(2)}>
            {draft.phone}
          </Row>
        )}
      </dl>
    </Section>
  );
}

/** The request so far, beside the form on wide screens. */
export function Summary({ draft, service, address, step }: { draft: Draft; service: RequestService | null; address: AddressDraft | null; step: number }) {
  return (
    <aside aria-label="Your request so far" className="hidden h-fit rounded-xl border border-line bg-ink-950 lg:sticky lg:top-20 lg:block">
      <h2 className="border-b border-line px-4 py-3 text-sm font-medium text-fg">Your request</h2>
      <dl className="grid gap-3 px-4 py-4 text-sm">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink-850 text-brand shadow-[0_1px_2px_var(--line)]">
            <ServiceIcon visual={service?.visual ?? "diagnostics"} className="size-4" />
          </span>
          <div className="min-w-0">
            <dt className="sr-only">Service</dt>
            <dd className="font-medium text-fg">{service?.title ?? "No service chosen yet"}</dd>
            {draft.problemType && <dd className="text-fg-muted">{draft.problemType === OTHER ? "Something else" : draft.problemType}</dd>}
          </div>
        </div>
        {step >= 1 && (draft.deviceBrand || draft.deviceModel) && (
          <div>
            <dt className="text-xs text-fg-dim">Device</dt>
            <dd className="text-fg">{[draft.deviceBrand, draft.deviceModel].filter(Boolean).join(" ")}</dd>
          </div>
        )}
        {draft.location && (
          <div>
            <dt className="text-xs text-fg-dim">Method</dt>
            <dd className="text-fg">{draft.location === "on_site" ? "On-site visit" : "In-shop service"}</dd>
            {draft.location === "on_site" && address?.city && <dd className="text-fg-muted">{[address.city, address.postalCode].filter(Boolean).join(" ")}</dd>}
          </div>
        )}
        {draft.preferredDate && (
          <div>
            <dt className="text-xs text-fg-dim">Preferred</dt>
            <dd className="text-fg">
              {dayLabel(draft.preferredDate)} · {windowLabel(draft.preferredWindow).split(" (")[0]}
            </dd>
          </div>
        )}
      </dl>
      <p className="border-t border-line px-4 py-3 text-xs text-fg-dim">Sending a request doesn&apos;t book a time. The shop confirms the details with you.</p>
    </aside>
  );
}

/** Shown after the server has created the ticket; everything here comes from its response. */
export function SuccessCard({ request, service, location, shop, onAnother }: { request: SubmittedRequest; service: RequestService | null; location: Draft["location"]; shop: ShopInfo | null; onAnother: () => void }) {
  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-5 py-12 text-center sm:px-7">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-mint-soft text-leaf">
        <CircleCheck className="size-7" aria-hidden />
      </span>
      <div role="status">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-fg">Service request sent</h2>
        <p className="mt-1.5 text-fg-muted">
          Your ticket number is <span className="font-mono font-semibold text-fg">{request.ticket}</span>. We&apos;ve saved it to your account.
        </p>
      </div>
      <dl className="divide-y divide-line rounded-xl border border-line text-left text-sm">
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-fg-muted">Service</dt>
          <dd className="text-right text-fg">{service?.title ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-fg-muted">Method</dt>
          <dd className="text-right text-fg">{location === "on_site" ? "On-site visit" : "In-shop service"}</dd>
        </div>
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-fg-muted">Engineer</dt>
          <dd className="text-right text-fg">{request.assigned ? `Assigned${request.engineerFirstName ? ` to ${request.engineerFirstName}` : ""}` : "Being assigned"}</dd>
        </div>
      </dl>
      <div className="rounded-xl bg-ink-950 p-4 text-left text-sm text-fg-muted">
        <p className="font-medium text-fg">What happens next</p>
        <p className="mt-1">
          {request.assigned ? "Your engineer will review the details" : "We'll pick an engineer for your job"} and contact you to confirm{" "}
          {location === "on_site" ? "a visit time." : `when to bring the device in${shop ? ` to ${shop.name}` : ""}.`} You can follow progress from your account.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href={`/account/services/${request.id}`} className="inline-flex h-11 items-center justify-center rounded-full bg-brand text-sm font-medium text-white hover:bg-[var(--brand-hover)]">
          View request details
        </Link>
        <Link href="/account" className="inline-flex h-11 items-center justify-center rounded-full border border-line-strong text-sm text-fg hover:bg-ink-900">
          Go to my account
        </Link>
      </div>
      <button type="button" onClick={onAnother} className="text-sm text-fg-muted underline hover:text-fg">
        Request another service
      </button>
    </div>
  );
}
