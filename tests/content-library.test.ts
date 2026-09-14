import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CONTENT_STATUSES,
  CONTENT_THEMES,
  USER_DELAY_OPTIONS,
  delayLabel,
  themeLabel,
} from "../shared/content-library";

describe("Dhikra content library contract", () => {
  it("keeps the shared taxonomy labels complete and unique", () => {
    expect(new Set(CONTENT_THEMES).size).toBe(CONTENT_THEMES.length);
    expect(new Set(CONTENT_STATUSES).size).toBe(CONTENT_STATUSES.length);
    expect(new Set(USER_DELAY_OPTIONS).size).toBe(USER_DELAY_OPTIONS.length);
    expect(Object.keys(themeLabel).sort()).toEqual([...CONTENT_THEMES].sort());
    expect(Object.keys(delayLabel).sort()).toEqual([...USER_DELAY_OPTIONS].sort());
  });

  it("contains every foundation field in the canonical SQLite schema", () => {
    const schema = readFileSync("docs/content-library.sql", "utf8");
    for (const field of [
      "user_id",
      "source_type",
      "raw_text",
      "ocr_text",
      "image_context_tags",
      "theme",
      "captured_at",
      "status",
      "user_delay_pref",
    ]) {
      expect(schema).toContain(field);
    }
    expect(schema).toContain("idx_content_library_status_schedule");
    expect(schema).toContain("idx_content_library_theme");
  });
});
