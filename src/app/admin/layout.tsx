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
  // The admin area is admins only; e-commerce staff are sent to /staff.
  const staff = await requireStaff(["admin"]);
  const badge = staff.isSuperAdmin ? "Super admin" : "Admin";
  return <UserMenu name={`${staff.firstName} ${staff.lastName}`.trim()} email={staff.email} profileHref={null} badge={badge} />;
}
