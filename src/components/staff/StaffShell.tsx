"use client";

import { Bell, Boxes, LayoutDashboard, Package, Undo2, UserRound, Users } from "lucide-react";
import type { ReactNode } from "react";
import { DashboardShell, type NavGroup } from "@/components/account/DashboardShell";

/** Mirrors the staff permissions in src/lib/server/permissions.ts; each page checks on the server. */
const groups: NavGroup[] = [
  {
    label: "Orders",
    items: [
      { href: "/staff", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/staff/orders", label: "Orders", icon: Package },
      { href: "/staff/returns", label: "Cancellations & returns", icon: Undo2 },
    ],
  },
  {
    label: "Lookup",
    items: [
      { href: "/staff/products", label: "Products & stock", icon: Boxes },
      { href: "/staff/customers", label: "Customers", icon: Users },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/staff/notifications", label: "Notifications", icon: Bell },
      { href: "/staff/profile", label: "Profile", icon: UserRound },
    ],
  },
];

/** E-commerce staff workspace, on the same shell as the admin, engineer and customer areas. */
export function StaffShell({ userMenu, actions, children }: { userMenu: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <DashboardShell groups={groups} root={{ href: "/staff", label: "Store desk" }} userMenu={userMenu} actions={actions}>
      {children}
    </DashboardShell>
  );
}
