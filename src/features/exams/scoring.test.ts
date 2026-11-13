import { describe, expect, it } from "vitest";

import { DEFAULT_MARKING, type MarkingSettings, gradeOf, markExam, markingSettingsError, questionScore } from "./scoring";

describe("questionScore", () => {
  it("deducts per mistake, prompt and tajweed mistake", () => {
    expect(questionScore({})).toBe(10);
    expect(questionScore({ mistakes: 2 })).toBe(8);
    expect(questionScore({ prompts: 3 })).toBe(8.5);
    expect(questionScore({ tajweedMistakes: 3 })).toBe(9.25);
    expect(questionScore({ mistakes: 1, prompts: 1, tajweedMistakes: 1 })).toBe(8.25);
  });

  it("never goes below zero and ignores unset or negative counts", () => {
    expect(questionScore({ mistakes: 50 })).toBe(0);
    expect(questionScore({ mistakes: -4, prompts: null, tajweedMistakes: undefined })).toBe(10);
    expect(questionScore({ mistakes: Number.NaN })).toBe(10);
  });

  it("uses the admin's settings and rounds to two decimals", () => {
    const s: MarkingSettings = { ...DEFAULT_MARKING, questionScore: 25, mistakePenalty: 2.5, promptPenalty: 0.333, tajweedPenalty: 0.1 };
    expect(questionScore({ mistakes: 2, prompts: 1, tajweedMistakes: 3 }, s)).toBe(19.37);
  });
});

describe("gradeOf", () => {
  it("uses inclusive lower bounds", () => {
    expect(gradeOf(100)).toBe("ممتاز");
    expect(gradeOf(90)).toBe("ممتاز");
    expect(gradeOf(89.99)).toBe("جيد جدًا");
    expect(gradeOf(80)).toBe("جيد جدًا");
    expect(gradeOf(65)).toBe("جيد");
    expect(gradeOf(64.9)).toBe("مقبول");
    expect(gradeOf(50)).toBe("مقبول");
    expect(gradeOf(49.9)).toBe("ضعيف");
    expect(gradeOf(0)).toBe("ضعيف");
  });

  it("follows custom boundaries", () => {
    const s = { ...DEFAULT_MARKING, excellentFrom: 95, veryGoodFrom: 85, goodFrom: 75, passFrom: 60 };
    expect(gradeOf(90, s)).toBe("جيد جدًا");
    expect(gradeOf(59, s)).toBe("ضعيف");
  });
});

describe("markExam", () => {
  it("computes scores, total, maximum and grade", () => {
    const result = markExam([{ mistakes: 1 }, { prompts: 2 }, { tajweedMistakes: 1 }, {}]);
    expect(result.scores).toEqual([9, 9, 9.75, 10]);
    expect(result.total).toBe(37.75);
    expect(result.maxScore).toBe(40);
    expect(result.percent).toBeCloseTo(94.375);
    expect(result.grade).toBe("ممتاز");
  });

  it("grades a weak exam", () => {
    const result = markExam([{ mistakes: 6 }, { mistakes: 7 }]);
    expect(result.total).toBe(7);
    expect(result.maxScore).toBe(20);
    expect(result.grade).toBe("ضعيف");
  });

  it("handles an empty exam", () => {
    expect(markExam([])).toEqual({ scores: [], total: 0, maxScore: 0, percent: 0, grade: "ضعيف" });
  });
});

describe("markingSettingsError", () => {
  it("accepts the defaults", () => {
    expect(markingSettingsError(DEFAULT_MARKING)).toBeNull();
  });

  it("rejects a non-positive question score and negative penalties", () => {
    expect(markingSettingsError({ ...DEFAULT_MARKING, questionScore: 0 })).toBe("درجة السؤال أكبر من صفر");
    expect(markingSettingsError({ ...DEFAULT_MARKING, promptPenalty: -1 })).toBe("قيم الخصم لا تكون سالبة");
  });

  it("requires strictly descending grade boundaries within 0–100", () => {
    expect(markingSettingsError({ ...DEFAULT_MARKING, veryGoodFrom: 90 })).not.toBeNull();
    expect(markingSettingsError({ ...DEFAULT_MARKING, excellentFrom: 101 })).not.toBeNull();
    expect(markingSettingsError({ ...DEFAULT_MARKING, passFrom: -1 })).not.toBeNull();
    expect(markingSettingsError({ ...DEFAULT_MARKING, passFrom: 0 })).toBeNull();
  });
});
