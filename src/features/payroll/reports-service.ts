import "server-only";

import { toISODate } from "@/lib/dates";
import type { AuthContext } from "@/server/auth";
import { db } from "@/server/db";

import { type LeaveBalance, type YearSummary, calcRow, leaveBalance, monthKey, summarizeYear } from "./calc";
import { assertPayrollAccess, rowInputs, toRules } from "./internal";

// ───────────── Year summary ─────────────

export async function getYearSummary(auth: AuthContext, year: number): Promise<YearSummary> {
  const settings = await assertPayrollAccess(auth);
  const rules = toRules(settings);
  const rows = await db.payrollRow.findMany({
    where: { year },
    include: { employee: { select: { name: true, code: true } } },
  });
  return summarizeYear(
    rows.map((r) => ({
      employeeId: r.employeeId,
      name: r.employee.name || r.name || "",
      code: r.employee.code ?? "",
      month: r.month,
      net: calcRow(rowInputs(r), rules).net,
    })),
  );
}

// ───────────── Archive ─────────────

export interface ArchiveYearDTO {
  year: number;
  /** Index 0 = January; null when the month has no sheet. */
  months: ({ total: number; closed: boolean } | null)[];
  total: number;
  monthCount: number;
}

/** Every year in the ledger with the total of each month. */
export async function getArchive(auth: AuthContext): Promise<ArchiveYearDTO[]> {
  const settings = await assertPayrollAccess(auth);
  const rules = toRules(settings);
  const [rows, closed] = await Promise.all([db.payrollRow.findMany(), db.payrollClosedMonth.findMany()]);
  const closedKeys = new Set(closed.map(monthKey));
  const years = new Map<number, ArchiveYearDTO>();
  for (const r of rows) {
    let y = years.get(r.year);
    if (!y) {
      y = { year: r.year, months: Array<null>(12).fill(null), total: 0, monthCount: 0 };
      years.set(r.year, y);
    }
    const net = calcRow(rowInputs(r), rules).net;
    const cell = (y.months[r.month - 1] ??= { total: 0, closed: closedKeys.has(monthKey(r)) });
    cell.total += net;
    y.total += net;
  }
  for (const y of years.values()) y.monthCount = y.months.filter(Boolean).length;
  return [...years.values()].sort((a, b) => b.year - a.year);
}

// ───────────── Absences and leave balances ─────────────

export interface LeaveAbsenceDTO {
  id: string;
  date: string;
  month: number;
  name: string;
  place: string;
  permission: "WITH_PERMISSION" | "WITHOUT_PERMISSION" | null;
  reason: string;
  proof: "BALANCE" | "PROVEN" | null;
}

export interface LeaveLineDTO extends LeaveBalance {
  employeeId: string;
  name: string;
  workSystem: string;
}

export interface LeaveOverviewDTO {
  year: number;
  /** 0 = all months. */
  month: number;
  absences: LeaveAbsenceDTO[];
  balances: LeaveLineDTO[];
}

/**
 * The year's teacher absences and what they leave of each employee's leave
 * allowance. Only days the administration marked «رصيد» are charged.
 */
export async function getLeaveOverview(auth: AuthContext, year: number, month: number): Promise<LeaveOverviewDTO> {
  const settings = await assertPayrollAccess(auth);
  const absences = await db.teacherAbsence.findMany({
    where: { year },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  // Balances list every working employee, plus stopped ones that were absent this year.
  const employees = await db.employee.findMany({
    where: { OR: [{ status: "ACTIVE" }, { id: { in: [...new Set(absences.map((a) => a.employeeId))] } }] },
    select: { id: true, name: true, workSystem: true },
  });
  const names = new Map(employees.map((e) => [e.id, e.name]));
  const balances = employees
    .map((e) => ({
      employeeId: e.id,
      name: e.name,
      workSystem: e.workSystem ?? "",
      ...leaveBalance(
        e.workSystem,
        absences.filter((a) => a.employeeId === e.id).map((a) => a.proof),
        settings,
      ),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "ar"));
  return {
    year,
    month,
    absences: absences
      .filter((a) => !month || a.month === month)
      .map((a) => ({
        id: a.id,
        date: toISODate(a.date),
        month: a.month,
        name: names.get(a.employeeId) ?? a.name ?? "",
        place: a.place ?? "",
        permission: a.permission,
        reason: a.reason ?? "",
        proof: a.proof,
      })),
    balances,
  };
}
