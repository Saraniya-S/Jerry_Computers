"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/account/PageHeader";
import type { ActionResult } from "@/lib/admin/result";
import { ResultAlert, smallButton, Spinner, useAdminAction } from "./actions-ui";

type Item = { id: string; title: string; body: string; href: string | null; readAt: Date | null; createdAt: Date };

const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** A person's in-app notifications with mark-as-read. Shared by the admin and engineer areas. */
export function NotificationList({ items, unread, markRead }: { items: Item[]; unread: number; markRead: (ids?: string[]) => Promise<ActionResult> }) {
  const { run, busy, result } = useAdminAction();
  if (!items.length)
    return (
      <EmptyState icon={<Bell className="size-5" aria-hidden />} title="No notifications">
        Assignments, transfer decisions and schedule changes show up here.
      </EmptyState>
    );
  return (
    <div className="grid gap-3 p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">{unread ? `${unread} unread` : "All read"}</p>
        {unread > 0 && (
          <button type="button" disabled={busy !== null} onClick={() => run("all", () => markRead())} className={smallButton}>
            {busy === "all" && <Spinner />} Mark all as read
          </button>
        )}
      </div>
      {result && !result.ok && <ResultAlert result={result} />}
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {items.map((n) => {
          const body = (
            <>
              <span className="flex items-start gap-2.5">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-brand"}`} aria-hidden />
                <span className="min-w-0">
                  <span className={`block ${n.readAt ? "text-fg-muted" : "font-medium text-fg"}`}>
                    {n.title}
                    {!n.readAt && <span className="sr-only"> (unread)</span>}
                  </span>
                  {n.body && <span className="block text-fg-muted">{n.body}</span>}
                  <span className="block text-xs text-fg-dim">{fmt.format(n.createdAt)}</span>
                </span>
              </span>
            </>
          );
          return (
            <li key={n.id} className="text-sm">
              {n.href ? (
                <Link href={n.href} onClick={() => !n.readAt && markRead([n.id])} className="block px-4 py-3 hover:bg-ink-950">
                  {body}
                </Link>
              ) : (
                <div className="px-4 py-3">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
