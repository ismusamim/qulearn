"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/action";

import * as configService from "./config-service";
import {
  bulkStudentFeeSchema,
  categorySchema,
  discountSchema,
  idSchema,
  paymentSchema,
  studentFeeSchema,
  studentIdSchema,
  updateCategorySchema,
  updateDiscountSchema,
} from "./schemas";
import * as feesService from "./service";

export async function recordPaymentAction(input: unknown) {
  return runAction(paymentSchema, input, async (data, auth) => {
    const payment = await feesService.recordPayment(auth, data);
    revalidatePath("/fees");
    return payment;
  });
}

export async function deletePaymentAction(input: unknown) {
  return runAction(idSchema, input, async ({ id }, auth) => {
    await feesService.deletePayment(auth, id);
    revalidatePath("/fees");
  });
}

/** Read used by the history dialog, which loads on demand. */
export async function listStudentPaymentsAction(input: unknown) {
  return runAction(studentIdSchema, input, async ({ studentId }, auth) => feesService.listStudentPayments(auth, studentId));
}

export async function setStudentFeeAction(input: unknown) {
  return runAction(studentFeeSchema, input, async (data, auth) => {
    await feesService.setStudentFee(auth, data);
    revalidatePath("/fees");
  });
}

export async function bulkSetStudentFeeAction(input: unknown) {
  return runAction(bulkStudentFeeSchema, input, async (data, auth) => {
    const result = await feesService.bulkSetStudentFee(auth, data);
    revalidatePath("/fees");
    return result;
  });
}

export async function createCategoryAction(input: unknown) {
  return runAction(categorySchema, input, async (data, auth) => {
    const category = await configService.createCategory(auth, data);
    revalidatePath("/fees");
    return category;
  });
}

export async function updateCategoryAction(input: unknown) {
  return runAction(updateCategorySchema, input, async (data, auth) => {
    await configService.updateCategory(auth, data);
    revalidatePath("/fees");
  });
}

export async function deleteCategoryAction(input: unknown) {
  return runAction(idSchema, input, async ({ id }, auth) => {
    await configService.deleteCategory(auth, id);
    revalidatePath("/fees");
  });
}

export async function createDiscountAction(input: unknown) {
  return runAction(discountSchema, input, async (data, auth) => {
    const discount = await configService.createDiscount(auth, data);
    revalidatePath("/fees");
    return discount;
  });
}

export async function updateDiscountAction(input: unknown) {
  return runAction(updateDiscountSchema, input, async (data, auth) => {
    await configService.updateDiscount(auth, data);
    revalidatePath("/fees");
  });
}

export async function deleteDiscountAction(input: unknown) {
  return runAction(idSchema, input, async ({ id }, auth) => {
    await configService.deleteDiscount(auth, id);
    revalidatePath("/fees");
  });
}
