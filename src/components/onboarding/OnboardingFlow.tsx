"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, LoaderCircle, PartyPopper } from "lucide-react";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { completeOnboarding } from "@/app/onboarding/actions";
import { AddressFields, emptyAddress, type AddressDraft } from "@/components/forms/AddressFields";
import { ChipGroup, Segmented, TextField, ToggleCard } from "@/components/forms/controls";
import { LogoMark } from "@/components/ui/Logo";
import { productCategories, type ProductCategoryId } from "@/data/products";
import { addressSchema, contactSchema, fieldErrors, preferencesSchema } from "@/lib/customer";

const steps = [
  { id: "account", label: "Account" },
  { id: "contact", label: "Contact" },
  { id: "address", label: "Address" },
  { id: "preferences", label: "Preferences" },
  { id: "finish", label: "Finish" },
] as const;
type StepId = (typeof steps)[number]["id"];

type Props = { firstName: string; lastName: string; phone: string; email: string };

/**
 * Welcome steps after a customer verifies their email, after ReactBits Pro "Onboarding 7":
 * a numbered stepper across the top and one short, focused form per step.
 */
export function OnboardingFlow({ firstName, lastName, phone, email }: Props) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<StepId>("contact");
  const [dir, setDir] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [contact, setContact] = useState({ firstName, lastName, phone });
  const [address, setAddress] = useState<AddressDraft>(() => emptyAddress(`${firstName} ${lastName}`.trim(), phone));
  const [prefs, setPrefs] = useState({
    customerType: "personal" as "personal" | "business",
    companyName: "",
    gstin: "",
    whatsappUpdates: true,
    interests: [] as ProductCategoryId[],
  });

  const index = steps.findIndex((s) => s.id === step);

  function go(to: StepId) {
    setDir(steps.findIndex((s) => s.id === to) > index ? 1 : -1);
    setErrors({});
    setStep(to);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function next() {
    if (step === "contact") {
      const r = contactSchema.safeParse(contact);
      if (!r.success) return setErrors(fieldErrors(r.error));
      // Carry the phone into the address the first time through.
      if (!address.phone) setAddress((a) => ({ ...a, phone: contact.phone }));
      if (!address.recipientName.trim()) setAddress((a) => ({ ...a, recipientName: `${contact.firstName} ${contact.lastName}`.trim() }));
      return go("address");
    }
    if (step === "address") {
      const r = addressSchema.safeParse(address);
      if (!r.success) return setErrors(fieldErrors(r.error));
      return go("preferences");
    }
    if (step === "preferences") {
      const r = preferencesSchema.safeParse(prefs);
      if (!r.success) return setErrors(fieldErrors(r.error));
      setServerError(null);
      startTransition(async () => {
        try {
          const res = await completeOnboarding({ contact, address, preferences: prefs });
          if (res.ok) return go("finish");
          go(res.step);
          setErrors(res.fieldErrors);
        } catch {
          setServerError("We couldn't save your details. Please try again.");
        }
      });
    }
  }

  const back = () => go(steps[index - 1].id);

  return (
    <div className="flex min-h-dvh flex-col bg-ink-950">
      <header className="border-b border-line bg-ink-850/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="Jerry Computers — home" className="shrink-0">
            <LogoMark className="size-8" />
          </Link>
          <Stepper current={index} />
          {step !== "finish" ? (
            <Link href="/account" className="ml-auto shrink-0 text-sm text-fg-muted hover:text-fg">
              Skip for now
            </Link>
          ) : (
            <span className="ml-auto w-[5.5rem]" />
          )}
        </div>
      </header>

      <main id="main" className="flex flex-1 justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-[460px]">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step}
              custom={dir}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -24 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {step === "contact" && (
                <Step headingRef={headingRef} title="How can we reach you?" text="Engineers and couriers use these details for repairs and deliveries.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      label="First name"
                      autoComplete="given-name"
                      value={contact.firstName}
                      onChange={(e) => setContact({ ...contact, firstName: e.target.value })}
                      error={errors.firstName}
                    />
                    <TextField
                      label="Last name"
                      optional
                      autoComplete="family-name"
                      value={contact.lastName}
                      onChange={(e) => setContact({ ...contact, lastName: e.target.value })}
                      error={errors.lastName}
                    />
                  </div>
                  <TextField
                    label="Mobile number"
                    prefix="+91"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={11}
                    placeholder="98765 43210"
                    value={contact.phone}
                    onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                    error={errors.phone}
                    hint="For service updates and on-site visit calls."
                  />
                  <TextField label="Email" value={email} readOnly disabled hint="Verified. Contact the shop to change it." />
                </Step>
              )}

              {step === "address" && (
                <Step headingRef={headingRef} title="Where should we deliver?" text="Your default address for orders and on-site service. You can add more later.">
                  <AddressFields value={address} onChange={setAddress} errors={errors} />
                </Step>
              )}

              {step === "preferences" && (
                <Step headingRef={headingRef} title="A little about you" text="So invoices are right and we only tell you about things you use.">
                  <Segmented
                    label="Buying for"
                    value={prefs.customerType}
                    onChange={(customerType) => setPrefs({ ...prefs, customerType })}
                    options={[
                      { value: "personal", label: "Personal", description: "Home or study" },
                      { value: "business", label: "Business", description: "GST invoices" },
                    ]}
                  />
                  {prefs.customerType === "business" && (
                    <div className="grid gap-4">
                      <TextField
                        label="Company name"
                        autoComplete="organization"
                        value={prefs.companyName}
                        onChange={(e) => setPrefs({ ...prefs, companyName: e.target.value })}
                        error={errors.companyName}
                      />
                      <TextField
                        label="GSTIN"
                        optional
                        maxLength={15}
                        placeholder="22AAAAA0000A1Z5"
                        value={prefs.gstin}
                        onChange={(e) => setPrefs({ ...prefs, gstin: e.target.value.toUpperCase() })}
                        error={errors.gstin}
                        hint="Printed on your invoices."
                      />
                    </div>
                  )}
                  <ChipGroup
                    label="What are you interested in?"
                    hint="Optional. Pick any."
                    options={productCategories.map((c) => ({ value: c.id, label: c.label }))}
                    value={prefs.interests}
                    onChange={(interests) => setPrefs({ ...prefs, interests })}
                  />
                  <ToggleCard
                    title="WhatsApp updates"
                    description="Repair progress and delivery updates on WhatsApp."
                    checked={prefs.whatsappUpdates}
                    onChange={(whatsappUpdates) => setPrefs({ ...prefs, whatsappUpdates })}
                  />
                  {serverError && <p className="text-sm text-red-600">{serverError}</p>}
                </Step>
              )}

              {step === "finish" && (
                <div className="text-center">
                  <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-mint-soft text-leaf">
                    <PartyPopper className="size-7" aria-hidden />
                  </div>
                  <h1 ref={headingRef} tabIndex={-1} className="mt-6 text-2xl font-semibold tracking-[-0.02em] text-fg outline-none">
                    You&apos;re all set, {contact.firstName}
                  </h1>
                  <p className="mt-2 text-sm text-fg-muted">Your details are saved. You can change them any time in Profile.</p>
                  <dl className="mt-8 divide-y divide-line rounded-xl border border-line bg-ink-850 text-left text-sm">
                    <Summary label="Mobile">{contact.phone && `+91 ${contact.phone.replace(/\D/g, "").slice(-10)}`}</Summary>
                    <Summary label="Default address">
                      {[address.line1, address.city, `${address.state} ${address.postalCode}`].filter(Boolean).join(", ")}
                    </Summary>
                    <Summary label="Buying for">{prefs.customerType === "business" ? prefs.companyName || "Business" : "Personal"}</Summary>
                  </dl>
                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    <Link href="/products" className="inline-flex h-11 items-center justify-center rounded-xl border border-line-strong bg-ink-850 text-sm font-medium text-fg hover:bg-ink-900">
                      Start shopping
                    </Link>
                    <Link href="/account" className="inline-flex h-11 items-center justify-center rounded-xl bg-brand text-sm font-medium text-white hover:bg-[var(--brand-hover)]">
                      Go to my account
                    </Link>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {step !== "finish" && (
            <div className="mt-10 flex gap-2">
              {index > 1 && (
                <button
                  type="button"
                  onClick={back}
                  disabled={pending}
                  className="h-11 rounded-xl border border-line-strong bg-ink-850 px-5 text-sm font-medium text-fg hover:bg-ink-900 disabled:opacity-60"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={next}
                disabled={pending}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-80"
              >
                {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                {step === "preferences" ? (pending ? "Saving…" : "Finish setup") : "Continue"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="mx-auto flex min-w-0 flex-1 items-center justify-center gap-2 sm:gap-3" aria-label="Setup progress">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.id} className="flex min-w-0 items-center gap-2 sm:gap-3" aria-current={active ? "step" : undefined}>
            <span className="flex items-center gap-2">
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-md text-xs font-medium transition-colors ${
                  done ? "bg-brand text-white" : active ? "border border-brand text-brand" : "border border-line-strong text-fg-dim"
                }`}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={`hidden text-sm md:inline ${active ? "font-medium text-fg" : done ? "text-fg-muted" : "text-fg-dim"}`}>
                {s.label}
                <span className="sr-only">{done ? ", done" : active ? ", current" : ""}</span>
              </span>
            </span>
            {i < steps.length - 1 && (
              <span className="relative h-px w-4 overflow-hidden bg-line-strong sm:w-10 lg:w-16" aria-hidden>
                <span className={`absolute inset-0 origin-left bg-brand transition-transform duration-500 ${done ? "scale-x-100" : "scale-x-0"}`} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Step({ title, text, headingRef, children }: { title: string; text: string; headingRef: React.Ref<HTMLHeadingElement>; children: ReactNode }) {
  return (
    <div>
      <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold tracking-[-0.02em] text-fg outline-none">
        {title}
      </h1>
      <p className="mt-1.5 text-sm text-fg-muted">{text}</p>
      <div className="mt-8 grid gap-5">{children}</div>
    </div>
  );
}

function Summary({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-3">
      <dt className="w-32 shrink-0 text-fg-dim">{label}</dt>
      <dd className="min-w-0 text-fg">{children}</dd>
    </div>
  );
}
