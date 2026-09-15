import { describe, expect, it } from "vitest";

import { parseImageAnalysis } from "../server/_core/imageAnalysis";

describe("Dhikra image analysis contract", () => {
  it("parses a full structured vision response", () => {
    const analysis = parseImageAnalysis(
      JSON.stringify({
        title: "حديث عن الصبر",
        ocrText: "قال رسول الله ﷺ: ...",
        contentType: "hadith",
        theme: "spirituality",
        tags: ["حديث", "صبر"],
        suggestedDelay: "1_week",
        confidence: 0.91,
      }),
    );
    expect(analysis.title).toBe("حديث عن الصبر");
    expect(analysis.contentType).toBe("hadith");
    expect(analysis.theme).toBe("spirituality");
    expect(analysis.tags).toEqual(["حديث", "صبر"]);
    expect(analysis.suggestedDelay).toBe("1_week");
    expect(analysis.confidence).toBe(0.91);
  });

  it("falls back safely on invalid theme/delay values", () => {
    const analysis = parseImageAnalysis(
      JSON.stringify({ title: "x", ocrText: "y", contentType: "post", theme: "nope", tags: [1, "a"], suggestedDelay: "nope", confidence: 2 }),
    );
    expect(analysis.theme).toBe("other");
    expect(analysis.suggestedDelay).toBe("decide_for_me");
    expect(analysis.tags).toEqual(["a"]);
    expect(analysis.confidence).toBe(1);
  });

  it("keeps raw text on malformed JSON", () => {
    const analysis = parseImageAnalysis("not-json-at-all");
    expect(analysis.ocrText).toBe("not-json-at-all");
    expect(analysis.contentType).toBe("other");
    expect(analysis.confidence).toBe(0);
  });
});
