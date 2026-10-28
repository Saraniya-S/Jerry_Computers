import type { Metadata } from "next";
import { asc, ne } from "drizzle-orm";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { TeamManager, type Member } from "@/components/admin/TeamManager";
import { requireStaff } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";

export const metadata: Metadata = { title: "Staff accounts" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function TeamPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Team />
    </Suspense>
  );
}

async function Team() {
  const me = await requireStaff(["admin"]);
  const rows = await db.select().from(schema.users).where(ne(schema.users.role, "customer")).orderBy(asc(schema.users.role), asc(schema.users.firstName));
  const members: Member[] = rows.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phone: u.phone,
    role: u.role as Member["role"],
    isSuperAdmin: u.isSuperAdmin,
    status: u.disabledAt ? "disabled" : u.passwordHash ? "active" : "invited",
    lastLogin: u.lastLoginAt ? dateFmt.format(u.lastLoginAt) : null,
  }));
  return (
    <>
      <PageHeader title="Staff accounts" count={members.length} description="Admins, e-commerce staff and service engineers." />
      <TeamManager members={members} meId={me.id} isSuperAdmin={me.isSuperAdmin} />
    </>
  );
}
