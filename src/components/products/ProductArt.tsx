import type { ProductCategoryId } from "@/data/products";

/**
 * Original vector artwork for each product category. Used until real
 * product photography is supplied via `Product.image`.
 */

const accents = ["#5a4fa0", "#7cbf78", "#2f6b22"] as const;

type ArtProps = {
  category: ProductCategoryId;
  variant?: 0 | 1 | 2;
  className?: string;
  title?: string;
  /** "cover" crops the artwork to fill its box (used for narrow reel slices). */
  fit?: "contain" | "cover";
};

export function ProductArt({ category, variant = 0, className = "", title, fit = "contain" }: ArtProps) {
  const a = accents[variant];
  const id = `${category}-${variant}`;
  return (
    <svg viewBox="0 0 240 180" preserveAspectRatio={fit === "cover" ? "xMidYMid slice" : undefined} className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <linearGradient id={`body-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3d48" />
          <stop offset="1" stopColor="#15171d" />
        </linearGradient>
        <linearGradient id={`face-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22252e" />
          <stop offset="1" stopColor="#111218" />
        </linearGradient>
        <linearGradient id={`screen-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#1d1a3d" stopOpacity="0.9" />
          <stop offset="1" stopColor="#0c0d12" />
        </linearGradient>
        <radialGradient id={`glow-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={a} stopOpacity="0.45" />
          <stop offset="1" stopColor={a} stopOpacity="0" />
        </radialGradient>
      </defs>
      {fit === "contain" && <ellipse cx="120" cy="158" rx="86" ry="10" fill="#000" opacity="0.55" />}
      <ellipse cx="120" cy="96" rx="96" ry="70" fill={`url(#glow-${id})`} opacity="0.5" />
      {renderShape(category, id, a, variant)}
    </svg>
  );
}

function renderShape(category: ProductCategoryId, id: string, a: string, v: number) {
  const body = `url(#body-${id})`;
  const face = `url(#face-${id})`;
  const screen = `url(#screen-${id})`;
  const edge = "rgba(255,255,255,0.18)";

  switch (category) {
    case "laptops":
      return (
        <g>
          <path d="M58 34h124a6 6 0 0 1 6 6v84H52V40a6 6 0 0 1 6-6Z" fill={body} stroke={edge} />
          <rect x="60" y="42" width="120" height="76" rx="2" fill={screen} />
          <path d="M60 42h120L118 118H60Z" fill="#fff" opacity="0.05" />
          {v === 1 && <rect x="72" y="56" width="58" height="5" rx="2.5" fill={a} opacity="0.8" />}
          <path d="M30 128h180l-8 14H38Z" fill={face} stroke={edge} />
          <path d="M104 128h32l-2 4h-28Z" fill="#0c0d12" />
          <path d="M30 128h180" stroke="rgba(255,255,255,0.3)" />
        </g>
      );
    case "desktops":
      return (
        <g>
          <path d="M84 22h72a6 6 0 0 1 6 6v118a4 4 0 0 1-4 4H82a4 4 0 0 1-4-4V28a6 6 0 0 1 6-6Z" fill={body} stroke={edge} />
          <rect x="88" y="32" width="64" height="88" rx="3" fill="#0a0b0f" stroke="rgba(255,255,255,0.08)" />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <circle cx="120" cy={50 + i * 27} r="11" fill="none" stroke={a} strokeOpacity={v === 2 ? 0.4 : 0.85} strokeWidth="2" />
              <circle cx="120" cy={50 + i * 27} r="3" fill={a} opacity="0.7" />
            </g>
          ))}
          <rect x="88" y="128" width="30" height="3" rx="1.5" fill={a} />
          <circle cx="146" cy="134" r="3" fill="none" stroke={edge} />
        </g>
      );
    case "components":
      if (v === 0)
        return (
          <g>
            <rect x="34" y="58" width="172" height="62" rx="6" fill={body} stroke={edge} />
            <circle cx="88" cy="89" r="23" fill="#0b0c10" stroke={edge} />
            <circle cx="152" cy="89" r="23" fill="#0b0c10" stroke={edge} />
            {[88, 152].map((cx) => (
              <g key={cx} stroke={a} strokeOpacity="0.7" strokeWidth="1.5">
                <path d={`M${cx} 70v38M${cx - 19} 89h38M${cx - 13} 76l26 26M${cx + 13} 76l-26 26`} />
              </g>
            ))}
            <rect x="34" y="120" width="120" height="8" fill="#c9a24a" opacity="0.65" />
            <rect x="40" y="62" width="40" height="3" rx="1.5" fill={a} />
          </g>
        );
      if (v === 1)
        return (
          <g>
            {[0, 1].map((i) => (
              <g key={i} transform={`translate(0 ${i * 34})`}>
                <rect x="40" y="54" width="160" height="26" rx="3" fill={body} stroke={edge} />
                {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
                  <rect key={c} x={50 + c * 18} y="60" width="12" height="14" rx="1" fill="#0a0b0f" />
                ))}
                <rect x="40" y="80" width="160" height="5" fill="#c9a24a" opacity="0.6" />
                <rect x="40" y="54" width="160" height="2.5" fill={a} />
              </g>
            ))}
          </g>
        );
      return (
        <g>
          <rect x="30" y="76" width="180" height="32" rx="3" fill={body} stroke={edge} />
          <rect x="44" y="84" width="34" height="16" rx="2" fill="#0a0b0f" />
          <rect x="86" y="84" width="22" height="16" rx="2" fill="#0a0b0f" />
          <rect x="116" y="84" width="22" height="16" rx="2" fill="#0a0b0f" />
          <rect x="146" y="86" width="44" height="12" rx="2" fill={a} opacity="0.25" />
          <rect x="196" y="82" width="10" height="20" rx="2" fill="#c9a24a" opacity="0.65" />
        </g>
      );
    case "cctv":
      if (v === 0)
        return (
          <g>
            <rect x="64" y="44" width="112" height="12" rx="3" fill={body} stroke={edge} />
            <path d="M74 56h92a46 46 0 0 1-92 0Z" fill={face} stroke={edge} />
            <circle cx="120" cy="80" r="17" fill="#0c0d12" stroke={edge} />
            <circle cx="120" cy="80" r="9" fill={screen} />
            <circle cx="116" cy="76" r="2.5" fill="#fff" opacity="0.7" />
          </g>
        );
      return (
        <g>
          <path d="M150 52v54h-12" stroke={edge} strokeWidth="5" fill="none" />
          <rect x="146" y="44" width="40" height="12" rx="3" fill={body} stroke={edge} />
          <path d="M52 62h104a8 8 0 0 1 8 8v22a8 8 0 0 1-8 8H52Z" fill={body} stroke={edge} transform="rotate(-8 108 80)" />
          <circle cx="54" cy="88" r="15" fill="#0c0d12" stroke={edge} />
          <circle cx="54" cy="88" r="8" fill={screen} />
          {v === 2 && <rect x="60" y="124" width="120" height="22" rx="4" fill={body} stroke={edge} />}
          {v === 2 && <circle cx="72" cy="135" r="3" fill={a} />}
          <circle cx="142" cy="74" r="2.5" fill="#ff5d5d" />
        </g>
      );
    case "printers":
      return (
        <g>
          <path d="M80 30h80v30H80Z" fill="#dfe6ee" opacity={v === 1 ? 0.6 : 0.9} />
          <rect x="44" y="56" width="152" height="62" rx="8" fill={body} stroke={edge} />
          <rect x="62" y="70" width="40" height="10" rx="2" fill="#0a0b0f" />
          <circle cx="170" cy="74" r="4" fill={a} />
          <rect x="52" y="118" width="136" height="20" rx="4" fill={face} stroke={edge} />
          <path d="M86 126h68v18H86Z" fill="#dfe6ee" opacity="0.85" />
          {v === 2 && <rect x="56" y="44" width="128" height="14" rx="4" fill={face} stroke={edge} />}
          <rect x="44" y="100" width="152" height="2" fill={a} opacity="0.35" />
        </g>
      );
    case "ups":
      return (
        <g>
          {v === 2 ? (
            <>
              <rect x="34" y="64" width="172" height="44" rx="4" fill={body} stroke={edge} />
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                <rect key={c} x={110 + c * 9} y="72" width="4" height="28" rx="2" fill="#0a0b0f" />
              ))}
              <rect x="46" y="76" width="44" height="18" rx="2" fill={screen} />
            </>
          ) : (
            <>
              <rect x="82" y="30" width="76" height="118" rx="8" fill={body} stroke={edge} />
              <rect x="92" y="42" width="56" height="30" rx="3" fill={screen} />
              <path d="M104 62l6-12v8h8l-6 12v-8Z" fill="#fff" opacity="0.85" />
              <circle cx="120" cy="96" r="9" fill="none" stroke={a} strokeWidth="2.5" />
              <path d="M120 89v6" stroke={a} strokeWidth="2.5" strokeLinecap="round" />
              {[0, 1, 2, 3].map((c) => (
                <rect key={c} x="96" y={116 + c * 7} width="48" height="2.5" rx="1" fill="#0a0b0f" />
              ))}
            </>
          )}
        </g>
      );
    case "accessories":
      if (v === 1)
        return (
          <g>
            <path d="M120 34c26 0 40 22 40 52 0 34-16 56-40 56s-40-22-40-56c0-30 14-52 40-52Z" fill={body} stroke={edge} />
            <path d="M120 34v40" stroke="#0c0d12" strokeWidth="2" />
            <rect x="116" y="48" width="8" height="16" rx="4" fill={a} />
          </g>
        );
      if (v === 2)
        return (
          <g>
            <rect x="58" y="70" width="124" height="40" rx="12" fill={body} stroke={edge} />
            {[0, 1, 2, 3].map((c) => (
              <rect key={c} x={74 + c * 24} y="84" width="14" height="10" rx="2" fill="#0a0b0f" />
            ))}
            <path d="M182 90h26" stroke={edge} strokeWidth="6" strokeLinecap="round" />
            <circle cx="164" cy="80" r="2.5" fill={a} />
          </g>
        );
      return (
        <g>
          <path d="M34 72h172l8 52H26Z" fill={body} stroke={edge} />
          {[0, 1, 2].map((r) =>
            Array.from({ length: 12 }).map((_, c) => (
              <rect
                key={`${r}-${c}`}
                x={38 + c * 14 + r * 2}
                y={78 + r * 11}
                width="10"
                height="8"
                rx="1.5"
                fill={r === 0 && c % 4 === 0 ? a : "#111218"}
                opacity={r === 0 && c % 4 === 0 ? 0.8 : 1}
              />
            )),
          )}
          <rect x="74" y="111" width="92" height="8" rx="1.5" fill="#111218" />
        </g>
      );
  }
}
