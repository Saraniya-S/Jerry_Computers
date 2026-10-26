import type { ReactNode } from "react";

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`flex items-center gap-2 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-fg-muted ${className}`}>
      <span aria-hidden className="h-px w-5 bg-brand" />
      {children}
    </p>
  );
}

/** Italic serif accent used inside headings, echoing the Why Choose Us reference. */
export function Accent({ children }: { children: ReactNode }) {
  return <em className="font-serif font-normal italic tracking-normal text-fg">{children}</em>;
}

type SectionHeadingProps = {
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: "left" | "center";
  id?: string;
  className?: string;
};

export function SectionHeading({ eyebrow, title, intro, align = "left", id, className = "" }: SectionHeadingProps) {
  const center = align === "center";
  return (
    <div className={`${center ? "mx-auto text-center" : ""} max-w-3xl ${className}`}>
      <Eyebrow className={center ? "justify-center" : ""}>{eyebrow}</Eyebrow>
      <h2 id={id} className="mt-5 text-balance text-4xl font-medium tracking-[-0.03em] text-fg sm:text-5xl lg:text-[3.5rem] lg:leading-[1.02]">
        {title}
      </h2>
      {intro && <p className={`mt-5 max-w-xl text-pretty text-base leading-relaxed text-fg-muted sm:text-lg ${center ? "mx-auto" : ""}`}>{intro}</p>}
    </div>
  );
}
