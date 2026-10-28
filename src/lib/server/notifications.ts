import "server-only";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "./db";
import type { Db } from "./admin/tx";

type Message = { kind: string; title: string; body?: string; href?: string | null };

/**
 * In-app notifications. Written in the same transaction as the change they describe, so a
 * notification exists only if the change happened. Nothing here sends email or push; a delivery
 * module can read unsent rows later.
 */
export async function notify(q: Db, userIds: (string | null | undefined)[], m: Message) {
  const ids = [...new Set(userIds.filter((x): x is string => Boolean(x)))];
  if (!ids.length) return;
  await q.insert(schema.notifications).values(ids.map((userId) => ({ userId, kind: m.kind, title: m.title, body: m.body ?? "", href: m.href ?? null })));
}

/** Every admin whose account is switched on. */
export async function notifyAdmins(q: Db, m: Message) {
  const admins = await q
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.role, "admin"), isNull(schema.users.disabledAt)));
  await notify(
    q,
    admins.map((a) => a.id),
    m,
  );
}

export async function listNotifications(userId: string, { page = 1, pageSize = 30 } = {}) {
  const [rows, [{ n }], [{ unread }]] = await Promise.all([
    db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(schema.notifications).where(eq(schema.notifications.userId, userId)),
    db
      .select({ unread: count() })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt))),
  ]);
  return { rows, total: n, unread, page, pageSize };
}

export async function unreadCount(userId: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.notifications)
    .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
  return n;
}

/** Marks the user's own notifications read (all of them, or the given ids). */
export async function markRead(userId: string, ids?: string[]) {
  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt), ids ? inArray(schema.notifications.id, ids) : undefined));
}
