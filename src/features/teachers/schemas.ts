import { z } from "zod";

import { toLatinDigits } from "@/lib/arabic";
import { isISODate } from "@/lib/dates";

import { TEACHER_STATUSES } from "./profile";

const text = (max = 200) => z.string().trim().max(max, "النص أطول من المسموح");

/** Date-only input: "" (not set) or "YYYY-MM-DD". */
const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || isISODate(v), "التاريخ غير صحيح");

const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === "" || z.email().safeParse(v).success, "البريد الإلكتروني غير صحيح");

/**
 * Optional number typed into a text box: "" → null. Accepts Arabic digits and
 * an already-parsed number, so the same schema validates the form on the
 * client and its (already transformed) values again in the server action.
 */
function optionalNumber(options: { min: number; max: number; integer?: boolean; message: string }) {
  return z.union([z.string(), z.number(), z.null()]).transform((value, ctx): number | null => {
    if (value === null) return null;
    const raw = typeof value === "number" ? String(value) : toLatinDigits(value).trim();
    if (raw === "") return null;
    const n = Number(raw);
    const valid = Number.isFinite(n) && (!options.integer || Number.isInteger(n)) && n >= options.min && n <= options.max;
    if (!valid) {
      ctx.addIssue({ code: "custom", message: options.message });
      return z.NEVER;
    }
    return n;
  });
}

const personalFields = {
  fullName: text(),
  birthDate: optionalDate,
  phone: text(30),
  email: optionalEmail,
  address: text(300),
  emergencyContact: text(300),
};

const administrativeFields = {
  employeeNo: text(60),
  joinDate: optionalDate,
  contractType: text(60),
  status: z.enum(TEACHER_STATUSES, "اختر الحالة"),
  monthlyPay: optionalNumber({ min: 0, max: 9_999_999, message: "المكافأة الشهرية رقم غير صحيح" }),
  adminNote: text(2000),
};

const technicalFields = {
  qualification: text(),
  riwaya: text(60),
  ijaza: text(60),
  sanad: text(300),
  memorizedParts: optionalNumber({ min: 0, max: 30, integer: true, message: "الأجزاء المحفوظة من 0 إلى 30" }),
  experienceYears: optionalNumber({ min: 0, max: 80, integer: true, message: "سنوات الخبرة رقم غير صحيح" }),
  specialty: text(300),
  courses: text(2000),
};

/** Values of admin-defined custom fields, keyed by CustomField.key. */
const extraValues = z.record(z.string().max(100), z.string().trim().max(2000, "النص أطول من المسموح"));

const name = z.string().trim().min(1, "اكتب الاسم").max(120, "الاسم أطول من المسموح");

// ───────────── Administration ─────────────

export const createTeacherSchema = z.object({ name, phone: text(30).default("") });
export type CreateTeacherInput = z.input<typeof createTeacherSchema>;

/** The admin's editor: the name plus all three sections, saved together. */
export const teacherFormSchema = z.object({ name, ...personalFields, ...administrativeFields, ...technicalFields });
export type TeacherFormInput = z.input<typeof teacherFormSchema>;
export type TeacherFormValues = z.output<typeof teacherFormSchema>;

export const updateTeacherSchema = teacherFormSchema.extend({ id: z.uuid(), extra: extraValues.default({}) });

export const teacherWorkingSchema = z.object({ id: z.uuid(), working: z.boolean() });

// ───────────── The teacher's own file («ملفي») ─────────────
// No id and no administrative field on purpose: the service always writes to the signed-in teacher.

export const myPersonalSchema = z.object(personalFields);
export type MyPersonalInput = z.input<typeof myPersonalSchema>;
export type MyPersonalValues = z.output<typeof myPersonalSchema>;

export const myTechnicalSchema = z.object(technicalFields);
export type MyTechnicalInput = z.input<typeof myTechnicalSchema>;
export type MyTechnicalValues = z.output<typeof myTechnicalSchema>;

export const myExtraSchema = z.object({ extra: extraValues });
