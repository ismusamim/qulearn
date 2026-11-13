import type { Role } from "@/lib/constants";
import { surahByNumber, surahName } from "@/lib/quran";

import { isJuz, juzRange, juzSpanRange, passageInRange } from "./juz";

/**
 * Exam types and who may run them:
 *  - FOLLOW_UP  متابعة — the halaqa's supervisor: 2–3 questions, notes reach the teacher
 *  - PERIODIC   دوري   — the halaqa's teacher or supervisor: one question in the new portion, 1–2 in revision
 *  - MASTERY    إتقان  — the halaqa's supervisor: 4 questions inside one juz
 *  - COMPETITION مسابقة — any supervisor: 2–5 questions as set by the competition level
 * The admin may run every type for every student.
 */
export const EXAM_TYPES = ["FOLLOW_UP", "PERIODIC", "MASTERY", "COMPETITION"] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  FOLLOW_UP: "متابعة",
  PERIODIC: "دوري",
  MASTERY: "إتقان",
  COMPETITION: "مسابقة",
};

const TYPE_ROLES: Record<ExamType, readonly Role[]> = {
  FOLLOW_UP: ["SUPERVISOR", "ADMIN"],
  PERIODIC: ["TEACHER", "SUPERVISOR", "ADMIN"],
  MASTERY: ["SUPERVISOR", "ADMIN"],
  COMPETITION: ["SUPERVISOR", "ADMIN"],
};

export function isExamType(value: unknown): value is ExamType {
  return (EXAM_TYPES as readonly unknown[]).includes(value);
}

/** The exam types a role may run at all (for some student). */
export function allowedExamTypes(role: Role): ExamType[] {
  return EXAM_TYPES.filter((type) => TYPE_ROLES[type].includes(role));
}

export interface ExaminerRelation {
  role: Role;
  /** The examiner teaches the student's halaqa. */
  isTeacherOfHalaqa: boolean;
  /** The examiner supervises the student's halaqa. */
  isSupervisorOfHalaqa: boolean;
}

/** May this user run an exam of this type for a student they relate to in this way? */
export function canExamine(type: ExamType, who: ExaminerRelation): boolean {
  if (who.role === "ADMIN") return true;
  if (!TYPE_ROLES[type].includes(who.role)) return false;
  switch (type) {
    case "PERIODIC":
      return who.role === "TEACHER" ? who.isTeacherOfHalaqa : who.isSupervisorOfHalaqa;
    case "FOLLOW_UP":
    case "MASTERY":
      return who.isSupervisorOfHalaqa;
    case "COMPETITION":
      return true;
  }
}

/** The types this user may run for one student. */
export function examinableTypes(who: ExaminerRelation): ExamType[] {
  return EXAM_TYPES.filter((type) => canExamine(type, who));
}

// ───────────── Questions ─────────────

export const LEVEL_QUESTION_COUNTS = [2, 3, 4, 5] as const;

export interface LevelRange {
  fromJuz: number;
  toJuz: number;
  questionCount: number;
}

/** How many questions an exam of this type may have. */
export function questionCountOptions(type: ExamType, level?: LevelRange | null): number[] {
  switch (type) {
    case "FOLLOW_UP":
    case "PERIODIC":
      return [2, 3];
    case "MASTERY":
      return [4];
    case "COMPETITION":
      return [level?.questionCount ?? 2];
  }
}

/** Row title: «جديد» / «مراجعة n» for periodic exams, «سؤال n» otherwise. */
export function questionLabel(type: ExamType, index: number, count: number): string {
  if (type !== "PERIODIC") return `سؤال ${index + 1}`;
  if (index === 0) return "جديد";
  return count > 2 ? `مراجعة ${index}` : "مراجعة";
}

/** «سورة البقرة (5–9)» */
export function positionText(q: { surah: number; fromAyah: number; toAyah: number }): string {
  const name = surahName(q.surah);
  if (!name) return "—";
  return `سورة ${name} (${q.fromAyah}${q.toAyah !== q.fromAyah ? `–${q.toAyah}` : ""})`;
}

export interface QuestionDraft {
  surah?: number | null;
  fromAyah?: number | null;
  /** Defaults to fromAyah. */
  toAyah?: number | null;
  mistakes?: number | null;
  prompts?: number | null;
  tajweedMistakes?: number | null;
}

export interface ExamDraft {
  type: ExamType;
  /** MASTERY */
  juz?: number | null;
  /** COMPETITION: the chosen level. */
  level?: LevelRange | null;
  questions: readonly QuestionDraft[];
}

const isCount = (n: number | null | undefined) => n == null || (Number.isInteger(n) && n >= 0);

/**
 * Everything about an exam that depends on its type: required juz / level,
 * number of questions, ayat inside the surah and, for mastery and competition
 * exams, inside the juz range. Returns the first problem as a message for the
 * user, or null. Used by the form (before sending) and by the server (always).
 */
export function examDraftError(draft: ExamDraft): string | null {
  const { type, questions } = draft;
  if (type === "MASTERY" && !isJuz(draft.juz)) return "اختر الجزء";
  if (type === "COMPETITION" && !draft.level) return "اختر المسابقة والمستوى";
  if (!questionCountOptions(type, draft.level).includes(questions.length)) return "عدد الأسئلة لا يوافق نوع الاختبار";

  const range =
    type === "MASTERY" && isJuz(draft.juz)
      ? juzRange(draft.juz)
      : type === "COMPETITION" && draft.level
        ? juzSpanRange(draft.level.fromJuz, draft.level.toJuz)
        : null;

  for (const [i, q] of questions.entries()) {
    const label = questionLabel(type, i, questions.length);
    const surah = q.surah ? surahByNumber(q.surah) : undefined;
    if (!surah || !q.fromAyah) return `حدّد موضع «${label}»`;
    const from = q.fromAyah;
    const to = q.toAyah || from;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || from > surah.ayat || to < from || to > surah.ayat) {
      return `آيات «${label}» غير صحيحة (سورة ${surah.name} ${surah.ayat} آية)`;
    }
    if (![q.mistakes, q.prompts, q.tajweedMistakes].every(isCount)) return "عدد الأخطاء لا يكون سالبًا";
    if (range && !passageInRange(surah.number, from, to, range)) {
      return type === "MASTERY"
        ? `موضع «${label}» خارج الجزء ${draft.juz}`
        : `موضع «${label}» خارج أجزاء المستوى (من ${draft.level?.fromJuz} إلى ${draft.level?.toJuz})`;
    }
  }
  return null;
}
