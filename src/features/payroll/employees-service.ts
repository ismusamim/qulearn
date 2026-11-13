import "server-only";

import type { z } from "zod";

import type { Employee } from "@/generated/prisma/client";
import { fixName, normalizeArabic } from "@/lib/arabic";
import type { Role } from "@/lib/constants";
import { type AuthContext, assertRole } from "@/server/auth";
import { db, type Tx } from "@/server/db";
import { ConflictError, NotFoundError } from "@/server/errors";

import { assertPayrollAccess, carriedExtraHours, loadSettings, newRowData, openMonths, toNumber } from "./internal";
import type { employeeSchema, updateEmployeeSchema } from "./schemas";

/** Accounts an employee can be linked to (students never are employees). */
const LINKABLE_ROLES: Role[] = ["TEACHER", "SUPERVISOR", "ADMIN", "ACCOUNTANT"];

export interface EmployeeDTO {
  id: string;
  code: string;
  name: string;
  jobTitle: string;
  workSystem: string;
  status: "ACTIVE" | "STOPPED";
  basic: number | null;
  rate: number | null;
  incentive: number | null;
  transport: number | null;
  hours: number | null;
  place: string;
  note: string;
  memberId: string | null;
  memberLabel: string | null;
  rowCount: number;
}

export interface LinkableMemberDTO {
  id: string;
  name: string;
  role: Role;
  /** The employee already linked to this account, if any. */
  employeeId: string | null;
}

export interface EmployeesOverviewDTO {
  employees: EmployeeDTO[];
  members: LinkableMemberDTO[];
  /** Suggested for a new employee. */
  nextCode: string;
  defaultHours: number;
  /** Unlinked employees whose name matches exactly one free account. */
  autoLinkable: number;
}

type MemberLite = { id: string; nameNormalized: string; role: Role; employee: { id: string } | null };

/**
 * An employee with no account is taken to be the one member (teacher,
 * supervisor, admin or accountant) carrying exactly the same name.
 */
function nameMatches(employees: { id: string; name: string; memberId: string | null }[], members: MemberLite[]) {
  const pairs: { employeeId: string; memberId: string }[] = [];
  for (const e of employees) {
    if (e.memberId) continue;
    const key = normalizeArabic(e.name);
    const hits = members.filter((m) => m.nameNormalized === key);
    if (hits.length === 1 && !hits[0].employee) pairs.push({ employeeId: e.id, memberId: hits[0].id });
  }
  // Two employees must not claim the same account.
  return pairs.filter((p) => pairs.filter((q) => q.memberId === p.memberId).length === 1);
}

const linkableMembers = () =>
  db.member.findMany({
    where: { role: { in: LINKABLE_ROLES } },
    select: { id: true, name: true, nameNormalized: true, role: true, employee: { select: { id: true } } },
    orderBy: { name: "asc" },
  });

export async function getEmployeesOverview(auth: AuthContext): Promise<EmployeesOverviewDTO> {
  const settings = await assertPayrollAccess(auth);
  const [employees, members] = await Promise.all([
    db.employee.findMany({
      include: { member: { select: { name: true } }, _count: { select: { rows: true } } },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    }),
    linkableMembers(),
  ]);
  return {
    employees: employees.map((e) => ({
      id: e.id,
      code: e.code ?? "",
      name: e.name,
      jobTitle: e.jobTitle ?? "",
      workSystem: e.workSystem ?? "",
      status: e.status,
      basic: toNumber(e.basic),
      rate: toNumber(e.rate),
      incentive: toNumber(e.incentive),
      transport: toNumber(e.transport),
      hours: toNumber(e.hours),
      place: e.place ?? "",
      note: e.note ?? "",
      memberId: e.memberId,
      memberLabel: e.member?.name ?? null,
      rowCount: e._count.rows,
    })),
    members: members.map((m) => ({ id: m.id, name: m.name, role: m.role, employeeId: m.employee?.id ?? null })),
    nextCode: "م" + String(employees.length + 1).padStart(3, "0"),
    defaultHours: Number(settings.defaultHours),
    autoLinkable: nameMatches(employees, members).length,
  };
}

async function assertNameFree(tx: Tx, name: string, exceptId?: string): Promise<void> {
  const key = normalizeArabic(name);
  const others = await tx.employee.findMany({ where: exceptId ? { id: { not: exceptId } } : {}, select: { name: true } });
  if (others.some((e) => normalizeArabic(e.name) === key)) throw new ConflictError("يوجد موظف بالاسم نفسه");
}

async function assertMemberLinkable(tx: Tx, memberId: string, employeeId?: string): Promise<void> {
  const member = await tx.member.findUnique({
    where: { id: memberId },
    select: { role: true, employee: { select: { id: true, name: true } } },
  });
  if (!member || !LINKABLE_ROLES.includes(member.role)) throw new NotFoundError("الحساب المرتبط غير موجود");
  if (member.employee && member.employee.id !== employeeId) {
    throw new ConflictError(`هذا الحساب مرتبط بالموظف «${member.employee.name}»`);
  }
}

function employeeData(input: z.output<typeof employeeSchema>) {
  return {
    code: input.code || null,
    name: fixName(input.name),
    jobTitle: input.jobTitle,
    workSystem: input.workSystem || null,
    basic: input.basic,
    rate: input.rate,
    incentive: input.incentive,
    transport: input.transport,
    hours: input.hours,
    place: input.place || null,
    note: input.note || null,
    memberId: input.memberId || null,
  };
}

/**
 * «عامل / متوقف» replaces deletion. Stopping takes the employee out of every
 * open sheet (closed months are never touched); returning puts them back in
 * the latest open sheet at their current prices.
 */
async function applyStatus(tx: Tx, employee: Employee, status: "ACTIVE" | "STOPPED") {
  await tx.employee.update({ where: { id: employee.id }, data: { status } });
  const open = await openMonths(tx);
  if (status === "STOPPED") {
    const { count } = await tx.payrollRow.deleteMany({
      where: { employeeId: employee.id, OR: open.map((m) => ({ year: m.year, month: m.month })) },
    });
    return { removed: open.length ? count : 0, addedTo: null };
  }
  const last = open.at(-1);
  if (!last) return { removed: 0, addedTo: null };
  const exists = await tx.payrollRow.findUnique({
    where: { year_month_employeeId: { year: last.year, month: last.month, employeeId: employee.id } },
    select: { id: true },
  });
  if (exists) return { removed: 0, addedTo: null };
  const settings = await loadSettings(tx);
  await tx.payrollRow.create({ data: newRowData(employee, last, settings, await carriedExtraHours(tx, last)) });
  return { removed: 0, addedTo: last };
}

export interface StatusChangeDTO {
  name: string;
  status: "ACTIVE" | "STOPPED";
  /** Rows removed from open sheets when stopping. */
  removed: number;
  /** The open sheet the employee was put back into when returning. */
  addedTo: { year: number; month: number } | null;
}

export async function createEmployee(auth: AuthContext, input: z.output<typeof employeeSchema>): Promise<{ id: string }> {
  await assertPayrollAccess(auth);
  return db.$transaction(async (tx) => {
    await assertNameFree(tx, input.name);
    if (input.memberId) await assertMemberLinkable(tx, input.memberId);
    return tx.employee.create({ data: { ...employeeData(input), status: input.status }, select: { id: true } });
  });
}

export async function updateEmployee(auth: AuthContext, input: z.output<typeof updateEmployeeSchema>): Promise<StatusChangeDTO | null> {
  await assertPayrollAccess(auth);
  return db.$transaction(async (tx) => {
    const existing = await tx.employee.findUnique({ where: { id: input.id } });
    if (!existing) throw new NotFoundError("الموظف غير موجود");
    await assertNameFree(tx, input.name, input.id);
    if (input.memberId) await assertMemberLinkable(tx, input.memberId, input.id);
    // Past months keep their own snapshot; only sheets created from now on see the new prices.
    const updated = await tx.employee.update({ where: { id: input.id }, data: employeeData(input) });
    if (input.status === existing.status) return null;
    return { name: updated.name, status: input.status, ...(await applyStatus(tx, updated, input.status)) };
  });
}

export async function setEmployeeStatus(auth: AuthContext, id: string, status: "ACTIVE" | "STOPPED"): Promise<StatusChangeDTO> {
  await assertPayrollAccess(auth);
  return db.$transaction(async (tx) => {
    const employee = await tx.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundError("الموظف غير موجود");
    if (employee.status === status) return { name: employee.name, status, removed: 0, addedTo: null };
    return { name: employee.name, status, ...(await applyStatus(tx, employee, status)) };
  });
}

/**
 * Keeps payroll in step when the administration suspends or restores a teacher
 * from the teachers section: the linked employee (if any) is stopped or
 * reactivated the same way. Not behind the payroll PIN on purpose — it reveals
 * no payroll data — but still admin-only.
 */
export async function syncLinkedEmployeeStatus(
  auth: AuthContext,
  memberId: string,
  status: "ACTIVE" | "STOPPED",
): Promise<void> {
  assertRole(auth, "ADMIN");
  await db.$transaction(async (tx) => {
    const employee = await tx.employee.findUnique({ where: { memberId } });
    if (!employee || employee.status === status) return;
    await applyStatus(tx, employee, status);
  });
}

/** Only an employee who never appeared on a sheet can be deleted; otherwise stop them. */
export async function deleteEmployee(auth: AuthContext, id: string): Promise<void> {
  await assertPayrollAccess(auth);
  const employee = await db.employee.findUnique({ where: { id }, select: { _count: { select: { rows: true } } } });
  if (!employee) throw new NotFoundError("الموظف غير موجود");
  if (employee._count.rows > 0) throw new ConflictError("له رواتب مسجلة؛ اجعل حالته «متوقف» بدل الحذف");
  await db.employee.delete({ where: { id } });
}

/** Links every unlinked employee to the single account that carries the same name. */
export async function autoLinkEmployees(auth: AuthContext): Promise<{ linked: number }> {
  await assertPayrollAccess(auth);
  const [employees, members] = await Promise.all([
    db.employee.findMany({ select: { id: true, name: true, memberId: true } }),
    linkableMembers(),
  ]);
  const pairs = nameMatches(employees, members);
  await db.$transaction(pairs.map((p) => db.employee.update({ where: { id: p.employeeId }, data: { memberId: p.memberId } })));
  return { linked: pairs.length };
}
