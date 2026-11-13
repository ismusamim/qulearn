import "server-only";

import type { z } from "zod";

import { type ISODate, fromISODate } from "@/lib/dates";
import {
  type AuthContext,
  assertCanManageHalaqa,
  assertRole,
  managedHalaqaWhere,
  teachableStudentWhere,
} from "@/server/auth";
import { db } from "@/server/db";
import { listHalaqaOptions } from "@/server/directory";
import { ConflictError, ForbiddenError } from "@/server/errors";

import type { markAllPresentSchema, setAttendanceSchema } from "./schemas";
import type { AttendanceStatus } from "./stats";

/** Attendance is taken by the halaqa's teacher, its supervisor, or an admin. */
const STAFF = ["TEACHER", "SUPERVISOR", "ADMIN"] as const;

export interface HalaqaChoiceDTO {
  id: string;
  label: string;
}

export interface SheetStudentDTO {
  id: string;
  name: string;
  /** null = no mark yet for the day. */
  status: AttendanceStatus | null;
}

export interface AttendanceSheetDTO {
  /** The halaqat this user runs (all of them for an admin). */
  halaqat: HalaqaChoiceDTO[];
  /** The halaqa shown; null when the user has none or has not chosen yet. */
  halaqaId: string | null;
  date: ISODate;
  /** Active students only: dropped students are not marked. */
  students: SheetStudentDTO[];
  droppedCount: number;
}

/**
 * The day's sheet for one halaqa. Teachers and supervisors land on their first
 * halaqa (they rarely have more than one); an admin sees every halaqa and must
 * choose, unless there is only one.
 */
export async function getAttendanceSheet(
  auth: AuthContext,
  params: { halaqaId?: string; date: ISODate },
): Promise<AttendanceSheetDTO> {
  assertRole(auth, ...STAFF);
  const options = await listHalaqaOptions(managedHalaqaWhere(auth));
  const halaqat = options.map((h) => ({ id: h.id, label: h.label }));
  const selected =
    halaqat.find((h) => h.id === params.halaqaId) ??
    (auth.role !== "ADMIN" || halaqat.length === 1 ? halaqat[0] : undefined);
  if (!selected) return { halaqat, halaqaId: null, date: params.date, students: [], droppedCount: 0 };

  const members = await db.member.findMany({
    where: { role: "STUDENT", studentProfile: { halaqaId: selected.id } },
    select: { id: true, name: true, studentProfile: { select: { status: true } } },
    orderBy: { name: "asc" },
  });
  const active = members.filter((m) => m.studentProfile?.status !== "DROPPED");
  const marks = await db.attendance.findMany({
    where: { date: fromISODate(params.date), studentId: { in: active.map((m) => m.id) } },
    select: { studentId: true, status: true },
  });
  const statusOf = new Map(marks.map((m) => [m.studentId, m.status]));

  return {
    halaqat,
    halaqaId: selected.id,
    date: params.date,
    students: active.map((m) => ({ id: m.id, name: m.name, status: statusOf.get(m.id) ?? null })),
    droppedCount: members.length - active.length,
  };
}

/** Sets, changes or clears (status null) one student's mark for a day. One row per student per day. */
export async function setAttendance(auth: AuthContext, input: z.output<typeof setAttendanceSchema>): Promise<void> {
  assertRole(auth, ...STAFF);
  const student = await db.member.findFirst({
    where: { id: input.studentId, ...teachableStudentWhere(auth) },
    select: { studentProfile: { select: { status: true } } },
  });
  if (!student) throw new ForbiddenError("هذا الطالب ليس في حلقاتك");

  const date = fromISODate(input.date);
  if (input.status === null) {
    await db.attendance.deleteMany({ where: { studentId: input.studentId, date } });
    return;
  }
  // A dropped student is off the sheet; an old mark may still be cleared (above) but no new one is taken.
  if (student.studentProfile?.status === "DROPPED") throw new ConflictError("الطالب منقطع، لا يُسجَّل له حضور");

  await db.attendance.upsert({
    where: { studentId_date: { studentId: input.studentId, date } },
    create: { studentId: input.studentId, date, status: input.status, recordedById: auth.memberId },
    update: { status: input.status, recordedById: auth.memberId },
  });
}

/**
 * «الكل حاضر»: marks present every active student of the halaqa who has no mark
 * yet that day. Marks already taken (late, absent…) are kept, so the button is
 * safe to press after noting the exceptions.
 */
export async function markAllPresent(
  auth: AuthContext,
  input: z.output<typeof markAllPresentSchema>,
): Promise<{ count: number }> {
  assertRole(auth, ...STAFF);
  await assertCanManageHalaqa(auth, input.halaqaId);
  const students = await db.studentProfile.findMany({
    where: { halaqaId: input.halaqaId, status: "ACTIVE", member: { role: "STUDENT" } },
    select: { memberId: true },
  });
  const date = fromISODate(input.date);
  const result = await db.attendance.createMany({
    data: students.map((s) => ({ studentId: s.memberId, date, status: "PRESENT" as const, recordedById: auth.memberId })),
    skipDuplicates: true,
  });
  return { count: result.count };
}
