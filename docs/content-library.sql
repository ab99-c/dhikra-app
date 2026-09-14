-- Dhikra Task 1: on-device content library schema
-- The same columns are mirrored in drizzle/schema.ts for a future sync backend.

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

CREATE INDEX IF NOT EXISTS idx_content_library_status_schedule
  ON content_library(status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_content_library_theme
  ON content_library(theme);
