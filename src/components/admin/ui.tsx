import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { ReactNode } from "react";

/** Building blocks for admin pages, in the dashboard shell's style. */

export const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
export const dateTimeFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
export const fullDateTimeFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export type Tone = "neutral" | "brand" | "good" | "warn" | "bad" | "info" | "muted";
const tones: Record<Tone, string> = {
  neutral: "bg-ink-900 text-fg-muted",
  brand: "bg-brand/10 text-brand",
  good: "bg-mint-soft text-leaf",
  warn: "bg-amber-100 text-amber-800",
  bad: "bg-red-50 text-red-700",
  info: "bg-sky-100 text-sky-800",
  muted: "bg-ink-900 text-fg-dim",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Kpi({
  icon,
  label,
  value,
  hint,
  href,
  tone,
  className = "",
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  tone?: "warn";
  className?: string;
}) {
  const body = (
    <>
      <span className={`grid size-8 place-items-center rounded-lg ${tone === "warn" ? "bg-amber-100 text-amber-800" : "bg-ink-850 text-brand shadow-[0_1px_2px_var(--line)]"}`}>{icon}</span>
      <span className="mt-3 block text-2xl font-semibold tabular-nums tracking-[-0.02em] text-fg">{value}</span>
      <span className="mt-0.5 block text-xs text-fg-muted">
        {label}
        {hint && <span className="text-fg-dim"> · {hint}</span>}
      </span>
    </>
  );
  const cls = `rounded-xl border border-line bg-ink-950 p-4 ${className}`;
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-brand/30`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Panel({ title, href, count, actions, children }: { title: ReactNode; href?: string; count?: number; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-line">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-ink-950 px-4 py-3 sm:px-5">
        <h2 className="flex items-center gap-2 text-sm font-medium text-fg">
          {title}
          {count ? <span className="rounded-md bg-amber-100 px-1.5 py-0.5 font-mono text-xs text-amber-800">{count}</span> : null}
        </h2>
        <div className="flex items-center gap-3">
          {actions}
          {href && (
            <Link href={href} className="text-xs text-fg-muted hover:text-brand">
              View all
            </Link>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Horizontal-scrolling table with the admin header style. Pass rows as children. */
export function Table({ columns, minWidth = 760, children }: { columns: (string | { label: string; className?: string })[]; minWidth?: number; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-left text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-line text-xs text-fg-dim">
            {columns.map((c, i) => {
              const col = typeof c === "string" ? { label: c } : c;
              return (
                <th key={i} scope="col" className={`px-5 py-2.5 font-medium first:sm:pl-7 ${col.className ?? ""}`}>
                  {col.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export const td = "px-5 py-3 first:sm:pl-7";

export const filterInput = "h-9 rounded-lg border border-line-strong bg-ink-850 px-2.5 text-sm text-fg";

/** A GET form of filters. Submitting resets to page 1. */
export function FilterBar({ children, resetHref }: { children: ReactNode; resetHref?: string }) {
  return (
    <form className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3 sm:px-7">
      {children}
      <button type="submit" className="h-9 rounded-lg bg-ink-900 px-3.5 text-sm text-fg hover:bg-ink-800">
        Apply
      </button>
      {resetHref && (
        <Link href={resetHref} className="h-9 rounded-lg px-2.5 text-sm leading-9 text-fg-muted hover:text-fg">
          Clear
        </Link>
      )}
    </form>
  );
}

export function SearchInput({ value, placeholder, label = "Search" }: { value: string; placeholder: string; label?: string }) {
  return (
    <label className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-line-strong bg-ink-850 px-3 text-sm sm:max-w-xs">
      <Search className="size-4 shrink-0 text-fg-dim" aria-hidden />
      <input name="q" defaultValue={value} placeholder={placeholder} aria-label={label} style={{ outline: "none" }} className="min-w-0 flex-1 bg-transparent" />
    </label>
  );
}

export function FilterSelect({ name, value, label, options, all }: { name: string; value: string; label: string; options: { value: string; label: string }[]; all: string }) {
  return (
    <select name={name} defaultValue={value} aria-label={label} className={filterInput}>
      <option value="">{all}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function DateRange({ from, to }: { from: string; to: string }) {
  return (
    <span className="flex items-center gap-1.5 text-sm text-fg-muted">
      <input type="date" name="from" defaultValue={from} aria-label="From date" className={filterInput} />
      <span aria-hidden>–</span>
      <input type="date" name="to" defaultValue={to} aria-label="To date" className={filterInput} />
    </span>
  );
}

/** Previous/next paging that keeps the current filters. */
export function Pagination({ page, pageSize, total, params, path }: { page: number; pageSize: number; total: number; params: Record<string, string | undefined>; path: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams(Object.entries({ ...params, page: p > 1 ? String(p) : undefined }).filter((e): e is [string, string] => Boolean(e[1])));
    const qs = sp.toString();
    return qs ? `${path}?${qs}` : path;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "inline-flex h-8 items-center gap-1 rounded-lg border border-line-strong px-2.5 text-sm text-fg hover:bg-ink-900";
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm text-fg-muted sm:px-7">
      <span>
        {from}–{to} of {total}
      </span>
      <span className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={btn} rel="prev">
            <ChevronLeft className="size-4" aria-hidden /> Previous
          </Link>
        ) : null}
        <span className="tabular-nums">
          Page {Math.min(page, pages)} of {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className={btn} rel="next">
            Next <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </span>
    </nav>
  );
}

/** Reads a search param as a string, or "" when missing or repeated. */
export const param = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim().slice(0, 100) : "");
export const pageParam = (v: string | string[] | undefined) => Math.max(1, Math.min(10_000, Number.parseInt(param(v) || "1", 10) || 1));
export const oneOf = <T extends string>(v: string | string[] | undefined, values: readonly T[]) => (values.includes(param(v) as T) ? (param(v) as T) : undefined);
export const dateParam = (v: string | string[] | undefined) => (/^\d{4}-\d{2}-\d{2}$/.test(param(v)) ? param(v) : "");

export function personName(first: string | null | undefined, last: string | null | undefined) {
  return `${first ?? ""} ${last ?? ""}`.trim();
}

export const sectionPad = "p-5 sm:p-7";
