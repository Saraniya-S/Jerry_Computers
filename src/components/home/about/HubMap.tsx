import { BatteryCharging, Cctv, Headset, Laptop, Printer, Wrench, type LucideIcon } from "lucide-react";
import { LogoMark } from "@/components/ui/Logo";
import { r2 } from "@/lib/math";

const nodes: { label: string; icon: LucideIcon }[] = [
  { label: "Hardware", icon: Laptop },
  { label: "Repairs", icon: Wrench },
  { label: "CCTV", icon: Cctv },
  { label: "UPS", icon: BatteryCharging },
  { label: "Printers", icon: Printer },
  { label: "Support", icon: Headset },
];

/** Hub-and-orbit map: Jerry Computers at the centre, every offering wired in. */
export function HubMap() {
  const radius = 41; // % of the square
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]">
      {/* Concentric guides + spokes */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <radialGradient id="hub-fade" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#2f6b22" stopOpacity="0.14" />
            <stop offset="1" stopColor="#2f6b22" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#hub-fade)" />
        {[radius, 30, 19].map((r) => (
          <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="0.25" />
        ))}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--brand)" strokeOpacity="0.55"
          strokeWidth="0.3"
          strokeDasharray="1.2 6"
          className="motion-safe:[animation:orbit-dash_14s_linear_infinite]"
        />
        {nodes.map((_, i) => {
          const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <line
              key={i}
              x1={r2(50 + Math.cos(a) * 9)}
              y1={r2(50 + Math.sin(a) * 9)}
              x2={r2(50 + Math.cos(a) * (radius - 6))}
              y2={r2(50 + Math.sin(a) * (radius - 6))}
              stroke="var(--line)"
              strokeWidth="0.25"
            />
          );
        })}
        {[
          [14, 22],
          [86, 30],
          [80, 84],
          [20, 78],
          [52, 6],
          [94, 58],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="0.5" fill="var(--fg-dim)" />
        ))}
      </svg>

      {/* Packets travelling along the spokes */}
      <div aria-hidden className="absolute inset-0 motion-safe:animate-[spin_40s_linear_infinite]">
        {[0, 2, 4].map((i) => {
          const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2 + 0.52;
          return (
            <span
              key={i}
              className="absolute size-1.5 -translate-1/2 rounded-full bg-brand shadow-[0_0_12px_2px_rgb(47_107_34/0.45)]"
              style={{ left: `${r2(50 + Math.cos(a) * radius)}%`, top: `${r2(50 + Math.sin(a) * radius)}%` }}
            />
          );
        })}
      </div>

      {/* Hub */}
      <div className="absolute left-1/2 top-1/2 flex -translate-1/2 flex-col items-center">
        <div className="relative grid size-24 place-items-center rounded-3xl border border-line-strong bg-gradient-to-b from-ink-700 to-ink-850 shadow-[0_20px_60px_-10px_rgb(55_47_99/0.25)] sm:size-28">
          <span aria-hidden className="absolute inset-0 rounded-3xl border border-brand/30 motion-safe:[animation:pulse-ring_3.2s_ease-out_infinite]" />
          <LogoMark className="size-16 sm:size-[4.5rem]" />
        </div>
        <span className="mt-3 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-fg-muted">Jerry hub</span>
      </div>

      {/* Nodes */}
      <ul>
        {nodes.map(({ label, icon: Icon }, i) => {
          const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <li
              key={label}
              className="absolute flex -translate-x-1/2 -translate-y-[22px] flex-col items-center sm:-translate-y-[26px]"
              style={{ left: `${r2(50 + Math.cos(a) * radius)}%`, top: `${r2(50 + Math.sin(a) * radius)}%` }}
            >
              <span className="grid size-11 place-items-center rounded-xl border border-line-strong bg-ink-850 text-fg shadow-[0_8px_24px_-8px_var(--shadow)] sm:size-[52px]">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="mt-2 text-[0.72rem] text-fg-muted">{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
