import Link from "next/link";

/** The "J" chip mark: a stylised die with a single trace running through it. */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="none">
      <rect x="3" y="3" width="26" height="26" rx="7" fill="currentColor" />
      <path d="M19.5 9v9.2a4.3 4.3 0 0 1-8.6 0" stroke="var(--ink-950)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="19.5" cy="9" r="1.9" fill="var(--copper)" />
    </svg>
  );
}

export function Logo({ className = "", onClick }: { className?: string; onClick?: () => void }) {
  return (
    <Link href="/#home" onClick={onClick} className={`group inline-flex items-center gap-2.5 text-fg ${className}`} aria-label="Jerry Computers — home">
      <LogoMark className="size-7 text-fg transition-colors group-hover:text-copper" />
      <span className="whitespace-nowrap text-[1.05rem] font-semibold tracking-[-0.02em]">
        Jerry<span className="font-normal text-fg-muted"> Computers</span>
      </span>
    </Link>
  );
}
