import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { ServiceRequestForm } from "@/components/admin/ServiceRequestForm";
import { requirePermission } from "@/lib/server/permissions";

export const metadata: Metadata = { title: "New service request" };

export default function NewServiceRequestPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewServiceRequest />
    </Suspense>
  );
}

async function NewServiceRequest() {
  await requirePermission("service.manage");
  return (
    <>
      <PageHeader
        title="New service request"
        description="For a customer at the counter, on the phone, or an existing account."
        actions={
          <Link href="/admin/service-requests" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden /> All requests
          </Link>
        }
      />
      <ServiceRequestForm />
    </>
  );
}
