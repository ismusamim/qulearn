import "server-only";

import { z } from "zod";

import { type AttendanceStatus, type StatusCounts, attendanceRate, countStatuses, emptyCounts } from "@/features/attendance/stats";
import { Prisma } from "@/generated/prisma/client";
import { type ISODate, fromISODate, toISODate } from "@/lib/dates";
import {
  type AuthContext,
  assertCanSeeStudent,
  assertRole,
  managedHalaqaWhere,
  teachableStudentWhere,
} from "@/server/auth";
import { db } from "@/server/db";
import { halaqaLabelMap, listCustomFields, listHalaqaOptions } from "@/server/directory";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";

import { type HifzPosition, type RecitationType, findLastHifz, hifzAyatCount, validateAyahRange } from "./progress";
import type { recitationSchema } from "./schemas";

/** Recitation is recorded by the halaqa's teacher, its supervisor, or an admin. */
const STAFF = ["TEACHER", "SUPERVISOR", "ADMIN"] as const;

// ───────────────────────── Students list (طلابي) ─────────────────────────

export interface StudentRowDTO {
  id: string;
  name: string;
  halaqaLabel: string;
  /** Dropped (منقطع) students stay in the list, greyed, and take no new records. */
  dropped: boolean;
  lastHifz: HifzPosition | null;
  recitationCount: number;
  /** Percentage, or null when no attendance has been taken. */
  attendanceRate: number | null;
}

export interface MyStudentsDTO {
  halaqat: { id: string; label: string }[];
  /** The halaqa filtered on; null = all of the user's halaqat. */
  halaqaId: string | null;
  students: StudentRowDTO[];
}

/** Latest HIFZ record per student, in one query. */
async function lastHifzByStudent(studentIds: string[]): Promise<Map<string, HifzPosition>> {
  if (studentIds.length === 0) return new Map();
  const rows = await db.$queryRaw<{ student_id: string; surah: number; to_ayah: number }[]>(Prisma.sql`
    SELECT DISTINCT ON (student_id) student_id, surah, to_ayah
    FROM recitations
    WHERE type = 'HIFZ' AND student_id = ANY(${studentIds}::uuid[])
    ORDER BY student_id, date DESC, created_at DESC
  `);
  return new Map(rows.map((r) => [r.student_id, { surah: r.surah, toAyah: r.to_ayah }]));
}

/**
 * The students this user teaches, with their last memorised position, number
 * of records and attendance percentage. Aggregates are grouped queries over
 * the whole list, never one query per student.
 */
export async function listMyStudents(auth: AuthContext, params: { halaqaId?: string }): Promise<MyStudentsDTO> {
  assertRole(auth, ...STAFF);
  const options = await listHalaqaOptions(managedHalaqaWhere(auth));
  const selected = options.find((h) => h.id === params.halaqaId) ?? null;

  const members = await db.member.findMany({
    where: {
      AND: [teachableStudentWhere(auth), selected ? { studentProfile: { halaqaId: selected.id } } : {}],
    },
    select: { id: true, name: true, studentProfile: { select: { status: true, halaqaId: true } } },
  });
  const ids = members.map((m) => m.id);

  const [lastHifz, recitationCounts, attendanceGroups, labels] = await Promise.all([
    lastHifzByStudent(ids),
    db.recitation.groupBy({ by: ["studentId"], where: { studentId: { in: ids } }, _count: { _all: true } }),
    db.attendance.groupBy({ by: ["studentId", "status"], where: { studentId: { in: ids } }, _count: { _all: true } }),
    halaqaLabelMap(),
  ]);
  const countOf = new Map(recitationCounts.map((g) => [g.studentId, g._count._all]));
  const attendanceOf = new Map<string, StatusCounts>();
  for (const g of attendanceGroups) {
    let counts = attendanceOf.get(g.studentId);
    if (!counts) attendanceOf.set(g.studentId, (counts = emptyCounts()));
    counts[g.status] = g._count._all;
  }

  const students: StudentRowDTO[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    halaqaLabel: (m.studentProfile?.halaqaId && labels.get(m.studentProfile.halaqaId)?.label) || "غير محدد",
    dropped: m.studentProfile?.status === "DROPPED",
    lastHifz: lastHifz.get(m.id) ?? null,
    recitationCount: countOf.get(m.id) ?? 0,
    attendanceRate: attendanceRate(attendanceOf.get(m.id) ?? emptyCounts()),
  }));
  students.sort((a, b) => Number(a.dropped) - Number(b.dropped) || a.name.localeCompare(b.name, "ar"));

  return {
    halaqat: options.map((h) => ({ id: h.id, label: h.label })),
    halaqaId: selected?.id ?? null,
    students,
  };
}

// ───────────────────────── One student's record ─────────────────────────

export interface RecitationDTO {
  id: string;
  date: ISODate;
  type: RecitationType;
  surah: number;
  fromAyah: number;
  toAyah: number;
  grade: string;
  note: string;
  recordedByName: string | null;
  /** Whether the viewer may delete it: whoever recorded it, or an admin. */
  canDelete: boolean;
}

export interface AttendanceEntryDTO {
  date: ISODate;
  status: AttendanceStatus;
}

export interface StudentRecordDTO {
  student: {
    id: string;
    name: string;
    dropped: boolean;
    halaqaLabel: string | null;
    placeName: string | null;
    schedule: string;
    teacherName: string | null;
  };
  stats: {
    lastHifz: HifzPosition | null;
    /** Sum of the HIFZ ranges. */
    hifzAyat: number;
    recitationCount: number;
    attendanceRate: number | null;
    attendanceCounts: StatusCounts;
  };
  /** Newest first. */
  recitations: RecitationDTO[];
  /** Newest first. */
  attendance: AttendanceEntryDTO[];
  /** Whether the viewer may add a recitation for this student. */
  canRecord: boolean;
}

const isStaff = (auth: AuthContext) => (STAFF as readonly string[]).includes(auth.role);

/** Callers must have checked that `auth` may see this student. */
async function loadRecord(auth: AuthContext, studentId: string): Promise<StudentRecordDTO & { extra: unknown }> {
  const member = await db.member.findFirst({
    where: { id: studentId, role: "STUDENT" },
    select: { id: true, name: true, extra: true, studentProfile: { select: { status: true, halaqaId: true } } },
  });
  if (!member) throw new NotFoundError("الطالب غير موجود");

  const [recitations, attendance, labels] = await Promise.all([
    db.recitation.findMany({
      where: { studentId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { recordedBy: { select: { name: true } } },
    }),
    db.attendance.findMany({ where: { studentId }, orderBy: { date: "desc" }, select: { date: true, status: true } }),
    halaqaLabelMap(),
  ]);
  const halaqa = member.studentProfile?.halaqaId ? labels.get(member.studentProfile.halaqaId) : undefined;
  const dropped = member.studentProfile?.status === "DROPPED";
  const staff = isStaff(auth);
  const counts = countStatuses(attendance.map((a) => a.status));
  const last = findLastHifz(recitations);

  return {
    student: {
      id: member.id,
      name: member.name,
      dropped,
      halaqaLabel: halaqa?.label ?? null,
      placeName: halaqa?.placeName ?? null,
      schedule: halaqa?.schedule ?? "",
      teacherName: halaqa?.teacherName ?? null,
    },
    stats: {
      lastHifz: last ? { surah: last.surah, toAyah: last.toAyah } : null,
      hifzAyat: hifzAyatCount(recitations),
      recitationCount: recitations.length,
      attendanceRate: attendanceRate(counts),
      attendanceCounts: counts,
    },
    recitations: recitations.map((r) => ({
      id: r.id,
      date: toISODate(r.date),
      type: r.type,
      surah: r.surah,
      fromAyah: r.fromAyah,
      toAyah: r.toAyah,
      grade: r.grade ?? "",
      note: r.note,
      recordedByName: r.recordedBy?.name ?? null,
      canDelete: staff && (auth.role === "ADMIN" || r.recordedById === auth.memberId),
    })),
    attendance: attendance.map((a) => ({ date: toISODate(a.date), status: a.status })),
    canRecord: staff && !dropped,
    extra: member.extra,
  };
}

/** A student's full log, for the staff who teach them. */
export async function getStudentRecord(auth: AuthContext, studentId: string): Promise<StudentRecordDTO> {
  assertRole(auth, ...STAFF);
  if (!z.uuid().safeParse(studentId).success) throw new NotFoundError("الطالب غير موجود");
  await assertCanSeeStudent(auth, studentId);
  const { extra: _extra, ...record } = await loadRecord(auth, studentId);
  return record;
}

export interface MyRecordDTO extends StudentRecordDTO {
  /** «بياناتي»: the admin-defined extra fields that have a value. */
  details: { label: string; value: string }[];
}

/** The signed-in student's own record. The id always comes from the session, never from the client. */
export async function getMyRecord(auth: AuthContext): Promise<MyRecordDTO> {
  assertRole(auth, "STUDENT");
  const [{ extra, ...record }, fields] = await Promise.all([loadRecord(auth, auth.memberId), listCustomFields("STUDENTS")]);
  const values = extra && typeof extra === "object" && !Array.isArray(extra) ? (extra as Record<string, unknown>) : {};
  const details = fields
    .map((f) => ({ label: f.label, value: values[f.key] == null ? "" : String(values[f.key]).trim() }))
    .filter((d) => d.value !== "");
  return { ...record, details };
}

// ───────────────────────── Mutations ─────────────────────────

export async function createRecitation(
  auth: AuthContext,
  input: z.output<typeof recitationSchema>,
): Promise<{ id: string }> {
  assertRole(auth, ...STAFF);
  const student = await db.member.findFirst({
    where: { id: input.studentId, ...teachableStudentWhere(auth) },
    select: { studentProfile: { select: { status: true } } },
  });
  if (!student) throw new ForbiddenError("هذا الطالب ليس في حلقاتك");
  if (student.studentProfile?.status === "DROPPED") throw new ConflictError("الطالب منقطع، لا يُسجَّل له تسميع");

  // The schema already checks this; repeated here because the rule belongs to the service.
  const problem = validateAyahRange(input);
  if (problem) throw new ValidationError(problem.message, { [problem.field]: [problem.message] });

  return db.recitation.create({
    data: {
      studentId: input.studentId,
      date: fromISODate(input.date),
      type: input.type,
      surah: input.surah,
      fromAyah: input.fromAyah,
      toAyah: input.toAyah,
      grade: input.grade,
      note: input.note,
      recordedById: auth.memberId,
    },
    select: { id: true },
  });
}

/** A record may be removed by whoever recorded it, or by an admin. */
export async function deleteRecitation(auth: AuthContext, id: string): Promise<void> {
  assertRole(auth, ...STAFF);
  const existing = await db.recitation.findUnique({ where: { id }, select: { recordedById: true } });
  if (!existing) throw new NotFoundError("التسجيل غير موجود");
  if (auth.role !== "ADMIN" && existing.recordedById !== auth.memberId) {
    throw new ForbiddenError("لا يحذف التسجيل إلا من سجّله أو الإدارة");
  }
  await db.recitation.delete({ where: { id } });
}
