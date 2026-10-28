import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { NotificationList } from "@/components/admin/NotificationList";
import { Pagination, pageParam } from "@/components/admin/ui";
import { markMyNotificationsReadAction } from "@/lib/actions/profile";
import { requireStaff } from "@/lib/server/auth";
import { listNotifications } from "@/lib/server/notifications";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage({ searchParams }: PageProps<"/engineer/notifications">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Notifications searchParams={searchParams} />
    </Suspense>
  );
}

async function Notifications({ searchParams }: Pick<PageProps<"/engineer/notifications">, "searchParams">) {
  const me = await requireStaff(["engineer"]);
  const page = pageParam((await searchParams).page);
  const { rows, total, unread, pageSize } = await listNotifications(me.id, { page });
  return (
    <>
      <PageHeader title="Notifications" count={unread || undefined} description="In-app only: new jobs, jobs moved or cancelled, schedule changes and transfer decisions." />
      <NotificationList items={rows} unread={unread} markRead={markMyNotificationsReadAction} />
      <Pagination page={page} pageSize={pageSize} total={total} params={{}} path="/engineer/notifications" />
    </>
  );
}
