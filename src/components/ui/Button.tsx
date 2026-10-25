import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "copper" | "ghost" | "outline";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background-color,color,border-color,transform] duration-200 active:scale-[0.98] whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-fg text-ink-950 hover:opacity-90",
  copper: "bg-copper text-ink-950 hover:bg-[var(--copper-hover)]",
  ghost: "text-fg hover:text-copper",
  outline: "border border-line-strong text-fg hover:border-fg/40 hover:bg-[var(--inset)]",
};

const sizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-12 px-6 text-base",
};

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: Variant;
  size?: keyof typeof sizes;
  className?: string;
  children: ReactNode;
};

export function ButtonLink({ variant = "primary", size = "md", className = "", children, ...props }: ButtonLinkProps) {
  return (
    <Link className={`${base} ${variants[variant]} ${variant === "ghost" ? "px-1" : sizes[size]} ${className}`} {...props}>
      {children}
    </Link>
  );
}
