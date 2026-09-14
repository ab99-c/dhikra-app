import { describe, expect, it } from "vitest";

import { ASSISTANT_INTENTS, type AssistantResponse } from "../shared/assistant";

describe("Dhikra assistant contract", () => {
  it("supports memory search, reminder, chat, and unknown intents", () => {
    expect(ASSISTANT_INTENTS).toEqual(["search_memory", "create_reminder", "general_chat", "unknown"]);
  });

  it("represents a date-aware reminder response without losing confidence or citations", () => {
    const response: AssistantResponse = {
      reply: "نقدر نذكرك نهار الاثنين مع 10 ديال الصباح.",
      intent: "create_reminder",
      dateIso: "2026-09-21T10:00:00+01:00",
      dateText: "الاثنين مع 10 ديال الصباح",
      reminderTitle: "مراجعة المقال",
      confidence: 0.92,
      memoryIds: [4, 8],
    };
    expect(response.intent).toBe("create_reminder");
    expect(new Date(response.dateIso || "").toISOString()).toContain("2026-09-21");
    expect(response.memoryIds).toEqual([4, 8]);
  });
});
