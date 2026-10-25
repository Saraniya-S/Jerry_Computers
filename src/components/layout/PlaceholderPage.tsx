import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Navbar } from "@/components/navigation/Navbar";
import { HomeFooter } from "@/components/home/HomeFooter";
import { Eyebrow } from "@/components/ui/SectionHeading";

type Props = {
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  /** Shown as a clearly marked notice that this page is not complete yet. */
  notice?: ReactNode;
  children?: ReactNode;
};

/** Shared shell for secondary routes that exist so homepage links resolve. */
export function PlaceholderPage({ eyebrow, title, intro, notice, children }: Props) {
  return (
    <>
      <Navbar />
      <main id="main" className="flex-1 bg-ink-950">
        <div className="mx-auto max-w-[1100px] px-5 pb-24 pt-36 sm:px-8 sm:pt-44">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden /> Back to home
          </Link>
          <Eyebrow className="mt-10">{eyebrow}</Eyebrow>
          <h1 className="mt-5 max-w-3xl text-balance text-4xl font-medium tracking-[-0.035em] text-fg sm:text-6xl">{title}</h1>
          {intro && <div className="mt-5 max-w-2xl text-lg leading-relaxed text-fg-muted">{intro}</div>}
          {notice && (
            <div role="note" className="mt-8 max-w-2xl rounded-2xl border border-copper/30 bg-copper/[0.06] p-5 text-sm leading-relaxed text-fg-muted">
              {notice}
            </div>
          )}
          {children && <div className="mt-14">{children}</div>}
        </div>
      </main>
      <HomeFooter />
    </>
  );
}
