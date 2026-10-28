import "server-only";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { randomToken, sha256 } from "./crypto";
import { db, schema } from "./db";

const TTL = { invite: 72 * 60 * 60 * 1000, reset: 60 * 60 * 1000 } as const;
type Purpose = keyof typeof TTL;

/** Issues a one-time link token, closing any earlier unused ones for the same purpose. Returns the raw token for the link. */
export async function issuePasswordToken(userId: string, purpose: Purpose) {
  const token = randomToken(32);
  await db.transaction(async (tx) => {
    await tx
      .update(schema.passwordTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(schema.passwordTokens.userId, userId), eq(schema.passwordTokens.purpose, purpose), isNull(schema.passwordTokens.usedAt)));
    await tx.insert(schema.passwordTokens).values({ userId, purpose, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TTL[purpose]) });
  });
  return token;
}

export async function recentResetCount(userId: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.passwordTokens)
    .where(and(eq(schema.passwordTokens.userId, userId), eq(schema.passwordTokens.purpose, "reset"), gt(schema.passwordTokens.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
  return n;
}

/** The account a still-valid token belongs to, without using it up. */
export async function peekPasswordToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [row] = await db
    .select({ token: schema.passwordTokens, user: schema.users })
    .from(schema.passwordTokens)
    .innerJoin(schema.users, eq(schema.users.id, schema.passwordTokens.userId))
    .where(and(eq(schema.passwordTokens.tokenHash, sha256(token)), isNull(schema.passwordTokens.usedAt), gt(schema.passwordTokens.expiresAt, new Date())));
  if (!row || row.user.disabledAt) return null;
  return row;
}

/** Uses the token up. Returns the row, or null when it was already used or expired. */
export async function consumePasswordToken(token: string) {
  const found = await peekPasswordToken(token);
  if (!found) return null;
  const [used] = await db
    .update(schema.passwordTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.passwordTokens.id, found.token.id), isNull(schema.passwordTokens.usedAt)))
    .returning({ id: schema.passwordTokens.id });
  return used ? found : null;
}
