"use client";

import { Search, UserRound, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { createServiceRequestAction, findCustomersAction } from "@/app/admin/service-requests/actions";
import { AddressFields, emptyAddress, type AddressDraft } from "@/components/forms/AddressFields";
import { Segmented, SelectField, TextField } from "@/components/forms/controls";
import type { DeviceType, ServicePriority } from "@/lib/server/db/schema";
import { deviceTypeLabel, deviceTypes, priorities, priorityLabel, type ServiceRequestInput } from "@/lib/service-desk";
import { ResultAlert, Spinner, useAdminAction } from "./actions-ui";

type Customer = Awaited<ReturnType<typeof findCustomersAction>>[number];

const area =
  "w-full rounded-xl border border-line-strong bg-ink-850 px-3.5 py-3 text-[0.95rem] text-fg placeholder:text-fg-dim focus:border-brand focus:ring-4 focus:ring-[var(--brand-glow)]";

/** Logs a job for an account customer or a walk-in/phone customer without an account. */
export function ServiceRequestForm() {
  const [who, setWho] = useState<"walk_in" | "account">("walk_in");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contact, setContact] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [source, setSource] = useState<"walk_in" | "phone">("walk_in");
  const [location, setLocation] = useState<"in_shop" | "on_site">("in_shop");
  const [address, setAddress] = useState<AddressDraft>(emptyAddress());
  const [mapsUrl, setMapsUrl] = useState("");
  const [pin, setPin] = useState("");
  const [device, setDevice] = useState({ deviceType: "" as DeviceType | "", deviceBrand: "", deviceModel: "", serialNumber: "", accessories: "" });
  const [issue, setIssue] = useState("");
  const [priority, setPriority] = useState<ServicePriority>("normal");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy, result } = useAdminAction();

  function submit() {
    const input: ServiceRequestInput = {
      customerId: who === "account" ? (customer?.id ?? "") : "",
      contact: who === "walk_in" ? contact : customer && !customer.phone ? { firstName: customer.firstName, lastName: customer.lastName, phone: contact.phone, email: "" } : undefined,
      source,
      location,
      address: location === "on_site" ? { ...address, label: address.label as "Home", state: address.state as "Tamil Nadu", mapsUrl, pin } : undefined,
      deviceType: device.deviceType as DeviceType,
      deviceBrand: device.deviceBrand,
      deviceModel: device.deviceModel,
      serialNumber: device.serialNumber,
      accessories: device.accessories,
      issue,
      priority,
    };
    run("create", () => createServiceRequestAction(input), (r) => setErrors(r.ok ? {} : (r.fieldErrors ?? {})));
  }

  const addrErrors = Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith("address.")).map(([k, v]) => [k.slice(8), v]));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[1fr_340px]"
    >
      <div className="grid content-start gap-6">
        <Card title="Customer">
          <Segmented
            label="Who is it for?"
            value={who}
            onChange={setWho}
            options={[
              { value: "walk_in", label: "Walk-in or caller", description: "No account needed. Details stay on this job." },
              { value: "account", label: "Existing customer", description: "Link it to their account." },
            ]}
          />
          {who === "account" ? (
            <CustomerPicker value={customer} onChange={setCustomer} error={errors.customerId ?? errors.contact} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="First name" value={contact.firstName} error={errors["contact.firstName"] ?? errors.contact} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} />
              <TextField label="Last name" optional value={contact.lastName} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} />
              <TextField label="Mobile" prefix="+91" inputMode="tel" value={contact.phone} error={errors["contact.phone"]} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
              <TextField label="Email" optional type="email" value={contact.email} error={errors["contact.email"]} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
            </div>
          )}
          {who === "account" && customer && !customer.phone && (
            <TextField label="Mobile for this job" prefix="+91" inputMode="tel" value={contact.phone} error={errors["contact.phone"]} onChange={(e) => setContact({ ...contact, phone: e.target.value })} hint="This customer has no number on file." />
          )}
          <SelectField
            label="How did it come in?"
            options={[
              { value: "walk_in", label: "Brought to the shop" },
              { value: "phone", label: "Phone call" },
            ]}
            value={source}
            onChange={(e) => setSource(e.target.value as typeof source)}
          />
        </Card>

        <Card title="Device and problem">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Device type"
              placeholder="Choose"
              options={deviceTypes.map((d) => ({ value: d, label: deviceTypeLabel[d] }))}
              value={device.deviceType}
              error={errors.deviceType}
              onChange={(e) => setDevice({ ...device, deviceType: e.target.value as DeviceType })}
            />
            <TextField label="Brand" optional value={device.deviceBrand} onChange={(e) => setDevice({ ...device, deviceBrand: e.target.value })} />
            <TextField label="Model" optional value={device.deviceModel} onChange={(e) => setDevice({ ...device, deviceModel: e.target.value })} />
            <TextField label="Serial number" optional value={device.serialNumber} onChange={(e) => setDevice({ ...device, serialNumber: e.target.value })} />
          </div>
          {location === "in_shop" && (
            <TextField label="Left with the device" optional value={device.accessories} onChange={(e) => setDevice({ ...device, accessories: e.target.value })} placeholder="Charger, bag…" />
          )}
          <div>
            <label htmlFor="issue" className="mb-1.5 block text-sm font-medium text-fg">
              Problem
            </label>
            <textarea id="issue" rows={4} value={issue} onChange={(e) => setIssue(e.target.value)} style={{ outline: "none" }} className={area} aria-invalid={errors.issue ? true : undefined} />
            {errors.issue && <p className="mt-1.5 text-[0.8rem] text-red-600">{errors.issue}</p>}
          </div>
        </Card>

        <Card title="Where">
          <Segmented
            label="Service location"
            value={location}
            onChange={setLocation}
            options={[
              { value: "in_shop", label: "In shop", description: "The device is at the shop." },
              { value: "on_site", label: "On-site", description: "An engineer visits the customer." },
            ]}
          />
          {location === "on_site" && (
            <>
              {errors.address && <p className="text-[0.8rem] text-red-600">{errors.address}</p>}
              <AddressFields value={address} onChange={setAddress} errors={addrErrors} />
              <TextField
                label="Map pin"
                optional
                value={pin}
                error={errors["address.pin"]}
                onChange={(e) => setPin(e.target.value)}
                placeholder="12.9716, 80.2209"
                hint="Latitude, longitude from a dropped pin. Gives the engineer exact directions."
              />
              <TextField label="Map link" optional type="url" value={mapsUrl} error={errors["address.mapsUrl"]} onChange={(e) => setMapsUrl(e.target.value)} placeholder="https://maps.google.com/…" hint="A pin the customer shared, so the engineer can get directions." />
            </>
          )}
        </Card>
      </div>

      <div className="grid content-start gap-6">
        <Card title="Priority">
          <SelectField label="Priority" options={priorities.map((p) => ({ value: p, label: priorityLabel[p] }))} value={priority} onChange={(e) => setPriority(e.target.value as ServicePriority)} />
          <p className="text-[0.8rem] text-fg-muted">
            On save, the job goes to the available engineer with the fewest active jobs who takes this device type{location === "on_site" ? " and on-site work" : ""}. If nobody is eligible it waits, unassigned.
          </p>
        </Card>
        <div className="sticky bottom-3 grid gap-3 rounded-2xl border border-line bg-ink-850/95 p-4 shadow-[0_16px_40px_-20px_var(--shadow)] backdrop-blur">
          {result && !result.ok && <ResultAlert result={result} />}
          <button type="submit" disabled={busy !== null} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand text-sm font-medium text-white hover:bg-[var(--brand-hover)] disabled:opacity-70">
            {busy && <Spinner />} {busy ? "Creating…" : "Create and assign"}
          </button>
        </div>
      </div>
    </form>
  );
}

function CustomerPicker({ value, onChange, error }: { value: Customer | null; onChange: (c: Customer | null) => void; error?: string }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Customer[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (value || q.trim().length < 2) return;
    const t = setTimeout(() => start(async () => setHits(await findCustomersAction(q))), 250);
    return () => clearTimeout(t);
  }, [q, value]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-950 px-4 py-3 text-sm">
        <span className="flex items-center gap-3">
          <UserRound className="size-4 text-brand" aria-hidden />
          <span>
            <span className="block font-medium text-fg">{`${value.firstName} ${value.lastName}`.trim()}</span>
            <span className="block text-xs text-fg-dim">
              {value.email}
              {value.phone && ` · ${value.phone}`}
            </span>
          </span>
        </span>
        <button type="button" onClick={() => onChange(null)} aria-label="Choose another customer" className="grid size-8 place-items-center rounded-lg text-fg-dim hover:bg-ink-900">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <label className="flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-ink-850 px-3.5 text-sm focus-within:border-brand">
        <Search className="size-4 text-fg-dim" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or mobile" aria-label="Find customer" style={{ outline: "none" }} className="min-w-0 flex-1 bg-transparent" />
        {pending && <Spinner />}
      </label>
      {error && <p className="text-[0.8rem] text-red-600">{error}</p>}
      {q.trim().length >= 2 && (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line" role="listbox" aria-label="Matching customers">
          {hits.length === 0 && !pending ? (
            <li className="px-4 py-3 text-sm text-fg-muted">No customer accounts match. Use “Walk-in or caller” instead.</li>
          ) : (
            hits.map((c) => (
              <li key={c.id} role="option" aria-selected={false}>
                <button type="button" onClick={() => onChange(c)} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-ink-950">
                  <span className="block text-fg">{`${c.firstName} ${c.lastName}`.trim()}</span>
                  <span className="block text-xs text-fg-dim">
                    {c.email}
                    {c.phone && ` · ${c.phone}`}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
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
