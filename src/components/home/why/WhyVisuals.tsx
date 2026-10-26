import { BellRing, PackageCheck, UserRoundCheck } from "lucide-react";
import { productCategories } from "@/data/products";
import { r2 } from "@/lib/math";

/** Card 1 — radial burst: one counter, everything connected to it. */
export function BurstVisual() {
  const rays = Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    const len = 28 + ((i * 37) % 17);
    return { x: r2(50 + Math.cos(a) * len), y: r2(50 + Math.sin(a) * len * 0.82) };
  });
  const nodes = [3, 11, 19, 27, 36, 44, 52, 60];
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
      <defs>
        <radialGradient id="burst-core" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#f4fbf3" />
          <stop offset="0.25" stopColor="#b8dcb5" stopOpacity="0.95" />
          <stop offset="0.6" stopColor="#4f9a3f" stopOpacity="0.25" />
          <stop offset="1" stopColor="#4f9a3f" stopOpacity="0" />
        </radialGradient>
      </defs>
      {rays.map((r, i) => (
        <g key={i}>
          <line x1="50" y1="50" x2={r.x} y2={r.y} stroke="#b8dcb5" strokeOpacity={r2(0.12 + (i % 5) * 0.05)} strokeWidth="0.18" />
          <circle cx={r.x} cy={r.y} r="0.45" fill="#dff0dc" opacity="0.8" />
        </g>
      ))}
      {nodes.map((n) => {
        const r = rays[n];
        const x = r2(50 + (r.x - 50) * 0.72);
        const y = r2(50 + (r.y - 50) * 0.72);
        return <circle key={n} cx={x} cy={y} r="1.9" fill="#1c1838" stroke="#8f8bb0" strokeWidth="0.25" />;
      })}
      <circle cx="50" cy="50" r="16" fill="url(#burst-core)" className="motion-safe:animate-pulse" />
      <circle cx="50" cy="50" r="3.2" fill="#ffffff" />
    </svg>
  );
}

/** Card 2 — request lanes with a sweeping playhead. */
export function LanesVisual() {
  const lanes = [
    { label: "received", start: 4, width: 18, color: "#b8dcb5" },
    { label: "diagnosis", start: 18, width: 24, color: "#c9c2f2" },
    { label: "repair", start: 38, width: 30, color: "#f0f4f8" },
    { label: "testing", start: 62, width: 18, color: "#6fbf73" },
    { label: "ready", start: 78, width: 14, color: "#b8dcb5" },
  ];
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-3 bg-[radial-gradient(80%_60%_at_60%_50%,rgb(184_220_181/0.1),transparent)] px-5" aria-hidden>
      {lanes.map((l) => (
        <div key={l.label} className="relative h-6">
          <span className="absolute left-0 top-1/2 -translate-y-1/2 font-mono text-[0.62rem] text-fg-muted">{l.label}</span>
          <div className="absolute inset-y-0 left-20 right-0">
            <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-mint/30 to-transparent" />
            <div
              className="absolute top-1/2 h-3 -translate-y-1/2 rounded-sm"
              style={{ left: `${l.start}%`, width: `${l.width}%`, background: l.color, boxShadow: `0 0 18px ${l.color}66` }}
            />
          </div>
        </div>
      ))}
      <div className="pointer-events-none absolute inset-y-4 left-[calc(5rem+20px)] right-5 overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-px bg-white/80 shadow-[0_0_14px_2px_rgb(255_255_255/0.5)] motion-safe:[animation:lane-sweep_6s_ease-in-out_infinite_alternate]" />
      </div>
    </div>
  );
}

/** Card 3 — coverage ring with every product category. */
export function CoverageVisual() {
  const n = productCategories.length;
  const r = 34;
  const c = 2 * Math.PI * r;
  const seg = c / n;
  return (
    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(55%_60%_at_50%_50%,rgb(184_220_181/0.16),transparent)]" aria-hidden>
      <svg viewBox="0 0 100 100" className="h-[88%] -rotate-90">
        {[40, 44, 47].map((rr, i) => (
          <circle
            key={rr}
            cx="50"
            cy="50"
            r={rr}
            fill="none"
            stroke="#dff0dc"
            strokeOpacity={r2(0.12 + i * 0.06)}
            strokeWidth="0.3"
            strokeDasharray="0.6 2.2"
            className="motion-safe:[animation:orbit-dash_22s_linear_infinite]"
          />
        ))}
        {productCategories.map((cat, i) => (
          <circle
            key={cat.id}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="#b8dcb5"
            strokeWidth="5"
            strokeDasharray={`${r2(seg - 2)} ${r2(c - seg + 2)}`}
            strokeDashoffset={r2(-i * seg)}
            strokeOpacity={r2(0.35 + (i / n) * 0.65)}
          />
        ))}
      </svg>
      <div className="absolute text-center">
        <p className="text-4xl font-medium tracking-tight text-fg">{n}</p>
        <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-mint/80">categories</p>
      </div>
    </div>
  );
}

/** Card 4 — update notifications stacking in. */
export function UpdatesVisual() {
  const items = [
    { icon: PackageCheck, title: "Order confirmed", meta: "Order" },
    { icon: UserRoundCheck, title: "Engineer assigned", meta: "Service" },
    { icon: BellRing, title: "Ready for collection", meta: "Service" },
  ];
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-2.5 bg-[radial-gradient(70%_60%_at_70%_40%,rgb(184_220_181/0.16),transparent)] px-6" aria-hidden>
      {items.map(({ icon: Icon, title, meta }, i) => (
        <div
          key={title}
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-ink-900/80 px-3.5 py-3 backdrop-blur"
          style={{ marginLeft: `${i * 6}%`, opacity: r2(0.55 + i * 0.22) }}
        >
          <span className="grid size-8 place-items-center rounded-lg bg-brand/15 text-brand">
            <Icon className="size-4" />
          </span>
          <span className="flex-1 text-sm text-fg">{title}</span>
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-fg-dim">{meta}</span>
        </div>
      ))}
    </div>
  );
}
