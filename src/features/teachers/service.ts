import "server-only";

import type { z } from "zod";

import { fixName, normalizeArabic, normalizePhone } from "@/lib/arabic";
import { fromISODate, toISODate } from "@/lib/dates";
import { type AuthContext, assertRole } from "@/server/auth";
import { db } from "@/server/db";
import { type CustomFieldDef, listAllHalaqaOptions, listCustomFields } from "@/server/directory";
import { ConflictError, NotFoundError } from "@/server/errors";
import { createMemberRecord, memberNameTaken } from "@/server/members";
import { syncLinkedEmployeeStatus } from "@/features/payroll/employees-service";

import { type TeacherStatus, mergeExtra, readExtra } from "./profile";
import type {
  MyPersonalValues,
  MyTechnicalValues,
  createTeacherSchema,
  myExtraSchema,
  teacherWorkingSchema,
  updateTeacherSchema,
} from "./schemas";

// ───────────── DTOs ─────────────

export interface TeacherHalaqaDTO {
  id: string;
  label: string;
  studentCount: number;
}

/** One row of the administration's teachers table. */
export interface TeacherRowDTO {
  id: string;
  name: string;
  phone: string;
  status: TeacherStatus;
  halaqat: TeacherHalaqaDTO[];
  studentCount: number;
}

/** The whole internal file. Dates are ISO strings, "" when not set. */
export interface TeacherFileDTO {
  id: string;
  name: string;
  phone: string;
  personal: { fullName: string; birthDate: string; email: string; address: string; emergencyContact: string };
  administrative: {
    employeeNo: string;
    joinDate: string;
    contractType: string;
    status: TeacherStatus;
    monthlyPay: number | null;
    adminNote: string;
  };
  technical: {
    qualification: string;
    riwaya: string;
    ijaza: string;
    sanad: string;
    memorizedParts: number | null;
    experienceYears: number | null;
    specialty: string;
    courses: string;
  };
  /** Values of the admin-defined custom fields («بيانات إضافية»). */
  extra: Record<string, string>;
  halaqat: TeacherHalaqaDTO[];
  studentCount: number;
}

export interface TeacherFileView {
  teacher: TeacherFileDTO;
  customFields: CustomFieldDef[];
}

// ───────────── Reads ─────────────

async function halaqatByTeacher(): Promise<Map<string, TeacherHalaqaDTO[]>> {
  const map = new Map<string, TeacherHalaqaDTO[]>();
  for (const h of await listAllHalaqaOptions()) {
    if (!h.teacherId) continue;
    const list = map.get(h.teacherId) ?? [];
    list.push({ id: h.id, label: h.label, studentCount: h.studentCount });
    map.set(h.teacherId, list);
  }
  return map;
}

const sumStudents = (halaqat: TeacherHalaqaDTO[]) => halaqat.reduce((sum, h) => sum + h.studentCount, 0);

export async function listTeachers(auth: AuthContext): Promise<TeacherRowDTO[]> {
  assertRole(auth, "ADMIN");
  const [rows, byTeacher] = await Promise.all([
    db.member.findMany({
      where: { role: "TEACHER" },
      select: { id: true, name: true, phone: true, teacherProfile: { select: { status: true } } },
      orderBy: { name: "asc" },
    }),
    halaqatByTeacher(),
  ]);
  return rows.map((t) => {
    const halaqat = byTeacher.get(t.id) ?? [];
    return {
      id: t.id,
      name: t.name,
      phone: t.phone,
      status: t.teacherProfile?.status ?? "ACTIVE",
      halaqat,
      studentCount: sumStudents(halaqat),
    };
  });
}

async function loadFile(memberId: string): Promise<TeacherFileView> {
  const [member, byTeacher, customFields] = await Promise.all([
    db.member.findFirst({
      where: { id: memberId, role: "TEACHER" },
      select: { id: true, name: true, phone: true, extra: true, teacherProfile: true },
    }),
    halaqatByTeacher(),
    listCustomFields("TEACHERS"),
  ]);
  if (!member) throw new NotFoundError("المعلم غير موجود");
  const p = member.teacherProfile;
  const halaqat = byTeacher.get(member.id) ?? [];
  return {
    customFields,
    teacher: {
      id: member.id,
      name: member.name,
      phone: member.phone,
      personal: {
        fullName: p?.fullName ?? "",
        birthDate: toISODate(p?.birthDate) ?? "",
        email: p?.email ?? "",
        address: p?.address ?? "",
        emergencyContact: p?.emergencyContact ?? "",
      },
      administrative: {
        employeeNo: p?.employeeNo ?? "",
        joinDate: toISODate(p?.joinDate) ?? "",
        contractType: p?.contractType ?? "",
        status: p?.status ?? "ACTIVE",
        monthlyPay: p?.monthlyPay == null ? null : Number(p.monthlyPay),
        adminNote: p?.adminNote ?? "",
      },
      technical: {
        qualification: p?.qualification ?? "",
        riwaya: p?.riwaya ?? "",
        ijaza: p?.ijaza ?? "",
        sanad: p?.sanad ?? "",
        memorizedParts: p?.memorizedParts ?? null,
        experienceYears: p?.experienceYears ?? null,
        specialty: p?.specialty ?? "",
        courses: p?.courses ?? "",
      },
      extra: readExtra(member.extra),
      halaqat,
      studentCount: sumStudents(halaqat),
    },
  };
}

/** Any teacher's file, for the administration. */
export async function getTeacherFile(auth: AuthContext, id: string): Promise<TeacherFileView> {
  assertRole(auth, "ADMIN");
  return loadFile(id);
}

/** The signed-in teacher's own file («ملفي»). The administrative section is theirs to read, not to edit. */
export async function getMyFile(auth: AuthContext): Promise<TeacherFileView> {
  assertRole(auth, "TEACHER");
  return loadFile(auth.memberId);
}

// ───────────── Administration writes ─────────────

const dateOrNull = (value: string) => (value ? fromISODate(value) : null);

function personalData(input: MyPersonalValues) {
  return {
    fullName: input.fullName,
    birthDate: dateOrNull(input.birthDate),
    email: input.email,
    address: input.address,
    emergencyContact: input.emergencyContact,
  };
}

function technicalData(input: MyTechnicalValues) {
  return {
    qualification: input.qualification,
    riwaya: input.riwaya,
    ijaza: input.ijaza,
    sanad: input.sanad,
    memorizedParts: input.memorizedParts,
    experienceYears: input.experienceYears,
    specialty: input.specialty,
    courses: input.courses,
  };
}

async function findTeacher(id: string) {
  const teacher = await db.member.findFirst({ where: { id, role: "TEACHER" }, select: { id: true, name: true, extra: true } });
  if (!teacher) throw new NotFoundError("المعلم غير موجود");
  return teacher;
}

/** Creates the account with a generated password, returned in plain text this one time. */
export async function createTeacher(
  auth: AuthContext,
  input: z.output<typeof createTeacherSchema>,
): Promise<{ id: string; name: string; password: string | null }> {
  assertRole(auth, "ADMIN");
  return createMemberRecord(db, { role: "TEACHER", name: input.name, phone: input.phone });
}

/** «تعديل بيانات»: name, phone, the three sections and the custom fields in one save. */
export async function updateTeacher(auth: AuthContext, input: z.output<typeof updateTeacherSchema>): Promise<{ name: string }> {
  assertRole(auth, "ADMIN");
  const teacher = await findTeacher(input.id);
  const name = fixName(input.name);
  if (await memberNameTaken("TEACHER", name, teacher.id)) throw new ConflictError("يوجد معلم بالاسم نفسه");

  const profile = {
    ...personalData(input),
    employeeNo: input.employeeNo,
    joinDate: dateOrNull(input.joinDate),
    contractType: input.contractType,
    status: input.status,
    monthlyPay: input.monthlyPay,
    adminNote: input.adminNote,
    ...technicalData(input),
  };
  const customFields = await listCustomFields("TEACHERS");
  await db.$transaction([
    db.member.update({
      where: { id: teacher.id },
      data: {
        name,
        nameNormalized: normalizeArabic(name),
        phone: normalizePhone(input.phone),
        extra: mergeExtra(teacher.extra, input.extra, customFields),
      },
    }),
    db.teacherProfile.upsert({
      where: { memberId: teacher.id },
      create: { memberId: teacher.id, ...profile },
      update: profile,
    }),
  ]);
  return { name };
}

/**
 * «عامل / متوقف» — used instead of deleting a teacher. A suspended teacher can
 * still sign in but sees only the block notice and every write is refused
 * (AuthContext.blocked). Returning to work also ends a leave.
 */
export async function setTeacherWorking(
  auth: AuthContext,
  input: z.output<typeof teacherWorkingSchema>,
): Promise<{ name: string; status: TeacherStatus }> {
  assertRole(auth, "ADMIN");
  const teacher = await findTeacher(input.id);
  const status: TeacherStatus = input.working ? "ACTIVE" : "SUSPENDED";
  await db.teacherProfile.upsert({
    where: { memberId: teacher.id },
    create: { memberId: teacher.id, status },
    update: { status },
  });
  // A suspended teacher is also stopped in payroll (and restored with them).
  await syncLinkedEmployeeStatus(auth, teacher.id, input.working ? "ACTIVE" : "STOPPED");
  return { name: teacher.name, status };
}

// ───────────── The teacher's own writes ─────────────
// These never take a member id: the target is always auth.memberId, and the
// data written is built field by field, so no administrative column can be
// reached whatever the client sends.

export async function updateMyPersonal(auth: AuthContext, input: MyPersonalValues): Promise<void> {
  assertRole(auth, "TEACHER");
  const data = personalData(input);
  await db.$transaction([
    db.member.update({ where: { id: auth.memberId }, data: { phone: normalizePhone(input.phone) } }),
    db.teacherProfile.upsert({ where: { memberId: auth.memberId }, create: { memberId: auth.memberId, ...data }, update: data }),
  ]);
}

export async function updateMyTechnical(auth: AuthContext, input: MyTechnicalValues): Promise<void> {
  assertRole(auth, "TEACHER");
  const data = technicalData(input);
  await db.teacherProfile.upsert({
    where: { memberId: auth.memberId },
    create: { memberId: auth.memberId, ...data },
    update: data,
  });
}

export async function updateMyExtra(auth: AuthContext, input: z.output<typeof myExtraSchema>): Promise<void> {
  assertRole(auth, "TEACHER");
  const [teacher, customFields] = await Promise.all([findTeacher(auth.memberId), listCustomFields("TEACHERS")]);
  await db.member.update({
    where: { id: teacher.id },
    data: { extra: mergeExtra(teacher.extra, input.extra, customFields) },
  });
}
