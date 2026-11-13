/**
 * Monthly subscription due for a student:
 *   base     = the student's own amount, else their category, else the default
 *              category for their age group;
 *   discount = the student's discount (percentage or fixed amount; discounts
 *              flagged perStudent take their value from the student);
 *   due      = base − discount, never below zero.
 */

export interface FeeCategoryInput {
  id: string;
  name: string;
  amount: number;
  defaultFor: "CHILD" | "ADULT" | null;
}

export interface FeeDiscountInput {
  id: string;
  name: string;
  type: "PERCENT" | "AMOUNT";
  value: number;
  perStudent: boolean;
}

export interface StudentFeeInput {
  category: "CHILD" | "ADULT";
  monthlyFee: number | null;
  feeCategoryId: string | null;
  feeDiscountId: string | null;
  feeDiscountValue: number | null;
  feeDiscountType: "PERCENT" | "AMOUNT" | null;
}

export interface FeeDue {
  /** Null when no amount can be determined (no own fee and no matching category). */
  due: number | null;
  base: number | null;
  discount: number;
  /** Where the base came from. */
  source: "own" | "category" | "default" | "none";
  categoryName: string | null;
  discountName: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeFeeDue(
  student: StudentFeeInput,
  categories: readonly FeeCategoryInput[],
  discounts: readonly FeeDiscountInput[],
): FeeDue {
  let base: number | null = null;
  let source: FeeDue["source"] = "none";
  let categoryName: string | null = null;

  if (student.monthlyFee != null && student.monthlyFee > 0) {
    base = student.monthlyFee;
    source = "own";
  } else {
    const own = categories.find((c) => c.id === student.feeCategoryId);
    const fallback = own ?? categories.find((c) => c.defaultFor === student.category);
    if (fallback) {
      base = fallback.amount;
      source = own ? "category" : "default";
      categoryName = fallback.name;
    }
  }
  if (base == null) {
    return { due: null, base: null, discount: 0, source, categoryName, discountName: null };
  }

  let discount = 0;
  const d = discounts.find((x) => x.id === student.feeDiscountId);
  if (d) {
    let value: number;
    let type: "PERCENT" | "AMOUNT";
    if (student.feeDiscountValue != null) {
      value = student.feeDiscountValue;
      type = student.feeDiscountType ?? d.type;
    } else {
      value = d.perStudent ? 0 : d.value;
      type = d.type;
    }
    discount = Math.min(base, Math.max(0, type === "AMOUNT" ? value : (base * value) / 100));
  }

  return {
    due: round2(base - discount),
    base,
    discount: round2(discount),
    source,
    categoryName,
    discountName: d?.name ?? null,
  };
}
