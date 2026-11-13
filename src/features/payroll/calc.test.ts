import { describe, expect, it } from "vitest";

import {
  calcRow,
  latestMonth,
  leaveBalance,
  previousMonth,
  selectableYears,
  sumNet,
  summarizeYear,
  type PayrollRules,
} from "./calc";

const RULES: PayrollRules = {
  absenceWithPermission: 20,
  absenceNoPermission: 30,
  meetingWithPermission: 50,
  meetingNoPermission: 70,
  roundTo: 5,
};

describe("calcRow", () => {
  it("returns zeros for an empty row", () => {
    expect(calcRow({}, RULES)).toEqual({
      overtimeHours: 0,
      totalHours: 0,
      actualHours: 0,
      overtimeAmount: 0,
      deductions: 0,
      net: 0,
    });
  });

  it("pays basic + incentive + transport when nothing else is entered", () => {
    const r = calcRow({ baseHours: 26, basic: 1500, incentive: 200, transport: 100 }, RULES);
    expect(r).toMatchObject({ totalHours: 26, actualHours: 26, overtimeAmount: 0, deductions: 0, net: 1800 });
  });

  it("adds overtime from extra and exceptional hours", () => {
    // ot = 4 + 2 = 6 → 6 × 35 = 210; net = 1500 + 210 = 1710
    const r = calcRow({ baseHours: 26, extraHours: 4, exceptionalHours: 2, rate: 35, basic: 1500 }, RULES);
    expect(r).toMatchObject({ overtimeHours: 6, totalHours: 32, actualHours: 32, overtimeAmount: 210, net: 1710 });
  });

  it("deducts absence per hour and meetings per occurrence", () => {
    // absence: 2×20 + 1.5×30 = 85; meetings: 1×50 + 2×70 = 190; manual: 10 + 15 + 5 = 30 → 305
    // gross: 2000 + round(3 × 33.5 = 100.5 → 101) + 150 + 60 = 2311; 2311 − 305 = 2006 → nearest 5 = 2005
    const r = calcRow(
      {
        baseHours: 26,
        extraHours: 3,
        absentWithPermission: 2,
        absentNoPermission: 1.5,
        meetingsWithPermission: 1,
        meetingsNoPermission: 2,
        deductionTest: 10,
        deductionRecitation: 15,
        deductionBooks: 5,
        basic: 2000,
        rate: 33.5,
        incentive: 150,
        transport: 60,
      },
      RULES,
    );
    expect(r).toEqual({
      overtimeHours: 3,
      totalHours: 29,
      actualHours: 25.5,
      overtimeAmount: 101,
      deductions: 305,
      net: 2005,
    });
  });

  it("rounds only the hourly absence part", () => {
    // 0.5×20 + 0.25×30 = 17.5 → 18
    expect(calcRow({ absentWithPermission: 0.5, absentNoPermission: 0.25 }, RULES).deductions).toBe(18);
  });

  it("rounds the net to the nearest multiple of roundTo", () => {
    expect(calcRow({ basic: 1502 }, RULES).net).toBe(1500);
    expect(calcRow({ basic: 1503 }, RULES).net).toBe(1505);
    expect(calcRow({ basic: 1502.5 }, RULES).net).toBe(1505);
    expect(calcRow({ basic: 1234 }, { ...RULES, roundTo: 10 }).net).toBe(1230);
    expect(calcRow({ basic: 1234.4 }, { ...RULES, roundTo: 1 }).net).toBe(1234);
  });

  it("treats a zero rounding step as 1", () => {
    expect(calcRow({ basic: 1234.6 }, { ...RULES, roundTo: 0 }).net).toBe(1235);
  });

  it("can go negative when deductions exceed the pay", () => {
    // 100 − 30×10 = −200
    expect(calcRow({ basic: 100, absentNoPermission: 10 }, RULES).net).toBe(-200);
  });

  it("uses the configured rules", () => {
    const rules: PayrollRules = { ...RULES, absenceWithPermission: 25, meetingNoPermission: 100 };
    // 2×25 + 1×100 = 150 → 1000 − 150 = 850
    expect(calcRow({ basic: 1000, absentWithPermission: 2, meetingsNoPermission: 1 }, rules).net).toBe(850);
  });
});

describe("sumNet", () => {
  it("adds the rounded nets", () => {
    expect(sumNet([{ basic: 1502 }, { basic: 1503 }, {}], RULES)).toBe(3005);
  });
});

describe("summarizeYear", () => {
  it("groups by employee, orders by code and totals each month", () => {
    const s = summarizeYear([
      { employeeId: "b", name: "بكر", code: "م002", month: 1, net: 1000 },
      { employeeId: "a", name: "أحمد", code: "م001", month: 1, net: 1500 },
      { employeeId: "a", name: "أحمد", code: "م001", month: 3, net: 1600 },
      { employeeId: "b", name: "بكر", code: "م002", month: 12, net: 900 },
    ]);
    expect(s.lines.map((l) => l.employeeId)).toEqual(["a", "b"]);
    expect(s.lines[0].months[0]).toBe(1500);
    expect(s.lines[0].months[2]).toBe(1600);
    expect(s.lines[0].total).toBe(3100);
    expect(s.lines[1].total).toBe(1900);
    expect(s.monthTotals[0]).toBe(2500);
    expect(s.monthTotals[11]).toBe(900);
    expect(s.total).toBe(5000);
  });

  it("is empty without entries", () => {
    expect(summarizeYear([])).toEqual({ lines: [], monthTotals: Array(12).fill(0), total: 0 });
  });
});

describe("leaveBalance", () => {
  const rules = { leaveDays3: 10, leaveDays6: 21 };

  it("charges only «رصيد» days against the allowance of the work system", () => {
    expect(leaveBalance("(6) أيام", ["BALANCE", "BALANCE", "PROVEN", null], rules)).toEqual({
      allowance: 21,
      used: 2,
      remaining: 19,
      proven: 1,
      total: 4,
    });
    expect(leaveBalance("(3) أيام", ["BALANCE"], rules)).toMatchObject({ allowance: 10, remaining: 9 });
  });

  it("can go below zero", () => {
    expect(leaveBalance("(3) أيام", Array(12).fill("BALANCE"), rules).remaining).toBe(-2);
  });

  it("has no allowance without a work system", () => {
    expect(leaveBalance(null, ["BALANCE"], rules)).toEqual({ allowance: null, used: 1, remaining: null, proven: 0, total: 1 });
  });
});

describe("month helpers", () => {
  const months = [
    { year: 2025, month: 11 },
    { year: 2025, month: 12 },
    { year: 2026, month: 2 },
  ];

  it("finds the month extra hours are carried from", () => {
    expect(previousMonth(months, { year: 2026, month: 1 })).toEqual({ year: 2025, month: 12 });
    expect(previousMonth(months, { year: 2026, month: 2 })).toEqual({ year: 2025, month: 12 });
    expect(previousMonth(months, { year: 2026, month: 5 })).toEqual({ year: 2026, month: 2 });
    expect(previousMonth(months, { year: 2025, month: 11 })).toBeNull();
  });

  it("finds the latest month", () => {
    expect(latestMonth(months)).toEqual({ year: 2026, month: 2 });
    expect(latestMonth([])).toBeNull();
  });

  it("offers every year with rows, the current year and one ahead", () => {
    expect(selectableYears([2024, 2025], 2026)).toEqual([2027, 2026, 2025, 2024]);
    expect(selectableYears([], 2026)).toEqual([2027, 2026]);
    expect(selectableYears([2028], 2026)).toEqual([2029, 2028, 2026]);
  });
});
