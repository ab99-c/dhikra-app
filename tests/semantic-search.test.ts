import { describe, expect, it } from "vitest";

import { contentSearchText, cosineSimilarity, createLocalEmbedding } from "../shared/semantic-search";

describe("Dhikra local semantic search", () => {
  it("creates stable normalized vectors without network calls", () => {
    const first = createLocalEmbedding("الصبر والنية");
    const second = createLocalEmbedding("الصبر والنية");
    expect(first).toHaveLength(128);
    expect(first).toEqual(second);
    expect(cosineSimilarity(first, second)).toBeCloseTo(1);
  });

  it("ranks related text higher than unrelated text", () => {
    const query = createLocalEmbedding("الصبر والنية");
    const related = createLocalEmbedding("الصبر وحسن النية في الحياة");
    const unrelated = createLocalEmbedding("وصفة كسكس بالخضر");
    expect(cosineSimilarity(query, related)).toBeGreaterThan(cosineSimilarity(query, unrelated));
  });

  it("combines searchable fields into one local document", () => {
    expect(contentSearchText({ title: "حديث", rawText: "الصبر", imageContextTags: ["روحانيات"], theme: "spirituality" })).toContain("الصبر");
  });
});
