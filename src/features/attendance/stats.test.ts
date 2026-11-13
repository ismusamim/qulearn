import { describe, expect, it } from "vitest";

import { attendanceRate, countStatuses, emptyCounts, formatRate, summarizeByMonth, totalMarks } from "./stats";

describe("countStatuses", () => {
  it("tallies each status and skips missing marks", () => {
    const counts = countStatuses(["PRESENT", "PRESENT", null, "LATE", undefined, "ABSENT"]);
    expect(counts).toEqual({ PRESENT: 2, LATE: 1, EXCUSED: 0, ABSENT: 1 });
    expect(totalMarks(counts)).toBe(4);
  });
});

describe("attendanceRate", () => {
  it("is null when nothing is recorded", () => {
    expect(attendanceRate(emptyCounts())).toBeNull();
    expect(formatRate(null)).toBe("—");
  });
  it("counts late as attended, excused and absent as not", () => {
    expect(attendanceRate({ PRESENT: 2, LATE: 1, EXCUSED: 1, ABSENT: 0 })).toBe(75);
    expect(attendanceRate({ PRESENT: 0, LATE: 0, EXCUSED: 2, ABSENT: 1 })).toBe(0);
  });
  it("rounds to a whole percentage", () => {
    expect(attendanceRate({ PRESENT: 2, LATE: 0, EXCUSED: 0, ABSENT: 1 })).toBe(67);
    expect(formatRate(67)).toBe("67%");
  });
});

describe("summarizeByMonth", () => {
  it("groups by month, newest first", () => {
    const months = summarizeByMonth([
      { date: "2026-01-31", status: "PRESENT" },
      { date: "2026-02-01", status: "ABSENT" },
      { date: "2026-02-03", status: "LATE" },
      { date: "2025-12-30", status: "EXCUSED" },
    ]);
    expect(months.map((m) => [m.year, m.month, m.total, m.rate])).toEqual([
      [2026, 2, 2, 50],
      [2026, 1, 1, 100],
      [2025, 12, 1, 0],
    ]);
    expect(months[0].counts).toEqual({ PRESENT: 0, LATE: 1, EXCUSED: 0, ABSENT: 1 });
  });
  it("returns nothing for an empty log", () => {
    expect(summarizeByMonth([])).toEqual([]);
  });
});
