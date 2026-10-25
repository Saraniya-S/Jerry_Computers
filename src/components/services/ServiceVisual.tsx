import { Check, Cpu, HardDrive, MemoryStick, Printer, Zap } from "lucide-react";
import type { ServiceId } from "@/data/services";

/**
 * Small interface-style illustrations for each service, in the spirit of the
 * live widget cards in the Services reference. Purely decorative.
 */
export function ServiceVisual({ id }: { id: ServiceId }) {
  switch (id) {
    case "laptop":
      return (
        <div className="space-y-3" aria-hidden>
          <Row label="Battery health" value="Checking" />
          <Bar pct={68} live />
          <Row label="Thermals" value="Cleaned" />
          <Bar pct={92} />
        </div>
      );
    case "desktop":
      return (
        <ul className="space-y-2" aria-hidden>
          {[
            { icon: Cpu, label: "Processor", on: true },
            { icon: MemoryStick, label: "Memory", on: true },
            { icon: HardDrive, label: "Storage", on: false },
          ].map(({ icon: Icon, label, on }) => (
            <li key={label} className="flex items-center gap-2.5 text-[0.78rem] text-fg-muted">
              <span
                className={`relative h-4 w-7 rounded-full ${on ? "bg-copper/90" : "bg-[var(--track)] [animation:toggle-track_4s_steps(1,end)_infinite]"}`}
              >
                <span
                  className={`absolute top-0.5 size-3 rounded-full ${on ? "left-3.5 bg-ink-950" : "left-0.5 bg-fg-muted [animation:toggle-knob_4s_ease-in-out_infinite]"}`}
                />
              </span>
              <Icon className="size-3.5" />
              {label}
            </li>
          ))}
        </ul>
      );
    case "cctv":
      return (
        <div className="grid grid-cols-2 gap-1.5" aria-hidden>
          {["CAM 1", "CAM 2", "CAM 3", "CAM 4"].map((c, i) => (
            <div key={c} className="relative h-9 overflow-hidden rounded-md border border-line bg-gradient-to-br from-ink-700 to-ink-950">
              <div className="absolute inset-0 opacity-30 [background:repeating-linear-gradient(0deg,transparent_0_2px,var(--line)_2px_3px)]" />
              <span className="absolute left-1.5 top-1 font-mono text-[0.55rem] text-fg-muted">{c}</span>
              {i === 0 && <span className="absolute right-1.5 top-1.5 size-1.5 animate-pulse rounded-full bg-red-400" />}
            </div>
          ))}
        </div>
      );
    case "printer":
      return (
        <div className="space-y-3" aria-hidden>
          <div className="flex items-center gap-2 text-[0.78rem] text-fg-muted">
            <Printer className="size-3.5" /> Test page
            <span className="ml-auto font-mono text-[0.7rem] text-fg">Printing</span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-[var(--track)]">
            <span className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-copper [animation:lane-sweep_2.8s_ease-in-out_infinite]" />
          </div>
          <div className="flex gap-1.5">
            {["Cyan", "Magenta", "Yellow", "Black"].map((c, i) => (
              <span key={c} className="h-6 flex-1 rounded-sm border border-line" style={{ background: ["#38bdf8", "#e879f9", "#facc15", "#1f2937"][i], opacity: 0.75 }} title={c} />
            ))}
          </div>
        </div>
      );
    case "ups":
      return (
        <div className="flex items-center gap-4" aria-hidden>
          <svg viewBox="0 0 60 60" className="size-16 -rotate-90">
            <circle cx="30" cy="30" r="24" fill="none" stroke="var(--track)" strokeWidth="5" />
            <circle cx="30" cy="30" r="24" fill="none" stroke="var(--copper)" strokeWidth="5" strokeLinecap="round" strokeDasharray="150.8" strokeDashoffset="45" className="[animation:ring-charge_6s_ease-in-out_infinite]" />
          </svg>
          <div>
            <p className="flex items-center gap-1 text-[0.78rem] text-fg-muted">
              <Zap className="size-3.5 text-copper" /> Battery test
            </p>
            <p className="mt-1 font-mono text-xl tracking-tight text-fg">Online</p>
          </div>
        </div>
      );
    case "diagnostics":
      return (
        <ul className="space-y-1.5" aria-hidden>
          {["Power supply", "Storage SMART", "Memory test", "Network"].map((t, i) => (
            <li key={t} className="flex items-center gap-2 text-[0.78rem] text-fg-muted">
              <span className={`grid size-4 place-items-center rounded-[4px] border ${i < 3 ? "border-copper/60 bg-copper/15" : "border-line-strong"}`}>
                {i < 3 && <Check className="size-3 text-copper" />}
              </span>
              <span className={i < 3 ? "text-fg" : ""}>{t}</span>
            </li>
          ))}
        </ul>
      );
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[0.78rem]">
      <span className="text-fg-muted">{label}</span>
      <span className="font-mono text-[0.7rem] text-fg">{value}</span>
    </div>
  );
}

function Bar({ pct, live = false }: { pct: number; live?: boolean }) {
  return (
    <div className="h-1.5 rounded-full bg-[var(--track)]">
      <div
        className={`h-full origin-left rounded-full bg-gradient-to-r from-copper-deep to-copper ${live ? "[animation:bar-fill_5s_ease-in-out_infinite]" : ""}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
