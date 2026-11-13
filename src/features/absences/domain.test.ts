import { describe, expect, it } from "vitest";

import { defaultPayMonth, summarizeByTeacher } from "./domain";

describe("defaultPayMonth", () => {
  it("is the latest open payroll month", () => {
    const open = [
      { year: 2025, month: 12 },
      { year: 2026, month: 2 },
      { year: 2026, month: 1 },
    ];
    expect(defaultPayMonth(open, "2026-03-04")).toEqual({ year: 2026, month: 2 });
  });

  it("falls back to the month of the absence", () => {
    expect(defaultPayMonth([], "2025-12-31")).toEqual({ year: 2025, month: 12 });
    expect(defaultPayMonth([], "2026-01-01")).toEqual({ year: 2026, month: 1 });
  });
});

describe("summarizeByTeacher", () => {
  it("counts days per teacher and orders by most absent", () => {
    const s = summarizeByTeacher([
      { employeeId: "a", name: "أحمد", permission: "WITH_PERMISSION" },
      { employeeId: "b", name: "بكر", permission: "WITHOUT_PERMISSION" },
      { employeeId: "b", name: "بكر", permission: "WITH_PERMISSION" },
      { employeeId: "b", name: "بكر", permission: null },
    ]);
    expect(s).toEqual([
      { employeeId: "b", name: "بكر", days: 3, withPermission: 1, withoutPermission: 1 },
      { employeeId: "a", name: "أحمد", days: 1, withPermission: 1, withoutPermission: 0 },
    ]);
  });
});
