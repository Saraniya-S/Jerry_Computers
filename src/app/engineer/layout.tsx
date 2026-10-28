import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { UserMenu, UserMenuSkeleton } from "@/components/account/UserMenu";
import { EngineerShell } from "@/components/engineer/EngineerShell";
import { requireStaff } from "@/lib/server/auth";
import { unreadCount } from "@/lib/server/notifications";

export const metadata: Metadata = { title: { default: "Engineer workspace", template: "%s · Engineer · Jerry Computers" } };

/** The shell prerenders; the menu and bell wait on the session. Each page checks access itself. */
export default function EngineerLayout({ children }: { children: ReactNode }) {
  return (
    <EngineerShell
      actions={
        <Suspense fallback={null}>
          <NotificationBell />
        </Suspense>
      }
      userMenu={
        <Suspense fallback={<UserMenuSkeleton />}>
          <EngineerMenu />
        </Suspense>
      }
    >
      {children}
    </EngineerShell>
  );
}

async function EngineerMenu() {
  const me = await requireStaff(["engineer"]);
  return <UserMenu name={`${me.firstName} ${me.lastName}`.trim()} email={me.email} profileHref="/engineer/profile" badge="Engineer" />;
}

async function NotificationBell() {
  const me = await requireStaff(["engineer"]);
  const n = await unreadCount(me.id);
  return (
    <Link
      href="/engineer/notifications"
      aria-label={n ? `Notifications, ${n} unread` : "Notifications"}
      className="relative grid size-9 place-items-center rounded-full border border-line-strong text-fg-muted transition-colors hover:bg-ink-850 hover:text-fg"
    >
      <Bell className="size-4" aria-hidden />
      {n > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-medium leading-5 text-white">{n > 99 ? "99+" : n}</span>}
    </Link>
  );
}
