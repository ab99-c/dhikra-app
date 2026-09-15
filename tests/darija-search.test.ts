import { describe, expect, it } from "vitest";

import { matchesNormalized, normalizeArabicText } from "../shared/darija";

describe("Darija search normalization", () => {
  it("unifies alef variants", () => {
    expect(normalizeArabicText("الإله")).toBe("الاله");
    expect(normalizeArabicText("أحد")).toBe("احد");
    expect(normalizeArabicText("آخر")).toBe("اخر");
  });

  it("unifies ta marbuta and heh", () => {
    expect(normalizeArabicText("مكتبة")).toBe("مكتبه");
  });

  it("unifies alef maksura and yeh", () => {
    expect(normalizeArabicText("على")).toBe("علي");
  });

  it("strips tashkeel and tatweel", () => {
    expect(normalizeArabicText("ذِكْرى")).toBe("ذكري");
    expect(normalizeArabicText("الــــسلام")).toBe("السلام");
  });

  it("drops hamza", () => {
    expect(normalizeArabicText("شيء")).toBe("شي");
    expect(normalizeArabicText("مسؤول")).toBe("مسوول");
  });

  it("matches across common Darija typing variants", () => {
    expect(matchesNormalized("الجنة", "الجنه")).toBe(true);
    expect(matchesNormalized("صورة الإله ديال العيد", "الاله")).toBe(true);
    expect(matchesNormalized("ذِكْرى جميلة", "ذكرى")).toBe(true);
    expect(matchesNormalized("موعد الطبيب", "طبيب")).toBe(true);
    expect(matchesNormalized("وصفة الكسكس", "كسكس")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(matchesNormalized("وصفة الكسكس", "سيارة")).toBe(false);
  });

  it("keeps latin search case-insensitive", () => {
    expect(matchesNormalized("HTTPS://Example.com", "example")).toBe(true);
  });
});
