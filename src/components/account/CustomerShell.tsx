"use client";

import { LayoutDashboard, MapPin, Package, ShoppingBag, UserRound, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { CartButton } from "@/components/session/CartButton";
import { DashboardShell, type NavGroup } from "./DashboardShell";
import { PromoCard } from "./PromoCard";

const groups: NavGroup[] = [
  {
    label: "Account",
    items: [
      { href: "/account", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/account/orders", label: "Orders", icon: Package },
      { href: "/account/services", label: "Service requests", icon: Wrench },
    ],
  },
  {
    label: "Shop",
    items: [
      { href: "/products", label: "Browse products", icon: ShoppingBag },
      { href: "/services/request", label: "Book a service", icon: Wrench },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/account/profile", label: "Profile & security", icon: UserRound },
      { href: "/account/addresses", label: "Addresses", icon: MapPin },
    ],
  },
];

/** The customer area: account pages with the cart and a book-a-repair nudge. */
export function CustomerShell({ userMenu, children }: { userMenu: ReactNode; children: ReactNode }) {
  return (
    <DashboardShell
      groups={groups}
      root={{ href: "/account", label: "My account" }}
      sidebarBottom={<PromoCard />}
      userMenu={userMenu}
      actions={<CartButton />}
    >
      {children}
    </DashboardShell>
  );
}
