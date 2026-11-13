import { z } from "zod";

import { isISODate } from "@/lib/dates";

const money = (message: string) => z.number({ error: message }).min(0, message).max(10_000_000, message);
const discountType = z.enum(["PERCENT", "AMOUNT"]);

/** Search boxes of the fees page: student name (contains), halaqa label and place name (word prefix). */
export const feeFiltersSchema = z.object({
  qs: z.string().trim().max(100),
  qh: z.string().trim().max(100),
  qp: z.string().trim().max(100),
});
export type FeeFiltersInput = z.infer<typeof feeFiltersSchema>;

/** One payment. Who collected it is never part of the input: the server stamps it. */
export const paymentSchema = z.object({
  studentId: z.uuid(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1, "شهر غير صحيح").max(12, "شهر غير صحيح"),
  amount: z.number({ error: "اكتب مبلغًا صحيحًا" }).positive("اكتب مبلغًا صحيحًا").max(10_000_000, "اكتب مبلغًا صحيحًا"),
  date: z.string().refine(isISODate, "تاريخ غير صحيح"),
  note: z.string().trim().max(300),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const idSchema = z.object({ id: z.uuid() });
export const studentIdSchema = z.object({ studentId: z.uuid() });

export const categorySchema = z.object({
  name: z.string().trim().min(1, "اكتب اسم الفئة").max(120),
  amount: money("اكتب مبلغ الفئة"),
  /** The age group this category applies to automatically; at most one category per group. */
  defaultFor: z.enum(["CHILD", "ADULT"]).nullable(),
});
export type CategoryInput = z.infer<typeof categorySchema>;
export const updateCategorySchema = categorySchema.extend({ id: z.uuid() });

export const discountSchema = z
  .object({
    name: z.string().trim().min(1, "اكتب اسم الخصم").max(120),
    type: discountType,
    value: money("اكتب قيمة الخصم"),
    /** «لكل طالب»: no general value; it is set on each student. */
    perStudent: z.boolean(),
  })
  .refine((d) => d.perStudent || d.type !== "PERCENT" || d.value <= 100, {
    path: ["value"],
    message: "نسبة الخصم لا تزيد على 100%",
  });
export type DiscountInput = z.infer<typeof discountSchema>;
export const updateDiscountSchema = discountSchema.safeExtend({ id: z.uuid() });

const ownDiscount = {
  /** Value specific to the student(s); required for per-student discounts. */
  feeDiscountValue: money("قيمة الخصم غير صحيحة").nullable(),
  feeDiscountType: discountType,
};
const percentWithinRange = (d: { feeDiscountValue: number | null; feeDiscountType: "PERCENT" | "AMOUNT" }) =>
  d.feeDiscountValue == null || d.feeDiscountType !== "PERCENT" || d.feeDiscountValue <= 100;

/** «قيمة اشتراك الطالب»: the only student data a holder of fees.amount may change. */
export const studentFeeSchema = z
  .object({
    studentId: z.uuid(),
    /** null = the default category for the student's age group. */
    feeCategoryId: z.uuid().nullable(),
    feeDiscountId: z.uuid().nullable(),
    ...ownDiscount,
    /** Own amount overriding the category; null = the category's amount. */
    monthlyFee: money("المبلغ غير صحيح").nullable(),
  })
  .refine(percentWithinRange, { path: ["feeDiscountValue"], message: "قيمة الخصم غير صحيحة" });
export type StudentFeeInput = z.infer<typeof studentFeeSchema>;

const keepOr = z.union([z.literal("keep"), z.uuid(), z.null()]);

/** «تعيين لنتائج البحث»: the same assignment for every student matching the search; "keep" leaves a field as it is. */
export const bulkStudentFeeSchema = z
  .object({
    filters: feeFiltersSchema,
    feeCategoryId: keepOr,
    feeDiscountId: keepOr,
    /** null = leave each student's own value unchanged. */
    ...ownDiscount,
  })
  .refine(percentWithinRange, { path: ["feeDiscountValue"], message: "قيمة الخصم غير صحيحة" });
export type BulkStudentFeeInput = z.infer<typeof bulkStudentFeeSchema>;
