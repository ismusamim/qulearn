import { z } from "zod";

import { normalizePhone, toLatinDigits } from "@/lib/arabic";
import { isISODate } from "@/lib/dates";
import { parseNationalId } from "@/lib/domain/national-id";

import { photoProblem } from "./student-rules";

const text = (max = 200) => z.string().trim().max(max);
const phone = z.string().trim().max(30).transform((v) => normalizePhone(v));

/** A date input: "" → null. */
const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || isISODate(v), "التاريخ غير صحيح")
  .transform((v) => v || null);

/** A numeric input kept as text in the form: "" → null. */
const optionalNumber = (min: number, max: number, message: string) =>
  z.union([z.string(), z.number()]).transform((value, ctx) => {
    const raw = toLatinDigits(String(value)).trim();
    if (raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < min || n > max) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return n;
  });

const optionalUuid = z.union([z.literal(""), z.uuid()]).transform((v) => v || null);

/** The application form (استمارة التقديم). Shared by the form and the create / update actions. */
export const studentFormSchema = z.object({
  category: z.enum(["CHILD", "ADULT"]),
  name: z.string().trim().min(1, "اكتب الاسم").max(120),
  nationalId: z.string().transform((value, ctx) => {
    const result = parseNationalId(value);
    if (result.status === "invalid") {
      ctx.addIssue({ code: "custom", message: result.error });
      return z.NEVER;
    }
    return result.status === "valid" ? result.nationalId : "";
  }),
  birthDate: optionalDate,
  /** Adults give an age; it is stored as a birth year. */
  age: optionalNumber(5, 110, "السن غير صحيح"),
  address: text(300),
  phone,
  whatsapp: phone,

  study: text(40),
  grade: text(80),
  guardianName: text(120),
  guardianJob: text(120),
  guardianPhone: phone,
  guardianWhatsapp: phone,
  guardianRelation: text(40),
  guardianRelationOther: text(80),

  maritalStatus: text(40),
  qualification: text(120),
  qualificationStatus: text(40),
  job: text(120),
  availability: text(200),

  testReading: text(40),
  testTajweed: text(40),
  testHifz: text(200),

  halaqaId: optionalUuid,
  joinDate: optionalDate,
  monthlyFee: optionalNumber(0, 1_000_000, "قيمة الاشتراك غير صحيحة"),
  pledgeSigned: z.boolean(),

  photo: z
    .string()
    .nullable()
    .superRefine((value, ctx) => {
      const problem = value ? photoProblem(value) : null;
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    })
    .transform((v) => v || null),
  /** Values of the admin-defined custom fields, keyed by CustomField.key. */
  extra: z.record(z.string(), z.string().trim().max(2000)),
});
export type StudentFormInput = z.input<typeof studentFormSchema>;
export type StudentFormData = z.output<typeof studentFormSchema>;

export const updateStudentSchema = studentFormSchema.extend({ id: z.uuid() });

export const studentIdSchema = z.object({ id: z.uuid() });

export const studentStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["ACTIVE", "DROPPED"]),
});

export const moveStudentSchema = z.object({
  id: z.uuid(),
  halaqaId: z.uuid("اختر الحلقة"),
});

/** Category, discount and own amount of one student («فئة واشتراك»). */
export const studentFeeSchema = z
  .object({
    id: z.uuid(),
    feeCategoryId: optionalUuid,
    feeDiscountId: optionalUuid,
    feeDiscountValue: optionalNumber(0, 1_000_000, "قيمة الخصم غير صحيحة"),
    feeDiscountType: z.enum(["PERCENT", "AMOUNT"]),
    monthlyFee: optionalNumber(0, 1_000_000, "المبلغ غير صحيح"),
  })
  .refine((v) => !(v.feeDiscountType === "PERCENT" && v.feeDiscountValue != null && v.feeDiscountValue > 100), {
    message: "قيمة الخصم غير صحيحة",
    path: ["feeDiscountValue"],
  });
export type StudentFeeInput = z.input<typeof studentFeeSchema>;
export type StudentFeeData = z.output<typeof studentFeeSchema>;

export const deleteStudentSchema = z.object({
  id: z.uuid(),
  /** The admin re-enters their own password to confirm. */
  password: z.string().min(1, "اكتب كلمة المرور"),
});

/** Filters of the students list, as they appear in the URL. */
export const studentFiltersSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  category: z.enum(["", "CHILD", "ADULT"]).catch(""),
  halaqaId: z.union([z.literal(""), z.literal("none"), z.uuid()]).catch(""),
  status: z.enum(["", "ACTIVE", "DROPPED"]).catch(""),
  page: z.coerce.number().int().min(1).catch(1),
});
export type StudentFilters = z.output<typeof studentFiltersSchema>;
