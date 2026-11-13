import { describe, expect, it } from "vitest";

import { normalizeArabic } from "@/lib/arabic";

import { feeState, remainingOf, startsWithWord, summarizeFees } from "./summary";

describe("feeState", () => {
  it("classifies a student for the month", () => {
    expect(feeState(100, 100, false)).toBe("PAID");
    expect(feeState(100, 120, false)).toBe("PAID");
    expect(feeState(100, 40, false)).toBe("PARTIAL");
    expect(feeState(100, 0, false)).toBe("UNPAID");
    expect(feeState(0, 0, false)).toBe("EXEMPT");
    expect(feeState(null, 50, false)).toBe("PAID_NO_FEE");
    expect(feeState(null, 0, false)).toBe("NO_FEE");
    expect(feeState(100, 100, true)).toBe("DROPPED");
  });
});

describe("remainingOf", () => {
  it("never goes below zero and is zero without a due", () => {
    expect(remainingOf(100, 30)).toBe(70);
    expect(remainingOf(100, 130)).toBe(0);
    expect(remainingOf(null, 30)).toBe(0);
    expect(remainingOf(0, 0)).toBe(0);
    expect(remainingOf(100.5, 0.25)).toBe(100.25);
  });
});

describe("summarizeFees", () => {
  it("totals the month like the legacy stats", () => {
    const s = summarizeFees([
      { due: 100, paid: 100, dropped: false },
      { due: 100, paid: 40, dropped: false },
      { due: 150, paid: 0, dropped: false },
      { due: 0, paid: 0, dropped: false },
      { due: null, paid: 20, dropped: false },
      { due: null, paid: 0, dropped: false },
      { due: 100, paid: 10, dropped: true },
    ]);
    expect(s).toEqual({
      collected: 170,
      expected: 350,
      outstanding: 210,
      paidCount: 2,
      partialCount: 1,
      unpaidCount: 1,
      exemptCount: 1,
      droppedCount: 1,
    });
  });

  it("is all zeros for no students", () => {
    expect(summarizeFees([])).toMatchObject({ collected: 0, expected: 0, outstanding: 0 });
  });
});

describe("startsWithWord", () => {
  it("matches the start of the text or of any word", () => {
    expect(startsWithWord("حلقة الشيخ أحمد", normalizeArabic("حلق"))).toBe(true);
    expect(startsWithWord("حلقة الشيخ أحمد", normalizeArabic("أحم"))).toBe(true);
    expect(startsWithWord("حلقة الشيخ أحمد", normalizeArabic("حمد"))).toBe(false);
    expect(startsWithWord(null, normalizeArabic("ا"))).toBe(false);
    expect(startsWithWord("أي شيء", "")).toBe(true);
  });
});
