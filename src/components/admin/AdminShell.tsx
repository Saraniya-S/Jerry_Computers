"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  Bell,
  Boxes,
  ChartColumn,
  ClipboardList,
  ExternalLink,
  FolderTree,
  HardHat,
  House,
  LayoutDashboard,
  Package,
  ScrollText,
  Settings,
  Tags,
  UserCog,
  Users,
  Warehouse,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import { DashboardShell, type NavGroup } from "@/components/account/DashboardShell";

/** Mirrors src/lib/server/permissions.ts; the pages and actions enforce it on the server. */
const adminGroups: NavGroup[] = [
  {
    label: "Business",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/admin/reports", label: "Reports", icon: ChartColumn },
      { href: "/admin/activity", label: "Activity log", icon: ScrollText },
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: Package },
      { href: "/admin/customers", label: "Customers", icon: Users },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/products", label: "Products", icon: Boxes },
      { href: "/admin/inventory", label: "Inventory", icon: Warehouse },
      { href: "/admin/categories", label: "Categories", icon: FolderTree },
      { href: "/admin/brands", label: "Brands", icon: Tags },
    ],
  },
  {
    label: "Service desk",
    items: [
      { href: "/admin/service-requests", label: "Service requests", icon: ClipboardList },
      { href: "/admin/transfers", label: "Transfer approvals", icon: ArrowLeftRight },
      { href: "/admin/engineers", label: "Engineers", icon: HardHat },
      { href: "/admin/services", label: "Service catalogue", icon: Wrench },
    ],
  },
  {
    label: "Website",
    items: [
      { href: "/admin/homepage", label: "Homepage", icon: House },
      { href: "/admin/settings", label: "Shop settings", icon: Settings },
    ],
  },
  { label: "Team", items: [{ href: "/admin/team", label: "Staff accounts", icon: UserCog }] },
];

/** Admin area, on the same shell as the customer, engineer and staff areas. */
export function AdminShell({ userMenu, children }: { userMenu: ReactNode; children: ReactNode }) {
  return (
    <DashboardShell
      groups={adminGroups}
      root={{ href: "/admin", label: "Admin" }}
      userMenu={userMenu}
      actions={
        <Link
          href="/"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-sm text-fg transition-colors hover:bg-ink-850"
        >
          View store <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      }
    >
      {children}
    </DashboardShell>
  );
}
