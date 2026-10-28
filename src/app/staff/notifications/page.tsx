import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { NotificationList } from "@/components/admin/NotificationList";
import { pageParam, Pagination } from "@/components/admin/ui";
import { markMyNotificationsReadAction } from "@/lib/actions/profile";
import { listNotifications } from "@/lib/server/notifications";
import { requireStaff } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Notifications" };

export default function StaffNotificationsPage({ searchParams }: PageProps<"/staff/notifications">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Notifications searchParams={searchParams} />
    </Suspense>
  );
}

async function Notifications({ searchParams }: Pick<PageProps<"/staff/notifications">, "searchParams">) {
  const me = await requireStaff(["ecommerce_staff"], "/staff/notifications");
  const page = pageParam((await searchParams).page);
  const { rows, total, unread, pageSize } = await listNotifications(me.id, { page });
  return (
    <>
      <PageHeader title="Notifications" count={unread || undefined} description="In-app only: a note for each new order placed in the store." />
      <NotificationList items={rows} unread={unread} markRead={markMyNotificationsReadAction} />
      <Pagination page={page} pageSize={pageSize} total={total} params={{}} path="/staff/notifications" />
    </>
  );
}
