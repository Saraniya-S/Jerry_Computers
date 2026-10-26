import { sql } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["customer", "engineer", "ecommerce_staff", "admin"]);
export const otpPurpose = pgEnum("otp_purpose", ["register", "login"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: userRole("role").notNull().default("customer"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    /** Stored lower-cased; unique. */
    email: text("email").notNull(),
    phone: text("phone"),
    /** Null for accounts that only sign in with Google. */
    passwordHash: text("password_hash"),
    /** Google's stable account id, for customers who use Google sign-in. */
    googleSub: text("google_sub"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email), uniqueIndex("users_google_sub_key").on(t.googleSub).where(sql`${t.googleSub} is not null`)],
);

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the cookie token; the token itself is never stored. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

/** A one-time code emailed to finish registration or login. */
export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: otpPurpose("purpose").notNull(),
    /** HMAC of the code with AUTH_SECRET. */
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    sendCount: integer("send_count").notNull().default(1),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("otp_challenges_user_id_idx").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type UserRole = (typeof userRole.enumValues)[number];
export type OtpPurpose = (typeof otpPurpose.enumValues)[number];
