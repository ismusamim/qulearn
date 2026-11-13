import "server-only";

import { todayISO } from "@/lib/dates";

import type { z } from "zod";

import { type AuthContext, assertRole } from "@/server/auth";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";

import { type PayrollRules, type RowInputs, type YearMonth, latestMonth, selectableYears } from "./calc";
import {
  assertMonthOpen,
  assertPayrollAccess,
  carriedExtraHours,
  isMonthClosed,
  loadSettings,
  monthsWithRows,
  newRowData,
  rowInputs,
  toRules,
} from "./internal";
import { clearPayrollUnlock, grantPayrollUnlock, isPayrollUnlocked } from "./pin";
import type { addRowSchema, settingsSchema, updateRowSchema } from "./schemas";

// ───────────── PIN gate ─────────────

/** Whether the page must ask for the payroll PIN before showing anything. */
export async function isPayrollLocked(auth: AuthContext): Promise<boolean> {
  assertRole(auth, "ADMIN");
  const { pinHash } = await loadSettings();
  return !!pinHash && !(await isPayrollUnlocked(auth, pinHash));
}

export async function unlockPayroll(auth: AuthContext, pin: string): Promise<void> {
  assertRole(auth, "ADMIN");
  const { pinHash } = await loadSettings();
  if (!pinHash) return;
  if (!(await verifyPassword(pin, pinHash))) throw new ForbiddenError("الرمز غير صحيح");
  await grantPayrollUnlock(auth, pinHash);
}

/** Sets, changes or (with an empty value) removes the PIN. The admin who set it stays unlocked. */
export async function setPayrollPin(auth: AuthContext, pin: string): Promise<void> {
  await assertPayrollAccess(auth);
  if (!pin) {
    await db.payrollSettings.update({ where: { id: 1 }, data: { pinHash: null } });
    await clearPayrollUnlock();
    return;
  }
  const pinHash = await hashPassword(pin);
  await db.payrollSettings.update({ where: { id: 1 }, data: { pinHash } });
  await grantPayrollUnlock(auth, pinHash);
}

// ───────────── Settings ─────────────

export interface PayrollSettingsDTO extends PayrollRules {
  leaveDays3: number;
  leaveDays6: number;
  defaultHours: number;
  pinEnabled: boolean;
  counts: { employees: number; rows: number; absences: number };
}

export async function getPayrollSettings(auth: AuthContext): Promise<PayrollSettingsDTO> {
  const s = await assertPayrollAccess(auth);
  const [employees, rows, absences] = await Promise.all([db.employee.count(), db.payrollRow.count(), db.teacherAbsence.count()]);
  return {
    ...toRules(s),
    leaveDays3: s.leaveDays3,
    leaveDays6: s.leaveDays6,
    defaultHours: Number(s.defaultHours),
    pinEnabled: !!s.pinHash,
    counts: { employees, rows, absences },
  };
}

/** Rules are not snapshotted: changing them recalculates every month, open or closed. */
export async function updatePayrollSettings(auth: AuthContext, input: z.output<typeof settingsSchema>): Promise<void> {
  await assertPayrollAccess(auth);
  await db.payrollSettings.update({ where: { id: 1 }, data: input });
}

// ───────────── Period selection ─────────────

export interface PayrollPeriods {
  years: number[];
  /** The latest month that has a sheet; January of this year when there is none. */
  latest: YearMonth;
}

export async function getPayrollPeriods(auth: AuthContext): Promise<PayrollPeriods> {
  await assertPayrollAccess(auth);
  const months = await monthsWithRows(db);
  const [currentYear, currentMonth] = todayISO().split("-").map(Number);
  return {
    years: selectableYears([...new Set(months.map((m) => m.year))], currentYear),
    // With no sheets yet, open on the current month rather than January.
    latest: latestMonth(months) ?? { year: currentYear, month: currentMonth },
  };
}

// ───────────── Month sheet ─────────────

export interface PayrollRowDTO {
  id: string;
  employeeId: string;
  name: string;
  jobTitle: string;
  values: RowInputs;
}

export interface MonthSheetDTO extends YearMonth {
  closed: boolean;
  rules: PayrollRules;
  rows: PayrollRowDTO[];
  /** Active employees that have no row in this month yet. */
  addable: { id: string; label: string }[];
  activeEmployees: number;
}

export async function getMonthSheet(auth: AuthContext, ym: YearMonth): Promise<MonthSheetDTO> {
  const settings = await assertPayrollAccess(auth);
  const [rows, closed, active] = await Promise.all([
    db.payrollRow.findMany({
      where: { year: ym.year, month: ym.month },
      include: { employee: { select: { code: true } } },
    }),
    isMonthClosed(db, ym),
    db.employee.findMany({ where: { status: "ACTIVE" }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  rows.sort(
    (a, b) => (a.employee.code ?? "").localeCompare(b.employee.code ?? "") || (a.name ?? "").localeCompare(b.name ?? "", "ar"),
  );
  const present = new Set(rows.map((r) => r.employeeId));
  return {
    ...ym,
    closed,
    rules: toRules(settings),
    rows: rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      name: r.name ?? "",
      jobTitle: r.jobTitle ?? "",
      values: rowInputs(r),
    })),
    addable: active
      .filter((e) => !present.has(e.id))
      .map((e) => ({ id: e.id, label: (e.code ? `${e.code} — ` : "") + e.name })),
    activeEmployees: active.length,
  };
}

/** «إنشاء الشهر»: one row per active employee at current prices, carrying extra hours from the previous sheet. */
export async function createMonth(auth: AuthContext, ym: YearMonth): Promise<{ count: number }> {
  const settings = await assertPayrollAccess(auth);
  return db.$transaction(async (tx) => {
    await assertMonthOpen(tx, ym);
    if (await tx.payrollRow.count({ where: { year: ym.year, month: ym.month } })) {
      throw new ConflictError("كشف هذا الشهر موجود بالفعل");
    }
    const employees = await tx.employee.findMany({ where: { status: "ACTIVE" } });
    if (employees.length === 0) throw new ConflictError("لا يوجد موظفون نشطون. أضفهم من «الموظفون»");
    const carried = await carriedExtraHours(tx, ym);
    await tx.payrollRow.createMany({ data: employees.map((e) => newRowData(e, ym, settings, carried)) });
    return { count: employees.length };
  });
}

export async function addRow(auth: AuthContext, input: z.output<typeof addRowSchema>): Promise<void> {
  const settings = await assertPayrollAccess(auth);
  const ym = { year: input.year, month: input.month };
  await db.$transaction(async (tx) => {
    await assertMonthOpen(tx, ym);
    const employee = await tx.employee.findUnique({ where: { id: input.employeeId } });
    if (!employee) throw new NotFoundError("الموظف غير موجود");
    if (employee.status !== "ACTIVE") throw new ConflictError("الموظف متوقف؛ أعده عاملًا أولًا");
    const exists = await tx.payrollRow.findUnique({
      where: { year_month_employeeId: { ...ym, employeeId: employee.id } },
      select: { id: true },
    });
    if (exists) throw new ConflictError("الموظف موجود في هذا الشهر بالفعل");
    await tx.payrollRow.create({ data: newRowData(employee, ym, settings, await carriedExtraHours(tx, ym)) });
  });
}

/** Saves the inputs of one row. The salary itself is never stored: it is always recomputed. */
export async function updateRow(auth: AuthContext, input: z.output<typeof updateRowSchema>): Promise<void> {
  await assertPayrollAccess(auth);
  await db.$transaction(async (tx) => {
    const row = await tx.payrollRow.findUnique({ where: { id: input.id }, select: { year: true, month: true } });
    if (!row) throw new NotFoundError("الصف غير موجود");
    await assertMonthOpen(tx, row);
    await tx.payrollRow.update({ where: { id: input.id }, data: input.values });
  });
}

export async function removeRow(auth: AuthContext, id: string): Promise<void> {
  await assertPayrollAccess(auth);
  await db.$transaction(async (tx) => {
    const row = await tx.payrollRow.findUnique({ where: { id }, select: { year: true, month: true } });
    if (!row) throw new NotFoundError("الصف غير موجود");
    await assertMonthOpen(tx, row);
    await tx.payrollRow.delete({ where: { id } });
  });
}

export async function deleteMonth(auth: AuthContext, ym: YearMonth): Promise<void> {
  await assertPayrollAccess(auth);
  await db.$transaction(async (tx) => {
    await assertMonthOpen(tx, ym);
    await tx.payrollRow.deleteMany({ where: { year: ym.year, month: ym.month } });
  });
}

export async function closeMonth(auth: AuthContext, ym: YearMonth): Promise<void> {
  await assertPayrollAccess(auth);
  if (!(await db.payrollRow.count({ where: { year: ym.year, month: ym.month } }))) {
    throw new ConflictError("لا يوجد كشف لهذا الشهر لإغلاقه");
  }
  const key = { year: ym.year, month: ym.month };
  await db.payrollClosedMonth.upsert({ where: { year_month: key }, create: key, update: {} });
}

export async function reopenMonth(auth: AuthContext, ym: YearMonth): Promise<void> {
  await assertPayrollAccess(auth);
  await db.payrollClosedMonth.deleteMany({ where: { year: ym.year, month: ym.month } });
}
