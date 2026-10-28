import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { UserMenu, UserMenuSkeleton } from "@/components/account/UserMenu";
import { StaffShell } from "@/components/staff/StaffShell";
import { unreadCount } from "@/lib/server/notifications";
import { requirePermission } from "@/lib/server/permissions";

export const metadata: Metadata = { title: { default: "Store desk", template: "%s · Store desk · Jerry Computers" } };

/** The shell prerenders; the menu and bell wait on the session. Each page checks access itself. */
export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <StaffShell
      actions={
        <Suspense fallback={null}>
          <NotificationBell />
        </Suspense>
      }
      userMenu={
        <Suspense fallback={<UserMenuSkeleton />}>
          <StaffMenu />
        </Suspense>
      }
    >
      {children}
    </StaffShell>
  );
}

async function StaffMenu() {
  const me = await requirePermission("staffPortal.view", "/staff");
  return <UserMenu name={`${me.firstName} ${me.lastName}`.trim()} email={me.email} profileHref={me.role === "ecommerce_staff" ? "/staff/profile" : null} badge={me.role === "admin" ? "Admin" : "E-commerce"} />;
}

async function NotificationBell() {
  const me = await requirePermission("staffPortal.view", "/staff");
  const n = await unreadCount(me.id);
  return (
    <Link
      href="/staff/notifications"
      aria-label={n ? `Notifications, ${n} unread` : "Notifications"}
      className="relative grid size-9 place-items-center rounded-full border border-line-strong text-fg-muted transition-colors hover:bg-ink-850 hover:text-fg"
    >
      <Bell className="size-4" aria-hidden />
      {n > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-medium leading-5 text-white">{n > 99 ? "99+" : n}</span>}
    </Link>
  );
}
