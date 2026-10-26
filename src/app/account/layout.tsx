import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { CustomerShell } from "@/components/account/CustomerShell";
import { UserMenu, UserMenuSkeleton } from "@/components/account/UserMenu";
import { requireCustomer } from "@/lib/server/auth";

export const metadata: Metadata = { title: { default: "My account", template: "%s · My account · Jerry Computers" } };

/** Customer area. The shell prerenders; only the account menu waits on the session. Each page checks access itself. */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <CustomerShell
      userMenu={
        <Suspense fallback={<UserMenuSkeleton />}>
          <AccountMenu />
        </Suspense>
      }
    >
      {children}
    </CustomerShell>
  );
}

async function AccountMenu() {
  const viewer = await requireCustomer();
  return <UserMenu name={`${viewer.firstName} ${viewer.lastName}`.trim()} email={viewer.email} />;
}
