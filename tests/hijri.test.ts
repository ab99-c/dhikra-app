import { describe, expect, it } from "vitest";

import { formatHijri, gregorianToHijriTabular, hijriDate, HIJRI_MONTHS } from "../shared/hijri";

describe("Dhikra Hijri date helpers", () => {
  it("uses the accurate Intl Umm al-Qura calendar when available", () => {
    // 11 March 2024 = 1 Ramadan 1445 (Umm al-Qura).
    const date = hijriDate(new Date(2024, 2, 11));
    expect(date).toEqual({ year: 1445, month: 9, day: 1 });
  });

  it("falls back to a deterministic tabular approximation", () => {
    // Regression anchors for the pure-JS Kuwaiti tabular algorithm.
    expect(gregorianToHijriTabular(new Date(2023, 6, 19))).toEqual({ year: 1445, month: 1, day: 3 });
    expect(gregorianToHijriTabular(new Date(2024, 2, 11))).toEqual({ year: 1445, month: 9, day: 2 });
  });

  it("produces structurally valid dates across a whole year", () => {
    for (let day = 0; day < 366; day++) {
      const date = new Date(2026, 0, 1 + day);
      const hijri = gregorianToHijriTabular(date);
      expect(hijri.month).toBeGreaterThanOrEqual(1);
      expect(hijri.month).toBeLessThanOrEqual(12);
      expect(hijri.day).toBeGreaterThanOrEqual(1);
      expect(hijri.day).toBeLessThanOrEqual(30);
      expect(hijri.year).toBeGreaterThanOrEqual(1400);
    }
  });

  it("formats hijri dates with Arabic month names", () => {
    expect(formatHijri({ year: 1445, month: 9, day: 1 })).toContain("رمضان");
    expect(HIJRI_MONTHS).toHaveLength(12);
  });
});
