import "server-only";

import type { Employee, PayrollRow, PayrollSettings } from "@/generated/prisma/client";
import { type AuthContext, assertRole } from "@/server/auth";
import { db, type Tx } from "@/server/db";
import { ConflictError, ForbiddenError } from "@/server/errors";

import { type PayrollRules, type RowInputs, type YearMonth, monthKey, previousMonth } from "./calc";
import { INPUT_KEYS } from "./constants";
import { isPayrollUnlocked } from "./pin";

/** Helpers shared by the payroll services. Not for use outside this feature. */

export const toNumber = (value: unknown): number | null => (value == null ? null : Number(value));

/** The settings singleton; created with the schema defaults on first use. */
export async function loadSettings(client: Tx | typeof db = db): Promise<PayrollSettings> {
  return (
    (await client.payrollSettings.findUnique({ where: { id: 1 } })) ??
    (await client.payrollSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }))
  );
}

export function toRules(s: PayrollSettings): PayrollRules {
  return {
    absenceWithPermission: Number(s.absenceWithPermission),
    absenceNoPermission: Number(s.absenceNoPermission),
    meetingWithPermission: Number(s.meetingWithPermission),
    meetingNoPermission: Number(s.meetingNoPermission),
    roundTo: s.roundTo,
  };
}

/**
 * Gate of every payroll read and write: ADMIN only, and — when a payroll PIN
 * is set — only after it was entered in this login session.
 */
export async function assertPayrollAccess(auth: AuthContext): Promise<PayrollSettings> {
  assertRole(auth, "ADMIN");
  const settings = await loadSettings();
  if (settings.pinHash && !(await isPayrollUnlocked(auth, settings.pinHash))) {
    throw new ForbiddenError("قسم المرتبات محمي برمز؛ أدخل الرمز أولًا");
  }
  return settings;
}

export function rowInputs(row: PayrollRow): RowInputs {
  return Object.fromEntries(INPUT_KEYS.map((key) => [key, toNumber(row[key])])) as RowInputs;
}

export async function isMonthClosed(client: Tx | typeof db, ym: YearMonth): Promise<boolean> {
  return !!(await client.payrollClosedMonth.findUnique({ where: { year_month: { year: ym.year, month: ym.month } } }));
}

/** Closed months are read-only until reopened. */
export async function assertMonthOpen(client: Tx | typeof db, ym: YearMonth): Promise<void> {
  if (await isMonthClosed(client, ym)) throw new ConflictError(`شهر (${ym.month}) ${ym.year} مغلق؛ أعد فتحه للتعديل`);
}

/** Every month that has rows. */
export async function monthsWithRows(client: Tx | typeof db): Promise<YearMonth[]> {
  const groups = await client.payrollRow.groupBy({ by: ["year", "month"] });
  return groups.map((g) => ({ year: g.year, month: g.month }));
}

/** Months that have rows and are not closed, oldest first. */
export async function openMonths(client: Tx | typeof db): Promise<YearMonth[]> {
  const [months, closed] = await Promise.all([monthsWithRows(client), client.payrollClosedMonth.findMany()]);
  const closedKeys = new Set(closed.map(monthKey));
  return months.filter((m) => !closedKeys.has(monthKey(m))).sort((a, b) => monthKey(a) - monthKey(b));
}

/**
 * Extra hours are carried over from the latest earlier month that has a sheet
 * (not necessarily the calendar month before). Returns employeeId → extra hours.
 */
export async function carriedExtraHours(client: Tx | typeof db, ym: YearMonth): Promise<Map<string, number | null>> {
  const prev = previousMonth(await monthsWithRows(client), ym);
  if (!prev) return new Map();
  const rows = await client.payrollRow.findMany({
    where: { year: prev.year, month: prev.month },
    select: { employeeId: true, extraHours: true },
  });
  return new Map(rows.map((r) => [r.employeeId, toNumber(r.extraHours)]));
}

/**
 * A new month row: the employee's current salary components are copied in, so
 * a later raise never changes this month.
 */
export function newRowData(employee: Employee, ym: YearMonth, settings: PayrollSettings, carried: Map<string, number | null>) {
  return {
    year: ym.year,
    month: ym.month,
    employeeId: employee.id,
    name: employee.name,
    jobTitle: employee.jobTitle,
    baseHours: employee.hours ?? settings.defaultHours,
    extraHours: carried.get(employee.id) ?? null,
    basic: employee.basic ?? 0,
    rate: employee.rate ?? 0,
    incentive: employee.incentive ?? 0,
    transport: employee.transport ?? 0,
    note: "",
  };
}
