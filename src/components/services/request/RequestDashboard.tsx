"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, LoaderCircle, LogIn, UserPlus, Wrench } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { submitServiceRequestAction, type SubmitResult } from "@/app/services/request/actions";
import { EmptyState } from "@/components/account/PageHeader";
import { FormAlert } from "@/components/auth/ui";
import { emptyAddress, type AddressDraft } from "@/components/forms/AddressFields";
import { addressSchema } from "@/lib/customer";
import { stepDevice, stepService, type OnlineRequestInput } from "@/lib/service-request-form";
import { DeviceStep, MethodStep, ReviewStep, ServiceStep, Stepper, SuccessCard, Summary } from "./parts";
import { OTHER, STEPS, type Draft, type RequestAccount, type RequestService, type ShopInfo } from "./types";

export type { RequestAccount, RequestService, ShopInfo } from "./types";

const DRAFT_KEY = "jc:service-request-draft";

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`.replace(/[^0-9a-f-]/g, "0"));

function blankDraft(account: RequestAccount | null, preselect: string | null): Draft {
  const saved = account?.addresses.find((a) => a.isDefault) ?? account?.addresses[0];
  return {
    serviceSlug: preselect ?? "",
    problemType: "",
    deviceBrand: "",
    deviceModel: "",
    serialNumber: "",
    issue: "",
    location: "",
    addressChoice: saved ? saved.id : "new",
    address: emptyAddress(account?.firstName ?? "", ""),
    pin: "",
    pinAccuracy: null,
    preferredDate: "",
    preferredWindow: "",
    phone: "",
    clientRequestId: newId(),
  };
}

type Props = { services: RequestService[]; shop: ShopInfo | null; account: RequestAccount | null; signedInAsStaff: boolean; preselect: string | null };

/** The whole request flow: pick a service, describe the device, choose on-site or in-shop, review and send. */
export function RequestDashboard({ services, shop, account, signedInAsStaff, preselect }: Props) {
  const [draft, setDraft] = useState<Draft>(() => blankDraft(account, preselect));
  const [step, setStep] = useState(0);
  const [restored, setRestored] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [pending, start] = useTransition();
  const loaded = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  // Bring back answers from before a sign-in round trip (or a reload). Browser storage only.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { draft: Draft; step: number };
        if (saved?.draft?.clientRequestId) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from browser storage
          setDraft({ ...blankDraft(account, preselect), ...saved.draft, ...(preselect && !saved.draft.serviceSlug ? { serviceSlug: preselect } : {}) });
          setStep(Math.min(Math.max(0, saved.step ?? 0), STEPS.length - 1));
          setRestored(true);
        }
      }
    } catch {
      /* storage unavailable: start fresh */
    }
    loaded.current = true;
  }, [account, preselect]);

  useEffect(() => {
    if (!loaded.current || result?.ok) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ draft, step }));
    } catch {
      /* ignore */
    }
  }, [draft, step, result]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const service = services.find((s) => s.slug === draft.serviceSlug) ?? null;
  const savedAddress = account?.addresses.find((a) => a.id === draft.addressChoice) ?? null;
  const address: AddressDraft = savedAddress ? { ...savedAddress } : draft.address;

  function check(upTo: number) {
    const e: Record<string, string> = {};
    if (upTo >= 0) {
      const r = stepService.safeParse({ serviceSlug: draft.serviceSlug, problemType: draft.problemType === OTHER ? "" : draft.problemType });
      if (!r.success) for (const i of r.error.issues) e[String(i.path[0])] ??= i.message;
      if (service && service.includes.length && !draft.problemType) e.problemType = "Choose what you need, or “Something else”.";
    }
    if (upTo >= 1) {
      const r = stepDevice.safeParse(draft);
      if (!r.success) for (const i of r.error.issues) e[String(i.path[0])] ??= i.message;
    }
    if (upTo >= 2) {
      if (!draft.location) e.location = "Choose on-site or in-shop service.";
      if (draft.location === "on_site") {
        const r = addressSchema.safeParse(address);
        if (!r.success) for (const i of r.error.issues) e[`address.${String(i.path[0])}`] ??= i.message;
      }
      if (account && !account.phone && !/^\s*(\+?91[\s-]?)?0?[6-9]\d{9}\s*$/.test(draft.phone.replace(/\s/g, ""))) e.phone = "Enter a 10-digit Indian mobile number.";
      if (draft.preferredWindow && !draft.preferredDate) e.preferredDate = "Choose a day for that time.";
    }
    setErrors(e);
    return e;
  }
  const ok = (e: Record<string, string>) => Object.keys(e).length === 0;

  const firstStepWithError = (e: Record<string, string>) => {
    const keys = Object.keys(e);
    if (keys.some((k) => k === "serviceSlug" || k === "problemType")) return 0;
    if (keys.some((k) => ["deviceBrand", "deviceModel", "serialNumber", "issue"].includes(k))) return 1;
    return 2;
  };

  function go(to: number) {
    if (to > step && !ok(check(to - 1))) return;
    setStep(to);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submit() {
    const found = check(2);
    if (!ok(found)) return setStep(firstStepWithError(found));
    setResult(null);
    start(async () => {
      const res = await submitServiceRequestAction({
        serviceSlug: draft.serviceSlug,
        problemType: draft.problemType === OTHER ? "" : draft.problemType,
        deviceBrand: draft.deviceBrand,
        deviceModel: draft.deviceModel,
        serialNumber: draft.serialNumber,
        issue: draft.issue,
        location: draft.location as "in_shop" | "on_site",
        address: draft.location === "on_site" ? { ...address, mapsUrl: "", pin: draft.pin } : undefined,
        phone: account?.phone ? "" : draft.phone,
        preferredDate: draft.preferredDate,
        preferredWindow: draft.preferredWindow as OnlineRequestInput["preferredWindow"],
        clientRequestId: draft.clientRequestId,
      });
      setResult(res);
      if (res.ok) {
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
      } else if (res.fieldErrors) {
        setErrors(res.fieldErrors);
        setStep(firstStepWithError(res.fieldErrors));
      }
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function startAnother() {
    setDraft(blankDraft(account, null));
    setStep(0);
    setResult(null);
    setRestored(false);
  }

  if (!services.length) {
    return (
      <EmptyState icon={<Wrench className="size-5" aria-hidden />} title="Online requests aren't open right now">
        No services are available to book online at the moment.{shop?.phone ? ` Call the shop on ${shop.phone} to arrange a repair.` : " Please contact the shop to arrange a repair."}
      </EmptyState>
    );
  }

  if (result?.ok) {
    return <SuccessCard request={result.request} service={service} location={draft.location} shop={shop} onAnother={startAnother} />;
  }

  return (
    <div ref={topRef} className="scroll-mt-16 p-5 sm:p-7">
      <Stepper step={step} onJump={(i) => i < step && go(i)} />
      {restored && step > 0 && (
        <div className="mt-4">
          <FormAlert tone="info">We kept the answers you&apos;d already entered.</FormAlert>
        </div>
      )}
      {signedInAsStaff && (
        <div className="mt-4">
          <FormAlert tone="info">You&apos;re signed in with a staff account. Customers send requests here; staff log jobs from their own area.</FormAlert>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (step < STEPS.length - 1) go(step + 1);
            else submit();
          }}
          className="grid min-w-0 content-start gap-6"
          aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
        >
          {step === 0 && <ServiceStep services={services} draft={draft} set={set} errors={errors} />}
          {step === 1 && <DeviceStep service={service} draft={draft} set={set} errors={errors} />}
          {step === 2 && <MethodStep draft={draft} set={set} errors={errors} account={account} shop={shop} />}
          {step === 3 && <ReviewStep draft={draft} service={service} address={draft.location === "on_site" ? address : null} shop={shop} onEdit={(i) => setStep(i)} />}

          {result && !result.ok && (
            <div className="grid gap-3">
              <FormAlert tone="error">{result.error}</FormAlert>
              {(result.blocked === "signin" || result.blocked === "verify") && <SignInPrompt verify={result.blocked === "verify"} />}
            </div>
          )}
          {step === 3 && !account && !signedInAsStaff && !result && <SignInPrompt />}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            {step > 0 ? (
              <button type="button" onClick={() => go(step - 1)} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line-strong px-5 text-sm text-fg hover:bg-ink-900">
                <ArrowLeft className="size-4" aria-hidden /> Back
              </button>
            ) : (
              <span />
            )}
            {step < STEPS.length - 1 ? (
              <button type="submit" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand px-6 text-sm font-medium text-white hover:bg-[var(--brand-hover)]">
                Continue <ArrowRight className="size-4" aria-hidden />
              </button>
            ) : (
              <button
                type="submit"
                disabled={pending || !account || signedInAsStaff}
                aria-describedby={!account ? "signin-needed" : undefined}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-sm font-medium text-white hover:bg-[var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                {pending ? "Sending…" : "Submit Service Request"}
              </button>
            )}
          </div>
        </form>

        <Summary draft={draft} service={service} address={draft.location === "on_site" ? address : null} step={step} />
      </div>
    </div>
  );
}

function SignInPrompt({ verify = false }: { verify?: boolean }) {
  const next = encodeURIComponent("/services/request");
  return (
    <div id="signin-needed" className="rounded-xl border border-brand/20 bg-brand/[0.04] p-4 text-sm">
      <p className="font-medium text-fg">{verify ? "Verify your email to send this request" : "Sign in to send your request"}</p>
      <p className="mt-1 text-fg-muted">
        {verify
          ? "Log in again and enter the code we email you. You'll come straight back here with your answers."
          : "Requests are linked to your account so you can follow progress. Your answers stay on this device while you sign in, and you'll come back here to submit."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/login?next=${next}`} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-medium text-white hover:bg-[var(--brand-hover)]">
          <LogIn className="size-4" aria-hidden /> Log in
        </Link>
        {!verify && (
          <Link href={`/register?next=${next}`} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong px-4 text-sm text-fg hover:bg-ink-900">
            <UserPlus className="size-4" aria-hidden /> Create an account
          </Link>
        )}
      </div>
    </div>
  );
}
