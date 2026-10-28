"use client";

import { ExternalLink, Truck } from "lucide-react";
import { useState } from "react";
import { shipmentEventAction, updateShipmentAction } from "@/app/admin/actions";
import { SelectField, TextField } from "@/components/forms/controls";
import { couriers, shipmentFlow, shipmentStatusLabel, type CourierCode } from "@/lib/couriers";
import type { ShipmentStatus } from "@/lib/server/db/schema";
import { ResultAlert, smallButton, smallPrimary, Spinner, useAdminAction } from "./actions-ui";

type Event = { id: string; status: ShipmentStatus; note: string | null; location: string | null; source: string; occurredAt: Date; by: string | null };
type Shipment = { id: string; courierCode: string; courierName: string; trackingNumber: string; trackingUrl: string | null; status: ShipmentStatus; dispatchedAt: Date; deliveredAt: Date | null; events: Event[] };

const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** Shipments on an order with their status history, and a form to record what the courier reports. */
export function ShipmentPanel({ shipments, canEdit = true }: { shipments: Shipment[]; canEdit?: boolean }) {
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
            <ShipmentCard key={s.id} s={s} canEdit={canEdit} />
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-fg-dim">No courier API is connected, so updates are entered by staff from the courier&apos;s tracking page.</p>
    </section>
  );
}

function ShipmentCard({ s, canEdit }: { s: Shipment; canEdit: boolean }) {
  const allowed = canEdit ? (shipmentFlow[s.status] as readonly ShipmentStatus[]) : [];
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
      {allowed.length > 0 && <EditDetails s={s} />}
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

/** Corrects a mistyped courier, AWB or link while the parcel is still on its way. */
function EditDetails({ s }: { s: Shipment }) {
  const known = couriers.some((c) => c.code === s.courierCode);
  const [v, setV] = useState<{ courierCode: CourierCode; courierName: string; trackingNumber: string; trackingUrl: string } | null>(null);
  const { run, busy, result } = useAdminAction();
  if (!v)
    return (
      <div className="grid gap-2">
        {result?.ok && <ResultAlert result={result} />}
        <button
          type="button"
          onClick={() => setV({ courierCode: (known ? s.courierCode : "other") as CourierCode, courierName: known ? "" : s.courierName, trackingNumber: s.trackingNumber, trackingUrl: s.trackingUrl ?? "" })}
          className={`${smallButton} w-fit`}
        >
          Correct courier or tracking
        </button>
      </div>
    );
  return (
    <form
      className="grid gap-3 rounded-lg border border-line bg-ink-950 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run("edit", () => updateShipmentAction(s.id, v), (r) => r.ok && setV(null));
      }}
    >
      <SelectField label="Courier" options={couriers.map((c) => ({ value: c.code, label: c.name }))} value={v.courierCode} onChange={(e) => setV({ ...v, courierCode: e.target.value as CourierCode })} />
      {v.courierCode === "other" && <TextField label="Courier name" value={v.courierName} onChange={(e) => setV({ ...v, courierName: e.target.value })} />}
      <TextField label="Tracking (AWB) number" value={v.trackingNumber} onChange={(e) => setV({ ...v, trackingNumber: e.target.value.trim() })} />
      <TextField label="Tracking link" optional type="url" value={v.trackingUrl} onChange={(e) => setV({ ...v, trackingUrl: e.target.value })} placeholder="https://" />
      {result && !result.ok && <ResultAlert result={result} />}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setV(null)} className={smallButton}>
          Cancel
        </button>
        <button type="submit" disabled={busy !== null || !v.trackingNumber} className={smallPrimary}>
          {busy && <Spinner />} Save details
        </button>
      </div>
    </form>
  );
}
