import { describe, expect, it } from "vitest";

import { scheduleDhikraReminder } from "../lib/reminders";

describe("Dhikra reminder scheduling contract", () => {
  it("rejects dates in the past", async () => {
    await expect(
      scheduleDhikraReminder({ title: "test", body: "test", dateIso: "2020-01-01T10:00:00.000Z" }),
    ).rejects.toThrow("future");
  });

  it("accepts a future date in the web-safe scheduler", async () => {
    const result = await scheduleDhikraReminder({
      title: "test",
      body: "test",
      dateIso: "2099-01-01T10:00:00.000Z",
    });
    expect(result).toContain("web-preview");
  });
});
