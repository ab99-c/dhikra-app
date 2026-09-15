import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

import { CONTENT_STATUSES, CONTENT_THEMES, USER_DELAY_OPTIONS } from "@/shared/content-library";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Cloud-sync mirror of the on-device SQLite content library. */
export const contentLibrary = mysqlTable("content_library", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  sourceType: varchar("sourceType", { length: 64 }).notNull(),
  sourceUri: text("sourceUri"),
  title: varchar("title", { length: 255 }),
  rawText: text("rawText"),
  ocrText: text("ocrText"),
  imageContextTags: json("imageContextTags").$type<string[]>().notNull(),
  theme: mysqlEnum("theme", CONTENT_THEMES).default("other").notNull(),
  capturedAt: timestamp("capturedAt").notNull(),
  status: mysqlEnum("status", CONTENT_STATUSES).default("captured").notNull(),
  userDelayPref: mysqlEnum("userDelayPref", USER_DELAY_OPTIONS).default("decide_for_me").notNull(),
  scheduledFor: timestamp("scheduledFor"),
  notificationId: text("notificationId"),
  revisitCount: int("revisitCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContentLibrary = typeof contentLibrary.$inferSelect;
export type InsertContentLibrary = typeof contentLibrary.$inferInsert;
