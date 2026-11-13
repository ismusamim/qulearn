import { isISODate } from "@/lib/dates";

import type { AbsencePermission } from "./constants";

export interface YearMonth {
  year: number;
  month: number;
}

/**
 * The payroll month an absence is charged to by default: the latest payroll
 * month that has a sheet and is still open; when there is none, the calendar
 * month of the absence itself.
 */
export function defaultPayMonth(openMonths: ReadonlyArray<YearMonth>, date: string): YearMonth {
  let latest: YearMonth | null = null;
  for (const m of openMonths) {
    if (!latest || m.year * 100 + m.month > latest.year * 100 + latest.month) latest = m;
  }
  if (latest) return { year: latest.year, month: latest.month };
  if (isISODate(date)) return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export interface TeacherSummary {
  employeeId: string;
  name: string;
  days: number;
  withPermission: number;
  withoutPermission: number;
}

/** Absence days per teacher, most absent first. */
export function summarizeByTeacher(
  absences: ReadonlyArray<{ employeeId: string; name: string; permission: AbsencePermission | null }>,
): TeacherSummary[] {
  const by = new Map<string, TeacherSummary>();
  for (const a of absences) {
    let s = by.get(a.employeeId);
    if (!s) {
      s = { employeeId: a.employeeId, name: a.name, days: 0, withPermission: 0, withoutPermission: 0 };
      by.set(a.employeeId, s);
    }
    s.days++;
    if (a.permission === "WITH_PERMISSION") s.withPermission++;
    if (a.permission === "WITHOUT_PERMISSION") s.withoutPermission++;
  }
  return [...by.values()].sort((a, b) => b.days - a.days || a.name.localeCompare(b.name, "ar"));
}
