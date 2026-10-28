"use client";

import { ClipboardList } from "lucide-react";
import type { ReactNode } from "react";
import { DashboardShell, type NavGroup } from "@/components/account/DashboardShell";

const groups: NavGroup[] = [{ label: "Work", items: [{ href: "/engineer", label: "My jobs", icon: ClipboardList, exact: true }] }];

/** Service engineer area, on the same shell as the customer and admin areas. */
export function EngineerShell({ userMenu, children }: { userMenu: ReactNode; children: ReactNode }) {
  return (
    <DashboardShell groups={groups} root={{ href: "/engineer", label: "Engineer" }} userMenu={userMenu}>
      {children}
    </DashboardShell>
  );
}
