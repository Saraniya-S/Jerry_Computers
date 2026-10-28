"use client";

import { ArrowLeftRight, Bell, ClipboardList, LayoutDashboard, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { DashboardShell, type NavGroup } from "@/components/account/DashboardShell";

const groups: NavGroup[] = [
  {
    label: "Work",
    items: [
      { href: "/engineer", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/engineer/jobs", label: "My jobs", icon: ClipboardList },
      { href: "/engineer/transfers", label: "Transfer requests", icon: ArrowLeftRight },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/engineer/notifications", label: "Notifications", icon: Bell },
      { href: "/engineer/profile", label: "Profile", icon: UserRound },
    ],
  },
];

/** Service engineer area, on the same shell as the admin and customer areas. */
export function EngineerShell({ userMenu, actions, children }: { userMenu: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <DashboardShell groups={groups} root={{ href: "/engineer", label: "Engineer" }} userMenu={userMenu} actions={actions}>
      {children}
    </DashboardShell>
  );
}
