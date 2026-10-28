import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { UserMenu, UserMenuSkeleton } from "@/components/account/UserMenu";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireStaff } from "@/lib/server/auth";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Jerry Computers" } };

/** The shell prerenders; the account menu waits on the session. Each page checks access itself. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminShell
      userMenu={
        <Suspense fallback={<UserMenuSkeleton />}>
          <StaffMenu />
        </Suspense>
      }
    >
      {children}
    </AdminShell>
  );
}

async function StaffMenu() {
  const staff = await requireStaff();
  const badge = staff.isSuperAdmin ? "Super admin" : staff.role === "admin" ? "Admin" : "E-commerce";
  return <UserMenu name={`${staff.firstName} ${staff.lastName}`.trim()} email={staff.email} profileHref={null} badge={badge} />;
}
