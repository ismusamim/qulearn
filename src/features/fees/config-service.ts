import "server-only";

import type { z } from "zod";

import { type AuthContext, assertCanAny, assertRole } from "@/server/auth";
import { db } from "@/server/db";
import { ConflictError, NotFoundError } from "@/server/errors";

import type { categorySchema, discountSchema, updateCategorySchema, updateDiscountSchema } from "./schemas";

/** «الفئات والخصومات»: read by collectors and fee managers, managed by admins only. */

export interface FeeCategoryDTO {
  id: string;
  name: string;
  amount: number;
  defaultFor: "CHILD" | "ADULT" | null;
  /** Students explicitly assigned to it. */
  studentCount: number;
}

export interface FeeDiscountDTO {
  id: string;
  name: string;
  type: "PERCENT" | "AMOUNT";
  value: number;
  perStudent: boolean;
  studentCount: number;
}

export interface FeeConfigDTO {
  categories: FeeCategoryDTO[];
  discounts: FeeDiscountDTO[];
}

export async function getFeeConfig(auth: AuthContext): Promise<FeeConfigDTO> {
  assertCanAny(auth, "fees.collect", "fees.amount");
  const [categories, discounts] = await Promise.all([
    db.feeCategory.findMany({ include: { _count: { select: { students: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.feeDiscount.findMany({ include: { _count: { select: { students: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      amount: Number(c.amount),
      defaultFor: c.defaultFor,
      studentCount: c._count.students,
    })),
    discounts: discounts.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      value: Number(d.value),
      perStudent: d.perStudent,
      studentCount: d._count.students,
    })),
  };
}

/** One default category for children and one for adults, never more. */
async function assertDefaultFree(defaultFor: "CHILD" | "ADULT" | null, exceptId?: string): Promise<void> {
  if (!defaultFor) return;
  const clash = await db.feeCategory.findFirst({
    where: { defaultFor, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { name: true },
  });
  if (clash) {
    throw new ConflictError(
      `فئة افتراضية واحدة فقط للصغار وواحدة للكبار: «${clash.name}» هي الافتراضية ${defaultFor === "CHILD" ? "للصغار" : "للكبار"}`,
    );
  }
}

export async function createCategory(auth: AuthContext, input: z.output<typeof categorySchema>): Promise<{ id: string }> {
  assertRole(auth, "ADMIN");
  await assertDefaultFree(input.defaultFor);
  const last = await db.feeCategory.aggregate({ _max: { sortOrder: true } });
  return db.feeCategory.create({ data: { ...input, sortOrder: (last._max.sortOrder ?? -1) + 1 }, select: { id: true } });
}

export async function updateCategory(auth: AuthContext, input: z.output<typeof updateCategorySchema>): Promise<void> {
  assertRole(auth, "ADMIN");
  const { id, ...data } = input;
  const existing = await db.feeCategory.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("الفئة غير موجودة");
  await assertDefaultFree(data.defaultFor, id);
  await db.feeCategory.update({ where: { id }, data });
}

/** Students of a deleted category fall back to the default for their age group. */
export async function deleteCategory(auth: AuthContext, id: string): Promise<void> {
  assertRole(auth, "ADMIN");
  const existing = await db.feeCategory.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("الفئة غير موجودة");
  await db.feeCategory.delete({ where: { id } });
}

/** A per-student discount carries no general value. */
const discountData = (input: z.output<typeof discountSchema>) => ({ ...input, value: input.perStudent ? 0 : input.value });

export async function createDiscount(auth: AuthContext, input: z.output<typeof discountSchema>): Promise<{ id: string }> {
  assertRole(auth, "ADMIN");
  const last = await db.feeDiscount.aggregate({ _max: { sortOrder: true } });
  return db.feeDiscount.create({
    data: { ...discountData(input), sortOrder: (last._max.sortOrder ?? -1) + 1 },
    select: { id: true },
  });
}

export async function updateDiscount(auth: AuthContext, input: z.output<typeof updateDiscountSchema>): Promise<void> {
  assertRole(auth, "ADMIN");
  const { id, ...data } = input;
  const existing = await db.feeDiscount.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("الخصم غير موجود");
  await db.feeDiscount.update({ where: { id }, data: discountData(data) });
}

/** Students of a deleted discount simply lose it; their own value is cleared with it. */
export async function deleteDiscount(auth: AuthContext, id: string): Promise<void> {
  assertRole(auth, "ADMIN");
  const existing = await db.feeDiscount.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("الخصم غير موجود");
  await db.$transaction([
    db.studentProfile.updateMany({ where: { feeDiscountId: id }, data: { feeDiscountValue: null, feeDiscountType: null } }),
    db.feeDiscount.delete({ where: { id } }),
  ]);
}
