import { type InputKey, WORK_SYSTEM_3, WORK_SYSTEM_6 } from "./constants";

/**
 * Salary formulas — the same as the organisation's salary workbook:
 * absence is deducted per hour, missed meetings per occurrence, and the net
 * salary is rounded to the nearest `roundTo`.
 */

export interface PayrollRules {
  /** Deduction per absent hour, with / without permission. */
  absenceWithPermission: number;
  absenceNoPermission: number;
  /** Deduction per missed meeting, with / without permission. */
  meetingWithPermission: number;
  meetingNoPermission: number;
  roundTo: number;
}

export type RowInputs = Record<InputKey, number | null>;

export interface RowResult {
  /** Extra + exceptional hours. */
  overtimeHours: number;
  /** Base + overtime. */
  totalHours: number;
  /** Total minus absent hours. */
  actualHours: number;
  overtimeAmount: number;
  /** Absence + meetings + the three manual deductions. */
  deductions: number;
  net: number;
}

const num = (v: number | null | undefined): number => Number(v) || 0;

export function calcRow(row: Partial<RowInputs>, rules: PayrollRules): RowResult {
  const overtimeHours = num(row.extraHours) + num(row.exceptionalHours);
  const totalHours = num(row.baseHours) + overtimeHours;
  const actualHours = totalHours - num(row.absentWithPermission) - num(row.absentNoPermission);
  const overtimeAmount = Math.round(overtimeHours * num(row.rate));
  // Only the hourly part is rounded; meetings are whole amounts per occurrence.
  const absenceDeduction =
    Math.round(
      num(row.absentWithPermission) * rules.absenceWithPermission + num(row.absentNoPermission) * rules.absenceNoPermission,
    ) +
    num(row.meetingsWithPermission) * rules.meetingWithPermission +
    num(row.meetingsNoPermission) * rules.meetingNoPermission;
  const deductions =
    absenceDeduction + num(row.deductionTest) + num(row.deductionRecitation) + num(row.deductionBooks);
  const step = num(rules.roundTo) || 1;
  const gross = num(row.basic) + overtimeAmount + num(row.incentive) + num(row.transport);
  const net = Math.round((gross - deductions) / step) * step;
  return { overtimeHours, totalHours, actualHours, overtimeAmount, deductions, net };
}

export function sumNet(rows: ReadonlyArray<Partial<RowInputs>>, rules: PayrollRules): number {
  return rows.reduce((total, row) => total + calcRow(row, rules).net, 0);
}

// ───────────── Year summary ─────────────

export interface NetEntry {
  employeeId: string;
  name: string;
  code: string;
  month: number;
  net: number;
}

export interface YearLine {
  employeeId: string;
  name: string;
  code: string;
  /** Net per month; index 0 = January. */
  months: number[];
  total: number;
}

export interface YearSummary {
  lines: YearLine[];
  monthTotals: number[];
  total: number;
}

/** One line per employee (ordered by code) with the net of each month, plus column totals. */
export function summarizeYear(entries: ReadonlyArray<NetEntry>): YearSummary {
  const byEmployee = new Map<string, YearLine>();
  for (const e of entries) {
    if (e.month < 1 || e.month > 12) continue;
    let line = byEmployee.get(e.employeeId);
    if (!line) {
      line = { employeeId: e.employeeId, name: e.name, code: e.code, months: Array<number>(12).fill(0), total: 0 };
      byEmployee.set(e.employeeId, line);
    }
    line.months[e.month - 1] += e.net;
    line.total += e.net;
  }
  const lines = [...byEmployee.values()].sort((a, b) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name, "ar"));
  const monthTotals = Array.from({ length: 12 }, (_, i) => lines.reduce((sum, l) => sum + l.months[i], 0));
  return { lines, monthTotals, total: monthTotals.reduce((a, b) => a + b, 0) };
}

// ───────────── Leave balance ─────────────

export interface LeaveRules {
  leaveDays3: number;
  leaveDays6: number;
}

export interface LeaveBalance {
  /** Yearly allowance; null when the employee has no work system. */
  allowance: number | null;
  /** Absence days charged to the balance (proof = «رصيد»). */
  used: number;
  remaining: number | null;
  /** Absence days with accepted proof (not charged). */
  proven: number;
  /** All absence days of the year. */
  total: number;
}

export function leaveAllowance(workSystem: string | null | undefined, rules: LeaveRules): number | null {
  if (workSystem === WORK_SYSTEM_6) return rules.leaveDays6;
  if (workSystem === WORK_SYSTEM_3) return rules.leaveDays3;
  return null;
}

export function leaveBalance(
  workSystem: string | null | undefined,
  proofs: ReadonlyArray<"BALANCE" | "PROVEN" | null>,
  rules: LeaveRules,
): LeaveBalance {
  const allowance = leaveAllowance(workSystem, rules);
  const used = proofs.filter((p) => p === "BALANCE").length;
  return {
    allowance,
    used,
    remaining: allowance == null ? null : allowance - used,
    proven: proofs.filter((p) => p === "PROVEN").length,
    total: proofs.length,
  };
}

// ───────────── Months ─────────────

export interface YearMonth {
  year: number;
  month: number;
}

export const monthKey = (ym: YearMonth): number => ym.year * 100 + ym.month;

/** The latest month strictly before `target` among `months` (the one extra hours are carried from). */
export function previousMonth(months: ReadonlyArray<YearMonth>, target: YearMonth): YearMonth | null {
  let best: YearMonth | null = null;
  for (const m of months) {
    if (monthKey(m) < monthKey(target) && (!best || monthKey(m) > monthKey(best))) best = m;
  }
  return best;
}

/** The most recent month among `months`. */
export function latestMonth(months: ReadonlyArray<YearMonth>): YearMonth | null {
  let best: YearMonth | null = null;
  for (const m of months) if (!best || monthKey(m) > monthKey(best)) best = m;
  return best;
}

/** Years offered in the selector: every year with rows, the current one, and one year ahead. */
export function selectableYears(yearsWithRows: ReadonlyArray<number>, currentYear: number): number[] {
  const years = new Set<number>([...yearsWithRows, currentYear]);
  years.add(Math.max(...years) + 1);
  return [...years].sort((a, b) => b - a);
}
