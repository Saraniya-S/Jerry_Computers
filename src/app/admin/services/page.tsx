import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { ServicesManager } from "@/components/admin/ServicesManager";
import type { ServiceId } from "@/data/services";
import { requireStaff } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";

export const metadata: Metadata = { title: "Services" };

export default function AdminServicesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Services />
    </Suspense>
  );
}

async function Services() {
  await requireStaff(["admin"]);
  const rows = await db.select().from(schema.services).orderBy(asc(schema.services.sortOrder), asc(schema.services.title));
  return (
    <>
      <PageHeader title="Services" count={rows.length} description="What the homepage, menus and service pages list. Order here is the order on the site." />
      <ServicesManager
        services={rows.map((r) => ({
          id: r.id,
          label: r.label,
          title: r.title,
          slug: r.slug,
          description: r.description,
          includes: r.includes,
          visual: r.visual as ServiceId,
          isActive: r.isActive,
        }))}
      />
    </>
  );
}
