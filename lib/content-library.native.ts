import * as SQLite from "expo-sqlite";

import { matchesNormalized } from "@/shared/darija";
import type {
  ContentLibraryItem,
  ContentStatus,
  ContentTheme,
  NewContentLibraryItem,
  UserDelayPreference,
} from "@/shared/content-library";

const DATABASE_NAME = "dhikra-content.db";
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDatabase() {
  databasePromise ??= SQLite.openDatabaseAsync(DATABASE_NAME);
  return databasePromise;
}

function createSeedItem(): ContentLibraryItem {
  const now = new Date().toISOString();
  return {
    id: 1,
    userId: "local-user",
    sourceType: "seed",
    sourceUri: null,
    title: "بداية ذِكرى",
    rawText: "هنا غادي تجمع الصور، الروابط، الاقتباسات والمواعيد اللي باغي ترجع ليهم فـ الوقت المناسب.",
    ocrText: null,
    imageContextTags: ["welcome", "memory"],
    theme: "productivity",
    capturedAt: now,
    status: "captured",
    userDelayPref: "decide_for_me",
    scheduledFor: null,
    revisitCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export async function initializeContentLibrary() {
  const db = await getDatabase();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS content_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL DEFAULT 'local-user',
      source_type TEXT NOT NULL,
      source_uri TEXT,
      title TEXT,
      raw_text TEXT,
      ocr_text TEXT,
      image_context_tags TEXT NOT NULL DEFAULT '[]',
      theme TEXT NOT NULL DEFAULT 'other',
      captured_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'captured',
      user_delay_pref TEXT NOT NULL DEFAULT 'decide_for_me',
      scheduled_for TEXT,
      revisit_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_content_library_status_schedule ON content_library(status, scheduled_for);
    CREATE INDEX IF NOT EXISTS idx_content_library_theme ON content_library(theme);
  `);
  // Migration: attach the scheduled native notification id to an item.
  const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(content_library)");
  if (!columns.some((column) => column.name === "notification_id")) {
    await db.execAsync("ALTER TABLE content_library ADD COLUMN notification_id TEXT");
  }
  const result = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM content_library");
  if ((result?.count ?? 0) === 0) {
    const item = createSeedItem();
    await db.runAsync(
      `INSERT INTO content_library
        (user_id, source_type, source_uri, title, raw_text, ocr_text, image_context_tags,
         theme, captured_at, status, user_delay_pref, scheduled_for, revisit_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.userId, item.sourceType, item.sourceUri, item.title, item.rawText, item.ocrText,
      JSON.stringify(item.imageContextTags), item.theme, item.capturedAt, item.status,
      item.userDelayPref, item.scheduledFor, item.revisitCount, item.createdAt, item.updatedAt,
    );
  }
}

function mapRow(row: Record<string, unknown>): ContentLibraryItem {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    sourceType: String(row.source_type),
    sourceUri: row.source_uri ? String(row.source_uri) : null,
    title: row.title ? String(row.title) : null,
    rawText: row.raw_text ? String(row.raw_text) : null,
    ocrText: row.ocr_text ? String(row.ocr_text) : null,
    imageContextTags: JSON.parse(String(row.image_context_tags || "[]")) as string[],
    theme: String(row.theme) as ContentTheme,
    capturedAt: String(row.captured_at),
    status: String(row.status) as ContentStatus,
    userDelayPref: String(row.user_delay_pref) as UserDelayPreference,
    scheduledFor: row.scheduled_for ? String(row.scheduled_for) : null,
    notificationId: row.notification_id ? String(row.notification_id) : null,
    revisitCount: Number(row.revisit_count || 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listContentLibrary(query = "") {
  const db = await getDatabase();
  const normalized = query.trim();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM content_library ORDER BY captured_at DESC",
  );
  if (!normalized) return rows.map(mapRow);
  // Arabic/Darija spelling varies too much for SQL LIKE, so filter in JS
  // after normalizing both sides (library sizes are personal-scale).
  return rows
    .map(mapRow)
    .filter((item) =>
      [item.title, item.rawText, item.ocrText, item.theme]
        .filter(Boolean)
        .some((value) => matchesNormalized(String(value), normalized)),
    );
}

export async function insertContentLibraryItem(input: NewContentLibraryItem) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO content_library
      (user_id, source_type, source_uri, title, raw_text, ocr_text, image_context_tags,
       theme, captured_at, status, user_delay_pref, scheduled_for, notification_id,
       revisit_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.userId, input.sourceType, input.sourceUri, input.title, input.rawText, input.ocrText,
    JSON.stringify(input.imageContextTags), input.theme, input.capturedAt, input.status,
    input.userDelayPref, input.scheduledFor, input.notificationId ?? null,
    input.revisitCount ?? 0, now, now,
  );
  return Number(result.lastInsertRowId);
}

export async function markContentRevisited(id: number) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE content_library SET status = 'revisited', revisit_count = revisit_count + 1, updated_at = ? WHERE id = ?",
    new Date().toISOString(), id,
  );
}

export async function updateContentStatus(id: number, status: ContentStatus) {
  const db = await getDatabase();
  await db.runAsync("UPDATE content_library SET status = ?, updated_at = ? WHERE id = ?", status, new Date().toISOString(), id);
}

export async function attachNotificationToItem(id: number, notificationId: string) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE content_library SET notification_id = ?, updated_at = ? WHERE id = ?",
    notificationId, new Date().toISOString(), id,
  );
}

export async function updateContentSchedule(id: number, scheduledFor: string) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE content_library SET scheduled_for = ?, updated_at = ? WHERE id = ?",
    scheduledFor, new Date().toISOString(), id,
  );
}

export async function countContentLibrary() {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM content_library");
  return Number(result?.count ?? 0);
}
