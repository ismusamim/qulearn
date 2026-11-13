import "server-only";

import type { z } from "zod";

import { ageFromBirthDate, toISODate } from "@/lib/dates";
import type { HalaqaSchedule } from "@/lib/domain/halaqa";
import { SURAHS } from "@/lib/quran";
import { type AuthContext, assertRole } from "@/server/auth";
import { db } from "@/server/db";
import { listAllHalaqaOptions, listMemberOptions, type MemberOption } from "@/server/directory";
import { NotFoundError, ValidationError } from "@/server/errors";

import type { halaqaSchema, updateHalaqaSchema } from "./schemas";
import { scheduleToModel } from "./schedule";

/** A halaqa as the admin's list shows it. `label` and `schedule` are ready-to-display text. */
export interface HalaqaDTO extends HalaqaSchedule {
  id: string;
  label: string;
  /** Stored fallback name; only meaningful while there is no teacher. */
  name: string;
  schedule: string;
  teacherId: string | null;
  teacherName: string | null;
  supervisorId: string | null;
  supervisorName: string | null;
  placeId: string | null;
  placeName: string | null;
  studentCount: number;
}

export interface HalaqaStudentDTO {
  id: string;
  name: string;
  photo: string | null;
  category: "CHILD" | "ADULT";
  age: number | null;
  status: "ACTIVE" | "DROPPED";
  phone: string;
  /** «سورة البقرة – آية 25», or null when nothing was memorised yet. */
  lastHifz: string | null;
  /** Percentage of recorded days the student was present or late; null when never recorded. */
  attendanceRate: number | null;
}

export interface HalaqaStudentsDTO {
  halaqa: HalaqaDTO;
  activeCount: number;
  droppedCount: number;
  students: HalaqaStudentDTO[];
}

export interface HalaqaFormOptions {
  teachers: MemberOption[];
  supervisors: MemberOption[];
}

/** All halaqat with their display label, in label order. Admin only. */
export async function listHalaqat(auth: AuthContext): Promise<HalaqaDTO[]> {
  assertRole(auth, "ADMIN");
  const [options, rows] = await Promise.all([
    listAllHalaqaOptions(),
    db.halaqa.findMany({
      select: { id: true, name: true, scheduleMode: true, startTime: true, endTime: true, startPrayer: true, endPrayer: true },
    }),
  ]);
  const raw = new Map(rows.map((r) => [r.id, r]));
  return options
    .map((o) => {
      const r = raw.get(o.id);
      return {
        ...o,
        name: r?.name ?? "",
        scheduleMode: r?.scheduleMode ?? null,
        startTime: r?.startTime ?? null,
        endTime: r?.endTime ?? null,
        startPrayer: r?.startPrayer ?? null,
        endPrayer: r?.endPrayer ?? null,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "ar"));
}

/** Teachers and supervisors for the halaqa form's dropdowns. */
export async function getHalaqaFormOptions(auth: AuthContext): Promise<HalaqaFormOptions> {
  assertRole(auth, "ADMIN");
  const [teachers, supervisors] = await Promise.all([listMemberOptions("TEACHER"), listMemberOptions("SUPERVISOR")]);
  return { teachers, supervisors };
}

/** One halaqa with its students (regular ones first), their last memorised position and attendance rate. */
export async function getHalaqaStudents(auth: AuthContext, halaqaId: string): Promise<HalaqaStudentsDTO | null> {
  assertRole(auth, "ADMIN");
  const halaqa = (await listHalaqat(auth)).find((h) => h.id === halaqaId);
  if (!halaqa) return null;

  const members = await db.member.findMany({
    where: { role: "STUDENT", studentProfile: { halaqaId } },
    select: {
      id: true,
      name: true,
      photo: true,
      phone: true,
      studentProfile: {
        select: { category: true, status: true, birthDate: true, birthYear: true, phone: true, guardianPhone: true },
      },
    },
  });
  const ids = members.map((m) => m.id);

  // Two grouped queries for the whole halaqa instead of two per student.
  const [attendance, hifz] = await Promise.all([
    db.attendance.groupBy({ by: ["studentId", "status"], where: { studentId: { in: ids } }, _count: { _all: true } }),
    db.recitation.findMany({
      where: { studentId: { in: ids }, type: "HIFZ" },
      orderBy: [{ studentId: "asc" }, { date: "desc" }, { createdAt: "desc" }],
      distinct: ["studentId"],
      select: { studentId: true, surah: true, toAyah: true },
    }),
  ]);
  const attended = new Map<string, { ok: number; total: number }>();
  for (const row of attendance) {
    const entry = attended.get(row.studentId) ?? { ok: 0, total: 0 };
    entry.total += row._count._all;
    if (row.status === "PRESENT" || row.status === "LATE") entry.ok += row._count._all;
    attended.set(row.studentId, entry);
  }
  const lastHifz = new Map(hifz.map((r) => [r.studentId, `سورة ${SURAHS[r.surah - 1]?.name ?? r.surah} – آية ${r.toAyah}`]));
  const thisYear = new Date().getFullYear();

  const students: HalaqaStudentDTO[] = members.map((m) => {
    const p = m.studentProfile;
    const att = attended.get(m.id);
    return {
      id: m.id,
      name: m.name,
      photo: m.photo,
      category: p?.category ?? "CHILD",
      age: p?.birthDate ? ageFromBirthDate(toISODate(p.birthDate)) : p?.birthYear ? thisYear - p.birthYear : null,
      status: p?.status ?? "ACTIVE",
      phone: p?.phone || m.phone || p?.guardianPhone || "",
      lastHifz: lastHifz.get(m.id) ?? null,
      attendanceRate: att?.total ? Math.round((att.ok * 100) / att.total) : null,
    };
  });
  students.sort(
    (a, b) => Number(a.status === "DROPPED") - Number(b.status === "DROPPED") || a.name.localeCompare(b.name, "ar"),
  );
  const droppedCount = students.filter((s) => s.status === "DROPPED").length;
  return { halaqa, activeCount: students.length - droppedCount, droppedCount, students };
}

type HalaqaData = z.output<typeof halaqaSchema>;

/** Checks the referenced rows exist with the right role, and builds the column values. */
async function toColumns(input: HalaqaData) {
  const teacherId = input.teacherId || null;
  const supervisorId = input.supervisorId || null;
  const [place, teacher, supervisor] = await Promise.all([
    db.place.findUnique({ where: { id: input.placeId }, select: { id: true } }),
    teacherId ? db.member.findFirst({ where: { id: teacherId, role: "TEACHER" }, select: { id: true } }) : null,
    supervisorId ? db.member.findFirst({ where: { id: supervisorId, role: "SUPERVISOR" }, select: { id: true } }) : null,
  ]);
  if (!place) throw new ValidationError("المكان غير موجود", { placeId: ["المكان غير موجود"] });
  if (teacherId && !teacher) throw new ValidationError("المعلم غير موجود", { teacherId: ["المعلم غير موجود"] });
  if (supervisorId && !supervisor) throw new ValidationError("المشرف غير موجود", { supervisorId: ["المشرف غير موجود"] });
  return {
    placeId: input.placeId,
    teacherId,
    supervisorId,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...scheduleToModel(input),
  };
}

export async function createHalaqa(auth: AuthContext, input: HalaqaData): Promise<{ id: string }> {
  assertRole(auth, "ADMIN");
  return db.halaqa.create({ data: await toColumns(input), select: { id: true } });
}

export async function updateHalaqa(auth: AuthContext, input: z.output<typeof updateHalaqaSchema>): Promise<void> {
  assertRole(auth, "ADMIN");
  const { id, ...data } = input;
  const existing = await db.halaqa.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("الحلقة غير موجودة");
  await db.halaqa.update({ where: { id }, data: await toColumns(data) });
}

/** Deleting a halaqa keeps its students; they simply lose their halaqa (FK is ON DELETE SET NULL). */
export async function deleteHalaqa(auth: AuthContext, id: string): Promise<void> {
  assertRole(auth, "ADMIN");
  const existing = await db.halaqa.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("الحلقة غير موجودة");
  await db.halaqa.delete({ where: { id } });
}
