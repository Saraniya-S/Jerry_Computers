import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export type MegaItem = {
  title: string;
  description: string;
  href: string;
  visual: ReactNode;
};

type MegaMenuProps = {
  id: string;
  heading: string;
  items: MegaItem[];
  footer: { label: string; href: string }[];
  onNavigate: () => void;
};

export function MegaMenu({ id, heading, items, footer, onNavigate }: MegaMenuProps) {
  return (
    <div id={id} className="rounded-2xl border border-line bg-ink-900/95 p-6 shadow-[0_40px_80px_-30px_var(--shadow)] backdrop-blur-xl">
      <p className="text-lg font-medium tracking-tight text-fg">{heading}</p>
      <ul className="mt-5 grid grid-cols-4 gap-4">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className="group block overflow-hidden rounded-xl border border-line bg-ink-850 transition-colors hover:border-line-strong"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-b from-ink-700/60 to-ink-900">{item.visual}</div>
              <div className="p-4">
                <p className="flex items-center gap-1 text-sm font-medium text-fg">
                  {item.title}
                  <ChevronRight className="size-3.5 text-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:text-copper" aria-hidden />
                </p>
                <p className="mt-1.5 text-[0.8rem] leading-snug text-fg-muted">{item.description}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
        <div className="flex gap-6">
          {footer.map((f) => (
            <Link key={f.href} href={f.href} onClick={onNavigate} className="text-[0.8rem] text-fg-muted transition-colors hover:text-fg">
              {f.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
