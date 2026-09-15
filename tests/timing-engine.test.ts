import { describe, expect, it } from "vitest";

import type { ContentLibraryItem } from "../shared/content-library";
import {
  DELAY_PRESETS_MS,
  medianGapMs,
  modeCaptureHour,
  modeDelayPrefMs,
  planNextReminder,
} from "../shared/timing-engine";

function item(overrides: Partial<ContentLibraryItem>): ContentLibraryItem {
  const now = Date.now();
  return {
    id: 1,
    userId: "local-user",
    sourceType: "manual_note",
    sourceUri: null,
    title: "x",
    rawText: "x",
    ocrText: null,
    imageContextTags: [],
    theme: "other",
    capturedAt: new Date(now).toISOString(),
    status: "captured",
    userDelayPref: "decide_for_me",
    scheduledFor: null,
    revisitCount: 0,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    ...overrides,
  };
}

describe("Dhikra timing engine", () => {
  it("defaults to 3 days with no history", () => {
    const plan = planNextReminder([], new Date("2026-09-15T10:00:00Z"));
    expect(plan.delayMs).toBe(DELAY_PRESETS_MS["3_days"]);
    expect(plan.preferredHour).toBeNull();
  });

  it("follows the most common explicit delay preference", () => {
    const items = [
      item({ id: 2, userDelayPref: "1_week" }),
      item({ id: 3, userDelayPref: "1_week" }),
      item({ id: 4, userDelayPref: "tomorrow" }),
    ];
    const plan = planNextReminder(items, new Date("2026-09-15T10:00:00Z"));
    expect(plan.delayMs).toBe(DELAY_PRESETS_MS["1_week"]);
  });

  it("uses median revisit gap when enough revisited items exist", () => {
    const base = new Date("2026-09-01T10:00:00Z").getTime();
    const items = [
      item({ id: 2, capturedAt: new Date(base).toISOString(), updatedAt: new Date(base + 2 * 86400000).toISOString(), revisitCount: 1 }),
      item({ id: 3, capturedAt: new Date(base).toISOString(), updatedAt: new Date(base + 4 * 86400000).toISOString(), revisitCount: 1 }),
      item({ id: 4, capturedAt: new Date(base).toISOString(), updatedAt: new Date(base + 6 * 86400000).toISOString(), revisitCount: 1 }),
    ];
    expect(medianGapMs(items)).toBe(4 * 86400000);
    const plan = planNextReminder(items, new Date("2026-09-15T10:00:00Z"));
    expect(plan.delayMs).toBe(4 * 86400000);
  });

  it("clamps extreme gaps to sane bounds", () => {
    const base = new Date("2026-09-01T10:00:00Z").getTime();
    const items = [
      item({ id: 2, capturedAt: new Date(base).toISOString(), updatedAt: new Date(base + 60 * 86400000).toISOString(), revisitCount: 1 }),
      item({ id: 3, capturedAt: new Date(base).toISOString(), updatedAt: new Date(base + 61 * 86400000).toISOString(), revisitCount: 1 }),
      item({ id: 4, capturedAt: new Date(base).toISOString(), updatedAt: new Date(base + 62 * 86400000).toISOString(), revisitCount: 1 }),
    ];
    const plan = planNextReminder(items, new Date("2026-09-15T10:00:00Z"));
    expect(plan.delayMs).toBe(14 * 86400000);
  });

  it("picks the most common capture hour bucket", () => {
    // Local-time construction keeps the expected bucket tz-independent.
    const items = [
      item({ id: 2, capturedAt: new Date(2026, 8, 10, 8, 30).toISOString() }),
      item({ id: 3, capturedAt: new Date(2026, 8, 11, 9, 15).toISOString() }),
      item({ id: 4, capturedAt: new Date(2026, 8, 12, 20, 0).toISOString() }),
    ];
    expect(modeCaptureHour(items)).toBe(8);
  });

  it("schedules at the preferred hour and a future ISO date", () => {
    const plan = planNextReminder([], new Date("2026-09-15T10:00:00Z"));
    expect(new Date(plan.scheduledForIso).getTime()).toBeGreaterThan(new Date("2026-09-15T10:00:00Z").getTime());
    expect(plan.reason.length).toBeGreaterThan(0);
    expect(modeDelayPrefMs([item({ userDelayPref: "1_week" }), item({ userDelayPref: "1_week" })])).toBe(DELAY_PRESETS_MS["1_week"]);
  });
});
