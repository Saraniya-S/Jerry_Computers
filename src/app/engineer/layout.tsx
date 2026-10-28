import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { UserMenu, UserMenuSkeleton } from "@/components/account/UserMenu";
import { EngineerShell } from "@/components/engineer/EngineerShell";
import { requireStaff } from "@/lib/server/auth";

export const metadata: Metadata = { title: { default: "Engineer workspace", template: "%s · Engineer · Jerry Computers" } };

export default function EngineerLayout({ children }: { children: ReactNode }) {
  return (
    <EngineerShell
      userMenu={
        <Suspense fallback={<UserMenuSkeleton />}>
          <EngineerMenu />
        </Suspense>
      }
    >
      {children}
    </EngineerShell>
  );
}

async function EngineerMenu() {
  const me = await requireStaff(["engineer"]);
  return <UserMenu name={`${me.firstName} ${me.lastName}`.trim()} email={me.email} profileHref={null} badge="Engineer" />;
}
