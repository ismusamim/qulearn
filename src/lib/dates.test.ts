import { describe, expect, it } from "vitest";

import { ageFromBirthDate, formatTime12, fromISODate, isISODate, toISODate, todayISO, weekdayName } from "./dates";

describe("dates", () => {
  it("takes today from the organisation's timezone, not UTC", () => {
    // 22:30 UTC is already the next day in Cairo (UTC+2 / +3).
    expect(todayISO(new Date("2026-01-10T22:30:00Z"))).toBe("2026-01-11");
    expect(todayISO(new Date("2026-01-10T12:00:00Z"))).toBe("2026-01-10");
  });

  it("round-trips ISO dates through UTC midnight", () => {
    expect(toISODate(fromISODate("2026-03-05"))).toBe("2026-03-05");
    expect(toISODate(null)).toBeNull();
  });

  it("validates ISO dates", () => {
    expect(isISODate("2026-02-28")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("28/02/2026")).toBe(false);
  });

  it("formats times and weekdays in Arabic", () => {
    expect(formatTime12("16:05")).toBe("4:05 م");
    expect(formatTime12("00:30")).toBe("12:30 ص");
    expect(weekdayName("2026-11-13")).toBe("الجمعة");
  });

  it("computes whole years of age", () => {
    expect(ageFromBirthDate("2015-06-10", "2026-06-09")).toBe(10);
    expect(ageFromBirthDate("2015-06-10", "2026-06-10")).toBe(11);
    expect(ageFromBirthDate("2030-01-01", "2026-06-10")).toBeNull();
  });
});
