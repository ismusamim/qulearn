import "server-only";

import type { z } from "zod";

import { fromISODate, toISODate, todayISO } from "@/lib/dates";
import { type AuthContext, assertRole } from "@/server/auth";
import { db } from "@/server/db";
import { listPlaceOptions } from "@/server/directory";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";

import type { AbsencePermission, AbsenceProof } from "./constants";
import { type TeacherSummary, type YearMonth, defaultPayMonth, summarizeByTeacher } from "./domain";
import type { createAbsenceSchema } from "./schemas";

/**
 * Teacher absences are recorded and read by admins and supervisors.
 * Supervisors work from names and places only: nothing in this file selects a
 * salary column, and «الإثبات» (which drives the leave balance) is the
 * administration's alone.
 */
function assertAbsenceAccess(auth: AuthContext): void {
  assertRole(auth, "ADMIN", "SUPERVISOR");
}

/** Payroll months that have a sheet and are not closed. */
async function openPayrollMonths(): Promise<YearMonth[]> {
  const [months, closed] = await Promise.all([
    db.payrollRow.groupBy({ by: ["year", "month"] }),
    db.payrollClosedMonth.findMany(),
  ]);
  const closedKeys = new Set(closed.map((c) => c.year * 100 + c.month));
  return months.filter((m) => !closedKeys.has(m.year * 100 + m.month)).map((m) => ({ year: m.year, month: m.month }));
}

export interface StaffOption {
  id: string;
  name: string;
  /** Usual place of work; preselected in the form. */
  place: string;
}

export interface AbsenceFormOptions {
  staff: StaffOption[];
  places: string[];
  /** The payroll month new absences are charged to unless an admin picks another. */
  payMonth: YearMonth;
  today: string;
  isAdmin: boolean;
}

export async function getAbsenceFormOptions(auth: AuthContext): Promise<AbsenceFormOptions> {
  assertAbsenceAccess(auth);
  const today = todayISO();
  const [staff, placeOptions, usedPlaces, employeePlaces, open] = await Promise.all([
    db.employee.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, place: true } }),
    listPlaceOptions(),
    db.teacherAbsence.findMany({ where: { place: { not: null } }, select: { place: true }, distinct: ["place"] }),
    db.employee.findMany({ where: { place: { not: null } }, select: { place: true }, distinct: ["place"] }),
    openPayrollMonths(),
  ]);
  const places = new Set<string>();
  for (const p of [...placeOptions.map((x) => x.name), ...employeePlaces.map((x) => x.place), ...usedPlaces.map((x) => x.place)]) {
    if (p?.trim()) places.add(p.trim());
  }
  return {
    staff: staff
      .map((e) => ({ id: e.id, name: e.name, place: e.place ?? "" }))
      .sort((a, b) => a.name.localeCompare(b.name, "ar")),
    places: [...places].sort((a, b) => a.localeCompare(b, "ar")),
    payMonth: defaultPayMonth(open, today),
    today,
    isAdmin: auth.role === "ADMIN",
  };
}

export interface AbsenceDTO {
  id: string;
  date: string;
  year: number;
  month: number;
  employeeId: string;
  name: string;
  place: string;
  permission: AbsencePermission | null;
  reason: string;
  /** Always null for supervisors. */
  proof: AbsenceProof | null;
  note: string;
  recordedByName: string;
  /** Admins, or whoever recorded it. */
  canDelete: boolean;
}

export interface AbsenceMonthDTO extends YearMonth {
  years: number[];
  absences: AbsenceDTO[];
  summary: TeacherSummary[];
  isAdmin: boolean;
}

/** The absences charged to one payroll month, newest first, with a per-teacher summary. */
export async function getAbsenceMonth(auth: AuthContext, ym: YearMonth): Promise<AbsenceMonthDTO> {
  assertAbsenceAccess(auth);
  const isAdmin = auth.role === "ADMIN";
  const [rows, yearGroups] = await Promise.all([
    db.teacherAbsence.findMany({
      where: { year: ym.year, month: ym.month },
      include: { employee: { select: { name: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    db.teacherAbsence.groupBy({ by: ["year"] }),
  ]);
  const absences: AbsenceDTO[] = rows.map((a) => ({
    id: a.id,
    date: toISODate(a.date),
    year: a.year,
    month: a.month,
    employeeId: a.employeeId,
    name: a.employee.name || a.name || "",
    place: a.place ?? "",
    permission: a.permission,
    reason: a.reason ?? "",
    proof: isAdmin ? a.proof : null,
    note: a.note ?? "",
    recordedByName: a.recordedByName ?? "",
    canDelete: isAdmin || a.recordedById === auth.memberId,
  }));
  const years = new Set([ym.year, new Date().getFullYear(), ...yearGroups.map((g) => g.year)]);
  return {
    year: ym.year,
    month: ym.month,
    years: [...years].sort((a, b) => b - a),
    absences,
    summary: summarizeByTeacher(absences),
    isAdmin,
  };
}

export async function createAbsence(
  auth: AuthContext,
  input: z.output<typeof createAbsenceSchema>,
): Promise<{ name: string; year: number; month: number }> {
  assertAbsenceAccess(auth);
  const isAdmin = auth.role === "ADMIN";
  const employee = await db.employee.findUnique({ where: { id: input.employeeId }, select: { id: true, name: true } });
  if (!employee) throw new NotFoundError("اختر اسم المعلم من القائمة");
  const date = fromISODate(input.date);
  const clash = await db.teacherAbsence.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date } },
    select: { id: true },
  });
  if (clash) throw new ConflictError("غياب هذا المعلم في هذا اليوم مسجّل بالفعل");

  // Only the administration may charge an absence to a month of its choosing or decide its proof.
  const charged = defaultPayMonth(await openPayrollMonths(), input.date);
  if (isAdmin && input.payMonth) charged.month = input.payMonth;

  await db.teacherAbsence.create({
    data: {
      year: charged.year,
      month: charged.month,
      date,
      employeeId: employee.id,
      name: employee.name,
      place: input.place,
      permission: input.permission || null,
      reason: input.reason,
      proof: isAdmin && input.proof ? input.proof : null,
      note: input.note || null,
      // Who recorded it comes from the session, never from the form.
      recordedById: auth.memberId,
      recordedByName: auth.name,
    },
  });
  return { name: employee.name, ...charged };
}

export async function setAbsenceProof(auth: AuthContext, id: string, proof: AbsenceProof | null): Promise<void> {
  assertRole(auth, "ADMIN");
  const existing = await db.teacherAbsence.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("سجل الغياب غير موجود");
  await db.teacherAbsence.update({ where: { id }, data: { proof } });
}

export async function deleteAbsence(auth: AuthContext, id: string): Promise<void> {
  assertAbsenceAccess(auth);
  const existing = await db.teacherAbsence.findUnique({ where: { id }, select: { recordedById: true } });
  if (!existing) throw new NotFoundError("سجل الغياب غير موجود");
  if (auth.role !== "ADMIN" && existing.recordedById !== auth.memberId) {
    throw new ForbiddenError("لا يحذف سجل الغياب إلا الإدارة أو من سجّله");
  }
  await db.teacherAbsence.delete({ where: { id } });
}
