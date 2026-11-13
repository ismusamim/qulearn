import { z } from "zod";

import { isISODate } from "@/lib/dates";

import { EXAM_TYPES } from "./rules";
import { markingSettingsError } from "./scoring";

const count = z.number("اكتب رقمًا صحيحًا").int("اكتب رقمًا صحيحًا").min(0, "عدد الأخطاء لا يكون سالبًا").max(999);

/**
 * One question as typed by the examiner: where it is and the raw counts.
 * Scores are never sent — the server computes them from the current settings.
 */
export const examQuestionSchema = z.object({
  surah: z.number("حدّد السورة").int().min(1, "حدّد السورة").max(114),
  fromAyah: z.number("حدّد الآية").int().min(1, "حدّد الآية").max(286),
  /** Empty means a single ayah (same as fromAyah). */
  toAyah: z.number().int().min(1).max(286).optional(),
  mistakes: count.default(0),
  prompts: count.default(0),
  tajweedMistakes: count.default(0),
});

const examFields = {
  date: z.string().refine(isISODate, "اختر التاريخ"),
  /** MASTERY only. */
  juz: z.number().int().min(1).max(30).nullish(),
  /** COMPETITION only. */
  competitionId: z.uuid().nullish(),
  levelId: z.uuid().nullish(),
  // Type-dependent rules (count, ayat, juz range) live in examDraftError (rules.ts).
  questions: z.array(examQuestionSchema).min(2, "أضف الأسئلة").max(5),
  note: z.string().trim().max(2000).default(""),
};

export const createExamSchema = z.object({
  type: z.enum(EXAM_TYPES),
  studentId: z.uuid("اختر الطالب"),
  ...examFields,
});
export type CreateExamInput = z.input<typeof createExamSchema>;

/** Type and student of an exam never change. */
export const updateExamSchema = z.object({ id: z.uuid(), ...examFields });

export const examIdSchema = z.object({ id: z.uuid() });

export const suggestQuestionsSchema = z.object({
  type: z.enum(EXAM_TYPES),
  /** Needed for follow-up and periodic exams (questions come from what the student memorised). */
  studentId: z.uuid().nullish(),
  count: z.number().int().min(1).max(5),
  juz: z.number().int().min(1).max(30).nullish(),
  levelId: z.uuid().nullish(),
});

// ───────────── Admin: marking settings ─────────────

const points = (message: string) => z.number(message).min(0, message).max(1000);
const percent = z.number("اكتب نسبة مئوية").int("اكتب نسبة صحيحة").min(0).max(100);

export const markingSettingsSchema = z
  .object({
    questionScore: z.number("درجة السؤال أكبر من صفر").positive("درجة السؤال أكبر من صفر").max(1000),
    mistakePenalty: points("قيم الخصم لا تكون سالبة"),
    promptPenalty: points("قيم الخصم لا تكون سالبة"),
    tajweedPenalty: points("قيم الخصم لا تكون سالبة"),
    excellentFrom: percent,
    veryGoodFrom: percent,
    goodFrom: percent,
    passFrom: percent,
  })
  .superRefine((value, ctx) => {
    const error = markingSettingsError(value);
    if (error) ctx.addIssue({ code: "custom", message: error, path: ["excellentFrom"] });
  });
export type MarkingSettingsInput = z.input<typeof markingSettingsSchema>;

// ───────────── Admin: competitions and levels ─────────────

export const competitionSchema = z.object({
  name: z.string().trim().min(1, "اكتب اسم المسابقة").max(120),
});
export type CompetitionInput = z.input<typeof competitionSchema>;
export const updateCompetitionSchema = competitionSchema.extend({ id: z.uuid() });
export const competitionIdSchema = z.object({ id: z.uuid() });

const juz = z.number("الأجزاء من 1 إلى 30").int("الأجزاء من 1 إلى 30").min(1, "الأجزاء من 1 إلى 30").max(30, "الأجزاء من 1 إلى 30");

const levelFields = z.object({
  name: z.string().trim().min(1, "اكتب اسم المستوى").max(120),
  fromJuz: juz,
  toJuz: juz,
  questionCount: z.number().int().min(2, "عدد الأسئلة من 2 إلى 5").max(5, "عدد الأسئلة من 2 إلى 5"),
});
const juzInOrder = (v: { fromJuz: number; toJuz: number }) => v.fromJuz <= v.toJuz;
const juzOrderError = { message: "الأجزاء من 1 إلى 30، و«من» لا تزيد على «إلى»", path: ["toJuz"] };

/** Form values of a level (the same for create and edit). */
export const levelSchema = levelFields.refine(juzInOrder, juzOrderError);
export type LevelInput = z.input<typeof levelSchema>;
export const createLevelSchema = levelFields.extend({ competitionId: z.uuid() }).refine(juzInOrder, juzOrderError);
export const updateLevelSchema = levelFields.extend({ id: z.uuid() }).refine(juzInOrder, juzOrderError);
export const levelIdSchema = z.object({ id: z.uuid() });
