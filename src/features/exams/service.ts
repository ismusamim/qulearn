import "server-only";

import type { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { fromISODate, toISODate } from "@/lib/dates";
import { surahByNumber } from "@/lib/quran";
import { type AuthContext, assertRole, teachableStudentWhere } from "@/server/auth";
import { db } from "@/server/db";
import { halaqaLabelMap } from "@/server/directory";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";

import {
  type ExaminerRelation,
  type ExamType,
  type LevelRange,
  allowedExamTypes,
  canExamine,
  examDraftError,
  examinableTypes,
  questionLabel,
} from "./rules";
import type { createExamSchema, suggestQuestionsSchema, updateExamSchema } from "./schemas";
import { markExam } from "./scoring";
import { readMarkingSettings } from "./settings-service";
import { type SuggestedPosition, recitationRange, suggestPositions } from "./suggest";

const STAFF = ["TEACHER", "SUPERVISOR", "ADMIN"] as const;

// ───────────── DTOs ─────────────

export interface ExamSummaryDTO {
  id: string;
  date: string;
  type: ExamType;
  studentId: string;
  studentName: string;
  halaqaLabel: string;
  juz: number | null;
  competitionName: string | null;
  levelName: string | null;
  examinerName: string | null;
  total: number | null;
  maxScore: number | null;
  grade: string | null;
  /** Edit and delete: the admin or whoever ran the exam. */
  canModify: boolean;
}

export interface ExamQuestionDTO {
  label: string;
  surah: number;
  fromAyah: number;
  toAyah: number;
  mistakes: number;
  prompts: number;
  tajweedMistakes: number;
  score: number;
}

export interface ExamDetailDTO extends ExamSummaryDTO {
  competitionId: string | null;
  levelId: string | null;
  note: string;
  questions: ExamQuestionDTO[];
}

export interface ExaminableStudentDTO {
  id: string;
  name: string;
  halaqaLabel: string;
  /** The exam types the current user may run for this student. */
  types: ExamType[];
}

export interface SupervisorNoteDTO {
  id: string;
  date: string;
  studentName: string;
  examinerName: string | null;
  total: number | null;
  maxScore: number | null;
  grade: string | null;
  note: string;
}

// ───────────── Access ─────────────

/**
 * Who may read an exam: the admin, whoever ran it, the student, and the
 * teacher / supervisor of the student's (current) halaqa.
 */
function readableExamWhere(auth: AuthContext): Prisma.ExamWhereInput {
  if (auth.role === "ADMIN") return {};
  const me = auth.memberId;
  return {
    OR: [
      { examinerId: me },
      { studentId: me },
      { student: { studentProfile: { halaqa: { is: { OR: [{ teacherId: me }, { supervisorId: me }] } } } } },
    ],
  };
}

const canModify = (auth: AuthContext, exam: { examinerId: string | null }) =>
  auth.role === "ADMIN" || exam.examinerId === auth.memberId;

/** How the current user relates to a student's halaqa (input of the pure `canExamine` rule). */
async function relationToStudent(auth: AuthContext, studentId: string): Promise<{ relation: ExaminerRelation; halaqaId: string | null }> {
  const student = await db.member.findFirst({
    where: { id: studentId, role: "STUDENT" },
    select: { studentProfile: { select: { halaqaId: true, halaqa: { select: { teacherId: true, supervisorId: true } } } } },
  });
  if (!student) throw new NotFoundError("الطالب غير موجود");
  const halaqa = student.studentProfile?.halaqa;
  return {
    halaqaId: student.studentProfile?.halaqaId ?? null,
    relation: {
      role: auth.role,
      isTeacherOfHalaqa: halaqa?.teacherId === auth.memberId,
      isSupervisorOfHalaqa: halaqa?.supervisorId === auth.memberId,
    },
  };
}

async function assertCanExamine(auth: AuthContext, type: ExamType, studentId: string): Promise<{ halaqaId: string | null }> {
  const { relation, halaqaId } = await relationToStudent(auth, studentId);
  if (!canExamine(type, relation)) throw new ForbiddenError("لا يحق لك إجراء هذا النوع من الاختبارات لهذا الطالب");
  return { halaqaId };
}

// ───────────── Reading ─────────────

const summarySelect = {
  id: true,
  date: true,
  type: true,
  studentId: true,
  halaqaId: true,
  juz: true,
  competitionId: true,
  competitionName: true,
  levelId: true,
  levelName: true,
  examinerId: true,
  examinerName: true,
  total: true,
  maxScore: true,
  grade: true,
  note: true,
  student: { select: { name: true, studentProfile: { select: { halaqaId: true } } } },
} satisfies Prisma.ExamSelect;

const detailSelect = {
  ...summarySelect,
  questions: { orderBy: { position: "asc" } },
} satisfies Prisma.ExamSelect;

type SummaryRow = Prisma.ExamGetPayload<{ select: typeof summarySelect }>;
type DetailRow = Prisma.ExamGetPayload<{ select: typeof detailSelect }>;
type HalaqaLabels = Awaited<ReturnType<typeof halaqaLabelMap>>;

const num = (value: { toString(): string } | null): number | null => (value == null ? null : Number(value));

function toSummary(auth: AuthContext, row: SummaryRow, halaqat: HalaqaLabels): ExamSummaryDTO {
  // The student's current halaqa; the one stamped on the exam when they have none now.
  const halaqaId = row.student.studentProfile?.halaqaId ?? row.halaqaId;
  return {
    id: row.id,
    date: toISODate(row.date),
    type: row.type,
    studentId: row.studentId,
    studentName: row.student.name,
    halaqaLabel: (halaqaId && halaqat.get(halaqaId)?.label) || "",
    juz: row.juz,
    competitionName: row.competitionName,
    levelName: row.levelName,
    examinerName: row.examinerName,
    total: num(row.total),
    maxScore: num(row.maxScore),
    grade: row.grade,
    canModify: canModify(auth, row),
  };
}

function toDetail(auth: AuthContext, row: DetailRow, halaqat: HalaqaLabels): ExamDetailDTO {
  return {
    ...toSummary(auth, row, halaqat),
    competitionId: row.competitionId,
    levelId: row.levelId,
    note: row.note,
    questions: row.questions.map((q) => ({
      label: q.label,
      surah: q.surah,
      fromAyah: q.fromAyah,
      toAyah: q.toAyah,
      mistakes: q.mistakes,
      prompts: q.prompts,
      tajweedMistakes: q.tajweedMistakes,
      score: Number(q.score),
    })),
  };
}

const newestFirst = [{ date: "desc" }, { createdAt: "desc" }] satisfies Prisma.ExamOrderByWithRelationInput[];

/** Every exam the user may read, newest first, optionally of one type. */
export async function listExams(auth: AuthContext, filter: { type?: ExamType } = {}): Promise<ExamSummaryDTO[]> {
  assertRole(auth, ...STAFF);
  const [rows, halaqat] = await Promise.all([
    db.exam.findMany({
      where: { AND: [readableExamWhere(auth), filter.type ? { type: filter.type } : {}] },
      select: summarySelect,
      orderBy: newestFirst,
    }),
    halaqaLabelMap(),
  ]);
  return rows.map((row) => toSummary(auth, row, halaqat));
}

/** One exam with its questions; null when it does not exist or is not the user's to read. */
export async function findExam(auth: AuthContext, id: string): Promise<ExamDetailDTO | null> {
  const row = await db.exam.findFirst({ where: { AND: [{ id }, readableExamWhere(auth)] }, select: detailSelect });
  return row ? toDetail(auth, row, await halaqaLabelMap()) : null;
}

/**
 * A student's results, with the questions — for the student's own progress page
 * and for staff. Returns only the exams the caller may read: all of them for
 * the admin, the student and the halaqa's teacher / supervisor; for anyone else
 * just the exams they ran themselves.
 */
export async function listExamsForStudent(auth: AuthContext, studentId: string): Promise<ExamDetailDTO[]> {
  const [rows, halaqat] = await Promise.all([
    db.exam.findMany({
      where: { AND: [{ studentId }, readableExamWhere(auth)] },
      select: detailSelect,
      orderBy: newestFirst,
    }),
    halaqaLabelMap(),
  ]);
  return rows.map((row) => toDetail(auth, row, halaqat));
}

/** Students the user may examine, each with the exam types allowed for them. */
export async function listExaminableStudents(auth: AuthContext): Promise<ExaminableStudentDTO[]> {
  assertRole(auth, ...STAFF);
  // Supervisors run competition exams for any student, so only teachers are limited to their halaqat here.
  const where: Prisma.MemberWhereInput = auth.role === "TEACHER" ? teachableStudentWhere(auth) : { role: "STUDENT" };
  const [rows, halaqat] = await Promise.all([
    db.member.findMany({
      where,
      select: {
        id: true,
        name: true,
        studentProfile: { select: { halaqaId: true, halaqa: { select: { teacherId: true, supervisorId: true } } } },
      },
    }),
    halaqaLabelMap(),
  ]);
  return rows
    .map((s) => {
      const halaqa = s.studentProfile?.halaqa;
      const halaqaId = s.studentProfile?.halaqaId;
      return {
        id: s.id,
        name: s.name,
        halaqaLabel: (halaqaId && halaqat.get(halaqaId)?.label) || "",
        types: examinableTypes({
          role: auth.role,
          isTeacherOfHalaqa: halaqa?.teacherId === auth.memberId,
          isSupervisorOfHalaqa: halaqa?.supervisorId === auth.memberId,
        }),
      };
    })
    .filter((s) => s.types.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

/**
 * «ملاحظات المشرف على اختبارات المتابعة»: follow-up exams carrying a note, run by
 * someone else for students of the teacher's halaqat. The latest 30.
 */
export async function listSupervisorNotes(auth: AuthContext): Promise<SupervisorNoteDTO[]> {
  if (auth.role !== "TEACHER") return [];
  const rows = await db.exam.findMany({
    where: {
      type: "FOLLOW_UP",
      note: { not: "" },
      // `not` alone would also drop exams whose examiner account was deleted (NULL).
      OR: [{ examinerId: null }, { examinerId: { not: auth.memberId } }],
      student: teachableStudentWhere(auth),
    },
    select: { id: true, date: true, examinerName: true, total: true, maxScore: true, grade: true, note: true, student: { select: { name: true } } },
    orderBy: newestFirst,
    take: 30,
  });
  return rows.map((e) => ({
    id: e.id,
    date: toISODate(e.date),
    studentName: e.student.name,
    examinerName: e.examinerName,
    total: num(e.total),
    maxScore: num(e.maxScore),
    grade: e.grade,
    note: e.note,
  }));
}

// ───────────── Writing ─────────────

type ExamBody = Omit<z.output<typeof updateExamSchema>, "id">;

interface ResolvedLevel extends LevelRange {
  id: string;
  name: string;
  competitionId: string;
  competitionName: string;
}

async function findLevel(levelId: string | null | undefined, competitionId?: string | null): Promise<ResolvedLevel | null> {
  if (!levelId) return null;
  const level = await db.competitionLevel.findFirst({
    where: { id: levelId, ...(competitionId ? { competitionId } : {}) },
    select: { id: true, name: true, fromJuz: true, toJuz: true, questionCount: true, competition: { select: { id: true, name: true } } },
  });
  if (!level) return null;
  return {
    id: level.id,
    name: level.name,
    fromJuz: level.fromJuz,
    toJuz: level.toJuz,
    questionCount: level.questionCount,
    competitionId: level.competition.id,
    competitionName: level.competition.name,
  };
}

/**
 * Validates the type-dependent rules and marks the exam. Every score, the
 * total, the maximum and the grade are computed here from the raw counts and
 * the current settings; nothing of the sort is accepted from the client.
 */
async function buildExam(type: ExamType, input: ExamBody) {
  const level = type === "COMPETITION" ? await findLevel(input.levelId, input.competitionId) : null;
  const questions = input.questions.map((q) => ({ ...q, toAyah: q.toAyah ?? q.fromAyah }));
  const error = examDraftError({ type, juz: input.juz, level, questions });
  if (error) throw new ValidationError(error);

  const result = markExam(questions, await readMarkingSettings());
  return {
    result,
    fields: {
      date: fromISODate(input.date),
      juz: type === "MASTERY" ? (input.juz ?? null) : null,
      competitionId: level?.competitionId ?? null,
      competitionName: level?.competitionName ?? null,
      levelId: level?.id ?? null,
      levelName: level?.name ?? null,
      maxScore: result.maxScore,
      total: result.total,
      grade: result.grade,
      note: input.note,
    },
    questions: questions.map((q, i) => ({
      position: i + 1,
      label: questionLabel(type, i, questions.length),
      surah: q.surah,
      fromAyah: q.fromAyah,
      toAyah: q.toAyah,
      mistakes: q.mistakes,
      prompts: q.prompts,
      tajweedMistakes: q.tajweedMistakes,
      score: result.scores[i],
    })),
  };
}

export interface SavedExam {
  id: string;
  total: number;
  maxScore: number;
  grade: string;
}

/** The examiner (id and name) and the student's halaqa are stamped here, never taken from the client. */
export async function createExam(auth: AuthContext, input: z.output<typeof createExamSchema>): Promise<SavedExam> {
  assertRole(auth, ...STAFF);
  const { halaqaId } = await assertCanExamine(auth, input.type, input.studentId);
  const { result, fields, questions } = await buildExam(input.type, input);
  const exam = await db.exam.create({
    data: {
      ...fields,
      type: input.type,
      studentId: input.studentId,
      halaqaId,
      examinerId: auth.memberId,
      examinerName: auth.name,
      questions: { create: questions },
    },
    select: { id: true },
  });
  return { id: exam.id, total: result.total, maxScore: result.maxScore, grade: result.grade };
}

/**
 * Only the admin or whoever ran the exam may change it, and (unless admin) only
 * while they may still examine that student. Type, student, examiner and the
 * halaqa stamped at exam time stay as they were; the exam is re-marked with the
 * current settings.
 */
export async function updateExam(auth: AuthContext, input: z.output<typeof updateExamSchema>): Promise<SavedExam> {
  assertRole(auth, ...STAFF);
  const { id, ...body } = input;
  const existing = await db.exam.findUnique({ where: { id }, select: { type: true, studentId: true, examinerId: true } });
  if (!existing) throw new NotFoundError("الاختبار غير موجود");
  if (!canModify(auth, existing)) throw new ForbiddenError("لا يعدّل الاختبار إلا من أجراه أو المدير");
  await assertCanExamine(auth, existing.type, existing.studentId);

  const { result, fields, questions } = await buildExam(existing.type, body);
  await db.exam.update({ where: { id }, data: { ...fields, questions: { deleteMany: {}, create: questions } } });
  return { id, total: result.total, maxScore: result.maxScore, grade: result.grade };
}

export async function deleteExam(auth: AuthContext, id: string): Promise<void> {
  assertRole(auth, ...STAFF);
  const existing = await db.exam.findUnique({ where: { id }, select: { examinerId: true } });
  if (!existing) throw new NotFoundError("الاختبار غير موجود");
  if (!canModify(auth, existing)) throw new ForbiddenError("لا يحذف الاختبار إلا من أجراه أو المدير");
  await db.exam.delete({ where: { id } });
}

/** «اقتراح أسئلة»: random positions from the right range for the exam type. */
export async function suggestQuestions(
  auth: AuthContext,
  input: z.output<typeof suggestQuestionsSchema>,
): Promise<Array<SuggestedPosition | null>> {
  assertRole(auth, ...STAFF);
  const { type, count } = input;
  if (!allowedExamTypes(auth.role).includes(type)) throw new ForbiddenError();

  if (type === "MASTERY") {
    if (!input.juz) throw new ValidationError("اختر الجزء أولًا");
    return suggestPositions({ type, count, hifzRanges: [], juz: input.juz });
  }
  if (type === "COMPETITION") {
    const level = await findLevel(input.levelId);
    if (!level) throw new ValidationError("اختر المسابقة والمستوى أولًا");
    return suggestPositions({ type, count, hifzRanges: [], level });
  }

  // Follow-up and periodic questions come from what the student has memorised.
  if (!input.studentId) throw new ValidationError("اختر الطالب أولًا");
  await assertCanExamine(auth, type, input.studentId);
  const recitations = await db.recitation.findMany({
    where: { studentId: input.studentId, type: "HIFZ" },
    select: { surah: true, fromAyah: true, toAyah: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  const hifzRanges = recitations
    .filter((r) => {
      const ayat = surahByNumber(r.surah)?.ayat ?? 0;
      return r.fromAyah >= 1 && r.toAyah >= 1 && r.fromAyah <= ayat && r.toAyah <= ayat;
    })
    .map(recitationRange);
  return suggestPositions({ type, count, hifzRanges });
}
