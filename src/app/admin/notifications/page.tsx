import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { NotificationList } from "@/components/admin/NotificationList";
import { pageParam, Pagination } from "@/components/admin/ui";
import { markAdminNotificationsReadAction } from "@/app/admin/service-requests/actions";
import { listNotifications } from "@/lib/server/notifications";
import { requirePermission } from "@/lib/server/permissions";

export const metadata: Metadata = { title: "Notifications" };

export default function AdminNotificationsPage({ searchParams }: PageProps<"/admin/notifications">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Notifications searchParams={searchParams} />
    </Suspense>
  );
}

async function Notifications({ searchParams }: Pick<PageProps<"/admin/notifications">, "searchParams">) {
  const admin = await requirePermission("service.manage");
  const page = pageParam((await searchParams).page);
  const { rows, total, unread, pageSize } = await listNotifications(admin.id, { page });
  return (
    <>
      <PageHeader title="Notifications" count={unread || undefined} description="In-app only: engineer transfer requests and jobs handed back as unable to complete." />
      <NotificationList items={rows} unread={unread} markRead={markAdminNotificationsReadAction} />
      <Pagination page={page} pageSize={pageSize} total={total} params={{}} path="/admin/notifications" />
    </>
  );
}
