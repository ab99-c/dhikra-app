import { describe, expect, it } from "vitest";

import { detectMoodFromText, DEFAULT_MOOD_MAPPING, rankItemsForMood } from "../shared/mood";

describe("Dhikra mood personalization", () => {
  it("detects Darija stress locally", () => {
    expect(detectMoodFromText("أنا مضغوط بزاف اليوم")).toBe("stressed");
  });

  it("falls back to neutral when no signal is present", () => {
    expect(detectMoodFromText("بغيت نقرا شي حاجة")).toBe("neutral");
  });

  it("puts mapped themes first without hiding other memories", () => {
    const items = [
      { id: 1, theme: "recipe", capturedAt: "2026-01-01" },
      { id: 2, theme: "spirituality", capturedAt: "2026-01-02" },
    ] as any;
    const ranked = rankItemsForMood(items, "stressed", DEFAULT_MOOD_MAPPING);
    expect(ranked.map((item) => item.id)).toEqual([2, 1]);
  });
});
