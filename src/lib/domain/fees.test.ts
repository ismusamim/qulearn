import { describe, expect, it } from "vitest";

import { computeFeeDue, type FeeCategoryInput, type FeeDiscountInput, type StudentFeeInput } from "./fees";

const categories: FeeCategoryInput[] = [
  { id: "c-child", name: "صغار", amount: 100, defaultFor: "CHILD" },
  { id: "c-adult", name: "كبار", amount: 150, defaultFor: "ADULT" },
  { id: "c-special", name: "خاص", amount: 300, defaultFor: null },
];
const discounts: FeeDiscountInput[] = [
  { id: "d-orphan", name: "أيتام", type: "PERCENT", value: 100, perStudent: false },
  { id: "d-staff", name: "أبناء الموظفين", type: "PERCENT", value: 50, perStudent: false },
  { id: "d-each", name: "حالات خاصة", type: "PERCENT", value: 0, perStudent: true },
];
const student = (over: Partial<StudentFeeInput> = {}): StudentFeeInput => ({
  category: "CHILD",
  monthlyFee: null,
  feeCategoryId: null,
  feeDiscountId: null,
  feeDiscountValue: null,
  feeDiscountType: null,
  ...over,
});

describe("computeFeeDue", () => {
  it("falls back to the default category for the age group", () => {
    expect(computeFeeDue(student(), categories, discounts)).toMatchObject({ due: 100, source: "default" });
    expect(computeFeeDue(student({ category: "ADULT" }), categories, discounts).due).toBe(150);
  });

  it("prefers the student's own amount, then their category", () => {
    expect(computeFeeDue(student({ monthlyFee: 80, feeCategoryId: "c-special" }), categories, discounts)).toMatchObject({ due: 80, source: "own" });
    expect(computeFeeDue(student({ feeCategoryId: "c-special" }), categories, discounts)).toMatchObject({ due: 300, source: "category" });
  });

  it("returns null when nothing determines the amount", () => {
    expect(computeFeeDue(student(), [], discounts).due).toBeNull();
  });

  it("applies percentage and fixed discounts, never below zero", () => {
    expect(computeFeeDue(student({ feeDiscountId: "d-staff" }), categories, discounts).due).toBe(50);
    expect(computeFeeDue(student({ feeDiscountId: "d-orphan" }), categories, discounts).due).toBe(0);
    expect(computeFeeDue(student({ feeDiscountId: "d-each", feeDiscountValue: 500, feeDiscountType: "AMOUNT" }), categories, discounts).due).toBe(0);
  });

  it("takes per-student discounts from the student", () => {
    expect(computeFeeDue(student({ feeDiscountId: "d-each" }), categories, discounts).due).toBe(100);
    expect(computeFeeDue(student({ feeDiscountId: "d-each", feeDiscountValue: 25 }), categories, discounts).due).toBe(75);
    expect(computeFeeDue(student({ feeDiscountId: "d-each", feeDiscountValue: 30, feeDiscountType: "AMOUNT" }), categories, discounts).due).toBe(70);
  });
});
