"use client";

import Link from "next/link";
import { LayoutDashboard, MapPin, Package, ShoppingBag, UserRound, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import type { Product } from "@/data/products";
import { CartButton } from "@/components/session/CartButton";
import { DashboardShell, type NavGroup } from "./DashboardShell";
import { ProductSearch } from "./ProductSearch";
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

/** The customer area: account pages with search, cart and a book-a-repair nudge. */
export function CustomerShell({ userMenu, searchItems, children }: { userMenu: ReactNode; searchItems: Pick<Product, "slug" | "name" | "category">[]; children: ReactNode }) {
  return (
    <DashboardShell
      groups={groups}
      root={{ href: "/account", label: "My account" }}
      sidebarTop={<ProductSearch products={searchItems} />}
      sidebarBottom={<PromoCard />}
      userMenu={userMenu}
      actions={
        <>
        <CartButton />
        <Link
          href="/products"
          className="hidden h-8 items-center rounded-full border border-line-strong px-3.5 text-sm text-fg transition-colors hover:bg-ink-850 sm:inline-flex"
        >
          Shop
        </Link>
        <Link
          href="/services/request"
          className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-brand px-3.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)]"
        >
          <Wrench className="size-3.5" aria-hidden />
          <span className="sm:hidden">Book</span>
          <span className="hidden sm:inline">Book a service</span>
        </Link>
        </>
      }
    >
      {children}
    </DashboardShell>
  );
}
