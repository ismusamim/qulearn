import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { computeFeeDue, type FeeCategoryInput, type FeeDiscountInput, type StudentFeeInput } from "@/lib/domain/fees";
import { db, type Tx } from "@/server/db";

/**
 * Loading what computeFeeDue needs. Performs NO authorisation: callers decide
 * who may see a due (collectors and fee managers see the breakdown, a teacher
 * only the number for their own halaqa).
 */

export interface FeeTables {
  categories: FeeCategoryInput[];
  discounts: FeeDiscountInput[];
}

export async function loadFeeTables(client: Tx | typeof db = db): Promise<FeeTables> {
  const [categories, discounts] = await Promise.all([
    client.feeCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    client.feeDiscount.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  return {
    categories: categories.map((c) => ({ id: c.id, name: c.name, amount: Number(c.amount), defaultFor: c.defaultFor })),
    discounts: discounts.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      value: Number(d.value),
      perStudent: d.perStudent,
    })),
  };
}

/** The StudentProfile columns the due depends on. */
export const FEE_PROFILE_SELECT = {
  category: true,
  monthlyFee: true,
  feeCategoryId: true,
  feeDiscountId: true,
  feeDiscountValue: true,
  feeDiscountType: true,
} satisfies Prisma.StudentProfileSelect;

type FeeProfile = Prisma.StudentProfileGetPayload<{ select: typeof FEE_PROFILE_SELECT }>;

/** A student without a profile row is treated as a child with nothing assigned. */
export function toFeeInput(profile: FeeProfile | null | undefined): StudentFeeInput {
  return {
    category: profile?.category ?? "CHILD",
    monthlyFee: profile?.monthlyFee != null ? Number(profile.monthlyFee) : null,
    feeCategoryId: profile?.feeCategoryId ?? null,
    feeDiscountId: profile?.feeDiscountId ?? null,
    feeDiscountValue: profile?.feeDiscountValue != null ? Number(profile.feeDiscountValue) : null,
    feeDiscountType: profile?.feeDiscountType ?? null,
  };
}

/** studentId → monthly due (null when it cannot be determined) for the profiles matching `where`. */
export async function dueByStudent(where: Prisma.StudentProfileWhereInput): Promise<Map<string, number | null>> {
  const [tables, profiles] = await Promise.all([
    loadFeeTables(),
    db.studentProfile.findMany({ where, select: { memberId: true, ...FEE_PROFILE_SELECT } }),
  ]);
  return new Map(
    profiles.map((p) => [p.memberId, computeFeeDue(toFeeInput(p), tables.categories, tables.discounts).due]),
  );
}
