import { describe, expect, it } from "vitest";

import { ADHKAR, TASBIH_PHRASES, type DhikrEntry } from "../shared/adhkar";

describe("Dhikra adhkar content contract", () => {
  it("has unique ids and valid periods", () => {
    const ids = ADHKAR.map((entry: DhikrEntry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of ADHKAR) {
      expect(["morning", "evening"]).toContain(entry.period);
    }
  });

  it("has Arabic text and positive counts everywhere", () => {
    for (const entry of ADHKAR) {
      expect(entry.text.trim().length).toBeGreaterThan(5);
      expect(entry.count).toBeGreaterThan(0);
    }
  });

  it("covers both morning and evening", () => {
    const periods = new Set(ADHKAR.map((entry: DhikrEntry) => entry.period));
    expect(periods).toEqual(new Set(["morning", "evening"]));
  });

  it("offers a tasbih set with valid targets", () => {
    expect(TASBIH_PHRASES.length).toBeGreaterThanOrEqual(6);
    const keys = TASBIH_PHRASES.map((phrase) => phrase.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const phrase of TASBIH_PHRASES) {
      expect(phrase.label.trim().length).toBeGreaterThan(3);
      expect(phrase.target).toBeGreaterThan(0);
    }
  });
});
