import { z } from "zod";

import { INPUT_KEYS, JOB_TITLES, WORK_SYSTEMS } from "./constants";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A number typed in a form field: "" / null → null. Stored with two decimals. */
const optionalNumber = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.coerce
      .number<number | string | null>({ error: "اكتب رقمًا صحيحًا" })
      .min(-max, "الرقم خارج الحدود")
      .max(max, "الرقم كبير جدًا")
      .transform(round2)
      .nullable(),
  );

const HOURS_MAX = 99_999;
const MONEY_MAX = 99_999_999;

export const monthSchema = z.object({
  year: z.coerce.number().int().min(2000, "السنة غير صحيحة").max(2100, "السنة غير صحيحة"),
  month: z.coerce.number().int().min(1, "الشهر غير صحيح").max(12, "الشهر غير صحيح"),
});
export type MonthInput = z.output<typeof monthSchema>;

export const idSchema = z.object({ id: z.uuid() });

// ───────────── Employees ─────────────

export const employeeSchema = z.object({
  code: z.string().trim().max(30).default(""),
  name: z.string().trim().min(1, "اكتب اسم الموظف").max(120),
  jobTitle: z.enum(JOB_TITLES, { error: "اختر الوظيفة" }),
  workSystem: z.enum(["", ...WORK_SYSTEMS]).default(""),
  status: z.enum(["ACTIVE", "STOPPED"]).default("ACTIVE"),
  basic: optionalNumber(MONEY_MAX),
  rate: optionalNumber(MONEY_MAX),
  incentive: optionalNumber(MONEY_MAX),
  transport: optionalNumber(MONEY_MAX),
  hours: optionalNumber(HOURS_MAX),
  place: z.string().trim().max(120).default(""),
  note: z.string().trim().max(1000).default(""),
  /** Linked login account ("" = none). */
  memberId: z.union([z.uuid(), z.literal("")]).default(""),
});
export type EmployeeInput = z.input<typeof employeeSchema>;

export const updateEmployeeSchema = employeeSchema.extend({ id: z.uuid() });

export const employeeStatusSchema = z.object({ id: z.uuid(), status: z.enum(["ACTIVE", "STOPPED"]) });

// ───────────── Month sheet ─────────────

const hoursKeys = new Set<string>([
  "baseHours",
  "extraHours",
  "exceptionalHours",
  "absentWithPermission",
  "absentNoPermission",
  "meetingsWithPermission",
  "meetingsNoPermission",
]);

const rowValuesShape = Object.fromEntries(
  INPUT_KEYS.map((key) => [key, optionalNumber(hoursKeys.has(key) ? HOURS_MAX : MONEY_MAX)]),
) as Record<(typeof INPUT_KEYS)[number], ReturnType<typeof optionalNumber>>;

/** A whole row is saved at once (the grid debounces per row). */
export const updateRowSchema = z.object({ id: z.uuid(), values: z.object(rowValuesShape) });

export const addRowSchema = monthSchema.extend({ employeeId: z.uuid("اختر الموظف") });

// ───────────── Settings and PIN ─────────────

const rule = (label: string) =>
  z.coerce.number<number | string>({ error: `${label}: اكتب رقمًا` }).min(0, `${label}: لا يقل عن صفر`).max(MONEY_MAX);

export const settingsSchema = z.object({
  absenceWithPermission: rule("خصم ساعة الغياب بإذن"),
  absenceNoPermission: rule("خصم ساعة الغياب بدون إذن"),
  meetingWithPermission: rule("خصم غياب الاجتماع بإذن"),
  meetingNoPermission: rule("خصم غياب الاجتماع بغير إذن"),
  roundTo: z.coerce
    .number<number | string>({ error: "التقريب: اكتب رقمًا" })
    .int("التقريب يجب أن يكون عددًا صحيحًا")
    .min(1, "التقريب يجب أن يكون أكبر من صفر")
    .max(10_000),
  leaveDays3: z.coerce.number<number | string>({ error: "اكتب رقمًا" }).int("عدد الأيام عدد صحيح").min(0).max(366),
  leaveDays6: z.coerce.number<number | string>({ error: "اكتب رقمًا" }).int("عدد الأيام عدد صحيح").min(0).max(366),
  defaultHours: rule("الساعات الأساسية").max(HOURS_MAX),
});
export type SettingsInput = z.input<typeof settingsSchema>;

const pin = z.string().trim().min(4, "الرمز لا يقل عن 4 خانات").max(64, "الرمز طويل جدًا");

/** `pin: ""` removes the protection. */
export const setPinSchema = z.object({ pin: z.union([pin, z.literal("")]) });

export const unlockSchema = z.object({ pin: z.string().trim().min(1, "اكتب الرمز").max(64) });
