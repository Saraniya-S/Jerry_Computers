"use client";

import { ExternalLink, Truck } from "lucide-react";
import { useState } from "react";
import { shipmentEventAction } from "@/app/admin/actions";
import { SelectField, TextField } from "@/components/forms/controls";
import { shipmentFlow, shipmentStatusLabel } from "@/lib/couriers";
import type { ShipmentStatus } from "@/lib/server/db/schema";
import { ResultAlert, smallButton, smallPrimary, Spinner, useAdminAction } from "./actions-ui";

type Event = { id: string; status: ShipmentStatus; note: string | null; location: string | null; source: string; occurredAt: Date; by: string | null };
type Shipment = { id: string; courierName: string; trackingNumber: string; trackingUrl: string | null; status: ShipmentStatus; dispatchedAt: Date; deliveredAt: Date | null; events: Event[] };

const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** Shipments on an order with their status history, and a form to record what the courier reports. */
export function ShipmentPanel({ shipments }: { shipments: Shipment[] }) {
  return (
    <section className="rounded-xl border border-line p-4 text-sm">
      <h2 className="mb-3 flex items-center gap-1.5 font-medium text-fg">
        <Truck className="size-4 text-brand" aria-hidden /> Shipment
      </h2>
      {shipments.length === 0 ? (
        <p className="text-fg-muted">Not dispatched yet. Dispatching records the courier and tracking number here.</p>
      ) : (
        <div className="grid gap-5">
          {shipments.map((s) => (
            <ShipmentCard key={s.id} s={s} />
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-fg-dim">No courier API is connected, so updates are entered by staff from the courier&apos;s tracking page.</p>
    </section>
  );
}

function ShipmentCard({ s }: { s: Shipment }) {
  const allowed = shipmentFlow[s.status] as readonly ShipmentStatus[];
  const [form, setForm] = useState<{ status: ShipmentStatus | ""; note: string; location: string } | null>(null);
  const { run, busy, result } = useAdminAction();
  return (
    <div className="grid gap-3">
      <div>
        <p className="font-medium text-fg">
          {s.courierName} · <span className="font-mono">{s.trackingNumber}</span>
        </p>
        <p className="text-fg-muted">
          {shipmentStatusLabel[s.status]} · dispatched {fmt.format(s.dispatchedAt)}
          {s.deliveredAt && ` · delivered ${fmt.format(s.deliveredAt)}`}
        </p>
        {s.trackingUrl && (
          <a href={s.trackingUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-brand hover:underline">
            Courier tracking page <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
      </div>
      <ol className="grid gap-2 border-l border-line pl-3">
        {s.events.map((e) => (
          <li key={e.id}>
            <p className="text-fg">
              {shipmentStatusLabel[e.status]}
              {e.location && <span className="text-fg-muted"> · {e.location}</span>}
            </p>
            <p className="text-xs text-fg-dim">
              {fmt.format(e.occurredAt)} · {e.source === "staff" ? (e.by ?? "Staff") : e.source}
              {e.note && ` · ${e.note}`}
            </p>
          </li>
        ))}
      </ol>
      {result && <ResultAlert result={result} />}
      {allowed.length > 0 &&
        (form ? (
          <form
            className="grid gap-3 rounded-lg border border-line bg-ink-950 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (form.status) run("event", () => shipmentEventAction({ shipmentId: s.id, status: form.status as ShipmentStatus, note: form.note, location: form.location }), (r) => r.ok && setForm(null));
            }}
          >
            <SelectField label="New status" placeholder="Choose" options={allowed.map((x) => ({ value: x, label: shipmentStatusLabel[x] }))} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ShipmentStatus })} />
            <TextField label="Location" optional value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <TextField label="Note" optional value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className={smallButton}>
                Cancel
              </button>
              <button type="submit" disabled={busy !== null || !form.status} className={smallPrimary}>
                {busy && <Spinner />} Save update
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setForm({ status: "", note: "", location: "" })} className={`${smallButton} w-fit`}>
            Record courier update
          </button>
        ))}
    </div>
  );
}
