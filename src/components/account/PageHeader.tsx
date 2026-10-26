import type { ReactNode } from "react";

/** Title row at the top of each customer page, like the shell's "Databases 14 · Create database". */
export function PageHeader({ title, count, description, actions }: { title: ReactNode; count?: number; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-7">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2.5 text-xl font-semibold tracking-[-0.02em] text-fg">
          {title}
          {count !== undefined && <span className="rounded-md bg-ink-900 px-1.5 py-0.5 font-mono text-xs font-medium text-fg-muted">{count}</span>}
        </h1>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-2xl border border-line bg-ink-950 text-fg-muted">{icon}</div>
      <p className="mt-4 font-medium text-fg">{title}</p>
      <div className="mt-1 max-w-sm text-sm text-fg-muted">{children}</div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="border-b border-line px-5 py-5 sm:px-7">
        <div className="h-6 w-48 rounded bg-ink-900" />
        <div className="mt-2 h-4 w-72 rounded bg-ink-900" />
      </div>
      <div className="grid gap-4 p-5 sm:p-7 md:grid-cols-3">
        <div className="h-28 rounded-xl bg-ink-900" />
        <div className="h-28 rounded-xl bg-ink-900" />
        <div className="h-28 rounded-xl bg-ink-900" />
      </div>
    </div>
  );
}
