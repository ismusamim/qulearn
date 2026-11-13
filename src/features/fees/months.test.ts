import { describe, expect, it } from "vitest";

import { currentYearMonth, monthKey, monthLabel, monthOptions, monthOptionsWith, parseMonthKey, shiftMonth } from "./months";

describe("months", () => {
  it("reads the current month from an ISO date", () => {
    expect(currentYearMonth("2026-11-13")).toEqual({ year: 2026, month: 11 });
  });

  it("shifts across year boundaries in both directions", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 3 }, -15)).toEqual({ year: 2024, month: 12 });
    expect(shiftMonth({ year: 2026, month: 3 }, 0)).toEqual({ year: 2026, month: 3 });
  });

  it("lists the last six months up to next month, like the legacy teacher page", () => {
    const options = monthOptions({ year: 2026, month: 2 }, -6, 1);
    expect(options).toHaveLength(8);
    expect(options[0]).toEqual({ year: 2025, month: 8 });
    expect(options[6]).toEqual({ year: 2026, month: 2 });
    expect(options[7]).toEqual({ year: 2026, month: 3 });
  });

  it("round-trips month keys and rejects malformed ones", () => {
    const fallback = { year: 2026, month: 11 };
    expect(parseMonthKey(monthKey({ year: 2025, month: 4 }), fallback)).toEqual({ year: 2025, month: 4 });
    expect(parseMonthKey("2025-13", fallback)).toEqual(fallback);
    expect(parseMonthKey("abc", fallback)).toEqual(fallback);
    expect(parseMonthKey(undefined, fallback)).toEqual(fallback);
  });

  it("keeps an out-of-range selected month in the dropdown", () => {
    const base = { year: 2026, month: 11 };
    expect(monthOptionsWith({ year: 2020, month: 1 }, base, -1, 1)[0]).toEqual({ year: 2020, month: 1 });
    expect(monthOptionsWith(base, base, -1, 1)).toHaveLength(3);
  });

  it("labels a month in Arabic", () => {
    expect(monthLabel({ year: 2026, month: 3 })).toBe("مارس 2026");
  });
});
