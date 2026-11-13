/**
 * Marking by deduction: every question starts from `questionScore` and loses
 * points per mistake, per prompt (تنبيه) and per tajweed mistake. All values
 * are set by the admin («إعدادات التصحيح»).
 */

export interface MarkingSettings {
  questionScore: number;
  mistakePenalty: number;
  promptPenalty: number;
  tajweedPenalty: number;
  /** Minimum percentage for each grade; below `passFrom` is «ضعيف». */
  excellentFrom: number;
  veryGoodFrom: number;
  goodFrom: number;
  passFrom: number;
}

export const DEFAULT_MARKING: MarkingSettings = {
  questionScore: 10,
  mistakePenalty: 1,
  promptPenalty: 0.5,
  tajweedPenalty: 0.25,
  excellentFrom: 90,
  veryGoodFrom: 80,
  goodFrom: 65,
  passFrom: 50,
};

export const EXAM_GRADES = ["ممتاز", "جيد جدًا", "جيد", "مقبول", "ضعيف"] as const;
export type ExamGrade = (typeof EXAM_GRADES)[number];

export interface QuestionCounts {
  mistakes?: number | null;
  prompts?: number | null;
  tajweedMistakes?: number | null;
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Unset, negative or non-numeric counts are treated as zero. */
const count = (n: number | null | undefined): number => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);

/** Score of one question; never below zero. */
export function questionScore(q: QuestionCounts, s: MarkingSettings = DEFAULT_MARKING): number {
  const lost = count(q.mistakes) * s.mistakePenalty + count(q.prompts) * s.promptPenalty + count(q.tajweedMistakes) * s.tajweedPenalty;
  return round2(Math.max(0, s.questionScore - lost));
}

export function gradeOf(percent: number, s: MarkingSettings = DEFAULT_MARKING): ExamGrade {
  if (percent >= s.excellentFrom) return "ممتاز";
  if (percent >= s.veryGoodFrom) return "جيد جدًا";
  if (percent >= s.goodFrom) return "جيد";
  if (percent >= s.passFrom) return "مقبول";
  return "ضعيف";
}

export interface ExamResult {
  /** Score of each question, in order. */
  scores: number[];
  total: number;
  maxScore: number;
  /** Unrounded percentage of total out of maxScore (0 when there are no questions). */
  percent: number;
  grade: ExamGrade;
}

/** Scores, total, maximum and grade of a whole exam from the raw counts. */
export function markExam(questions: readonly QuestionCounts[], s: MarkingSettings = DEFAULT_MARKING): ExamResult {
  const scores = questions.map((q) => questionScore(q, s));
  const maxScore = round2(questions.length * s.questionScore);
  const total = round2(scores.reduce((a, b) => a + b, 0));
  const percent = maxScore ? (total * 100) / maxScore : 0;
  return { scores, total, maxScore, percent, grade: gradeOf(percent, s) };
}

/** Why a set of marking settings is unacceptable, or null when it is fine. */
export function markingSettingsError(s: MarkingSettings): string | null {
  if (!(s.questionScore > 0)) return "درجة السؤال أكبر من صفر";
  if (s.mistakePenalty < 0 || s.promptPenalty < 0 || s.tajweedPenalty < 0) return "قيم الخصم لا تكون سالبة";
  const descending =
    s.excellentFrom > s.veryGoodFrom && s.veryGoodFrom > s.goodFrom && s.goodFrom > s.passFrom && s.passFrom >= 0 && s.excellentFrom <= 100;
  if (!descending) return "حدود التقديرات تتناقص: ممتاز ثم جيد جدًا ثم جيد ثم مقبول";
  return null;
}
