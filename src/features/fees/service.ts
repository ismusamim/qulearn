import "server-only";

import type { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { normalizeArabic } from "@/lib/arabic";
import { CURRENCY_LABEL } from "@/lib/constants";
import { fromISODate, toISODate } from "@/lib/dates";
import { computeFeeDue } from "@/lib/domain/fees";
import { formatMoney } from "@/lib/format";
import { type AuthContext, assertCan, assertCanAny, can, hasRole } from "@/server/auth";
import { db } from "@/server/db";
import { halaqaLabelMap } from "@/server/directory";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";

import { FEE_PROFILE_SELECT, type FeeTables, loadFeeTables, toFeeInput } from "./dues";
import type { YearMonth } from "./months";
import type { bulkStudentFeeSchema, FeeFiltersInput, paymentSchema, studentFeeSchema } from "./schemas";
import { discountText, type FeeState, type FeeSummary, feeState, remainingOf, startsWithWord, summarizeFees } from "./summary";

/** The table shows at most this many students; totals always cover every match. */
export const MAX_ROWS = 300;

/** What is currently assigned to a student (pre-fills the «قيمة اشتراك الطالب» dialog). */
export interface StudentFeeDTO {
  feeCategoryId: string | null;
  feeDiscountId: string | null;
  feeDiscountValue: number | null;
  feeDiscountType: "PERCENT" | "AMOUNT" | null;
  monthlyFee: number | null;
}

export interface FeeRowDTO {
  studentId: string;
  name: string;
  dropped: boolean;
  halaqaLabel: string | null;
  placeName: string | null;
  due: number | null;
  /** Amount before the discount. */
  base: number | null;
  discount: number;
  /** «مبلغ خاص» or the category's name. */
  sourceLabel: string | null;
  /** «أيتام (100%)». */
  discountLabel: string | null;
  paid: number;
  remaining: number;
  state: FeeState;
  fee: StudentFeeDTO;
}

export interface FeesOverviewDTO {
  rows: FeeRowDTO[];
  /** Number of students matching the search (rows may be truncated to MAX_ROWS). */
  total: number;
  /** Null for users who may not see payments (fees.amount without fees.collect). */
  summary: FeeSummary | null;
  canCollect: boolean;
  canAssign: boolean;
}

/** Students matching the three search boxes, sorted by name, with their halaqa. */
async function matchStudents(filters: FeeFiltersInput) {
  const qs = normalizeArabic(filters.qs);
  const qh = normalizeArabic(filters.qh);
  const qp = normalizeArabic(filters.qp);
  const [members, halaqat] = await Promise.all([
    db.member.findMany({
      where: { role: "STUDENT", ...(qs ? { nameNormalized: { contains: qs } } : {}) },
      select: {
        id: true,
        name: true,
        studentProfile: { select: { ...FEE_PROFILE_SELECT, status: true, halaqaId: true } },
      },
    }),
    halaqaLabelMap(),
  ]);
  return members
    .map((m) => ({ ...m, halaqa: (m.studentProfile?.halaqaId && halaqat.get(m.studentProfile.halaqaId)) || null }))
    .filter((s) => {
      if (!qh && !qp) return true;
      if (!s.halaqa) return false;
      return startsWithWord(s.halaqa.label, qh) && (!qp || startsWithWord(s.halaqa.placeName, qp));
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

function describeDiscount(fee: StudentFeeDTO, tables: FeeTables): string | null {
  const d = tables.discounts.find((x) => x.id === fee.feeDiscountId);
  if (!d) return null;
  const own = fee.feeDiscountValue != null;
  if (d.perStudent && !own) return `${d.name} (لم تُحدَّد قيمته)`;
  const value = own ? (fee.feeDiscountValue ?? 0) : d.value;
  const type = own ? (fee.feeDiscountType ?? d.type) : d.type;
  return `${d.name} (${discountText(type, value, formatMoney, CURRENCY_LABEL)})`;
}

/**
 * The fees page: every matching student with their due and what was paid for
 * the month. Open to collectors and to those who set amounts; payments
 * themselves are only visible with fees.collect.
 */
export async function getFeesOverview(auth: AuthContext, month: YearMonth, filters: FeeFiltersInput): Promise<FeesOverviewDTO> {
  assertCanAny(auth, "fees.collect", "fees.amount");
  const canCollect = can(auth, "fees.collect");
  const [students, tables, paidRows] = await Promise.all([
    matchStudents(filters),
    loadFeeTables(),
    canCollect
      ? db.feePayment.groupBy({
          by: ["studentId"],
          where: { year: month.year, month: month.month },
          _sum: { amount: true },
        })
      : [],
  ]);
  const paidBy = new Map(paidRows.map((p) => [p.studentId, Number(p._sum.amount ?? 0)]));

  const all: FeeRowDTO[] = students.map((s) => {
    const input = toFeeInput(s.studentProfile);
    const fee: StudentFeeDTO = {
      feeCategoryId: input.feeCategoryId,
      feeDiscountId: input.feeDiscountId,
      feeDiscountValue: input.feeDiscountValue,
      feeDiscountType: input.feeDiscountType,
      monthlyFee: input.monthlyFee,
    };
    const d = computeFeeDue(input, tables.categories, tables.discounts);
    const paid = paidBy.get(s.id) ?? 0;
    const dropped = s.studentProfile?.status === "DROPPED";
    return {
      studentId: s.id,
      name: s.name,
      dropped,
      halaqaLabel: s.halaqa?.label ?? null,
      placeName: s.halaqa?.placeName ?? null,
      due: d.due,
      base: d.base,
      discount: d.discount,
      sourceLabel: d.source === "own" ? "مبلغ خاص" : d.categoryName,
      discountLabel: d.due == null ? null : describeDiscount(fee, tables),
      paid,
      remaining: remainingOf(d.due, paid),
      state: feeState(d.due, paid, dropped),
      fee,
    };
  });

  return {
    rows: all.slice(0, MAX_ROWS),
    total: all.length,
    summary: canCollect ? summarizeFees(all) : null,
    canCollect,
    canAssign: can(auth, "fees.amount"),
  };
}

// ───────────────────────── Payments ─────────────────────────

export interface PaymentDTO {
  id: string;
  year: number;
  month: number;
  amount: number;
  date: string | null;
  collectedByName: string;
  note: string;
  /** Admins delete any payment; a collector only those they recorded. */
  canDelete: boolean;
}

async function assertStudent(studentId: string): Promise<{ id: string; name: string }> {
  const student = await db.member.findFirst({ where: { id: studentId, role: "STUDENT" }, select: { id: true, name: true } });
  if (!student) throw new NotFoundError("الطالب غير موجود");
  return student;
}

/** Records a payment. The collector is always the signed-in user, never taken from the input. */
export async function recordPayment(auth: AuthContext, input: z.output<typeof paymentSchema>): Promise<{ id: string }> {
  assertCan(auth, "fees.collect");
  await assertStudent(input.studentId);
  return db.feePayment.create({
    data: {
      studentId: input.studentId,
      year: input.year,
      month: input.month,
      amount: input.amount,
      date: fromISODate(input.date),
      note: input.note,
      collectedById: auth.memberId,
      collectedByName: auth.name,
    },
    select: { id: true },
  });
}

/** A student's whole payment history, newest month first. */
export async function listStudentPayments(auth: AuthContext, studentId: string): Promise<PaymentDTO[]> {
  assertCan(auth, "fees.collect");
  const admin = hasRole(auth, "ADMIN");
  const rows = await db.feePayment.findMany({
    where: { studentId },
    orderBy: [{ year: "desc" }, { month: "desc" }, { date: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((p) => ({
    id: p.id,
    year: p.year,
    month: p.month,
    amount: Number(p.amount),
    date: toISODate(p.date),
    collectedByName: p.collectedByName ?? "",
    note: p.note,
    canDelete: admin || p.collectedById === auth.memberId,
  }));
}

export async function deletePayment(auth: AuthContext, id: string): Promise<void> {
  assertCan(auth, "fees.collect");
  const payment = await db.feePayment.findUnique({ where: { id }, select: { collectedById: true } });
  if (!payment) throw new NotFoundError("الدفعة غير موجودة");
  if (!hasRole(auth, "ADMIN") && payment.collectedById !== auth.memberId) {
    throw new ForbiddenError("لا يمكنك حذف دفعة سجّلها غيرك");
  }
  await db.feePayment.delete({ where: { id } });
}

// ───────────────────────── Student subscription value ─────────────────────────

async function assertAssignable(categoryId: string | null, discountId: string | null, hasOwnValue: boolean, who: string) {
  const [category, discount] = await Promise.all([
    categoryId ? db.feeCategory.findUnique({ where: { id: categoryId }, select: { id: true } }) : null,
    discountId ? db.feeDiscount.findUnique({ where: { id: discountId }, select: { name: true, perStudent: true } }) : null,
  ]);
  if (categoryId && !category) throw new NotFoundError("الفئة غير موجودة");
  if (discountId && !discount) throw new NotFoundError("الخصم غير موجود");
  if (discount?.perStudent && !hasOwnValue) {
    throw new ValidationError(`حدّد قيمة خصم «${discount.name}» ونوعه لـ${who}`);
  }
}

/** Sets a student's category, discount, own discount value and own amount — nothing else on the profile. */
export async function setStudentFee(auth: AuthContext, input: z.output<typeof studentFeeSchema>): Promise<void> {
  assertCan(auth, "fees.amount");
  await assertStudent(input.studentId);
  await assertAssignable(input.feeCategoryId, input.feeDiscountId, input.feeDiscountValue != null, "هذا الطالب");
  // An own discount value only means something next to a discount.
  const ownValue = input.feeDiscountId ? input.feeDiscountValue : null;
  const data = {
    feeCategoryId: input.feeCategoryId,
    feeDiscountId: input.feeDiscountId,
    feeDiscountValue: ownValue,
    feeDiscountType: ownValue == null ? null : input.feeDiscountType,
    monthlyFee: input.monthlyFee,
  };
  await db.studentProfile.upsert({
    where: { memberId: input.studentId },
    update: data,
    create: { memberId: input.studentId, ...data },
  });
}

/** Applies the same category / discount to every student matching the search (not only the rows shown). */
export async function bulkSetStudentFee(auth: AuthContext, input: z.output<typeof bulkStudentFeeSchema>): Promise<{ count: number }> {
  assertCan(auth, "fees.amount");
  const { feeCategoryId, feeDiscountId, feeDiscountValue, feeDiscountType } = input;
  await assertAssignable(
    feeCategoryId === "keep" ? null : feeCategoryId,
    feeDiscountId === "keep" ? null : feeDiscountId,
    feeDiscountValue != null,
    "هؤلاء الطلاب",
  );
  const data: Prisma.StudentProfileUncheckedUpdateManyInput = {};
  if (feeCategoryId !== "keep") data.feeCategoryId = feeCategoryId;
  if (feeDiscountId !== "keep") {
    data.feeDiscountId = feeDiscountId;
    if (feeDiscountId === null) {
      data.feeDiscountValue = null;
      data.feeDiscountType = null;
    }
  }
  if (feeDiscountValue != null && feeDiscountId !== null) {
    data.feeDiscountValue = feeDiscountValue;
    data.feeDiscountType = feeDiscountType;
  }
  const students = await matchStudents(input.filters);
  if (students.length === 0) throw new ValidationError("لا يوجد طلاب في النتائج");
  if (Object.keys(data).length === 0) return { count: 0 };
  const result = await db.studentProfile.updateMany({ where: { memberId: { in: students.map((s) => s.id) } }, data });
  return { count: result.count };
}
