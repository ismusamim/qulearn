"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/action";

import {
  deleteStudentSchema,
  moveStudentSchema,
  studentFeeSchema,
  studentFormSchema,
  studentStatusSchema,
  updateStudentSchema,
} from "./schemas";
import * as studentsService from "./service";

export async function createStudentAction(input: unknown) {
  return runAction(studentFormSchema, input, async (data, auth) => {
    const created = await studentsService.createStudent(auth, data);
    revalidatePath("/students");
    return created;
  });
}

export async function updateStudentAction(input: unknown) {
  return runAction(updateStudentSchema, input, async ({ id, ...data }, auth) => {
    await studentsService.updateStudent(auth, id, data);
    revalidatePath("/students");
    revalidatePath(`/students/${id}`);
  });
}

export async function setStudentStatusAction(input: unknown) {
  return runAction(studentStatusSchema, input, async ({ id, status }, auth) => {
    await studentsService.setStudentStatus(auth, id, status);
    revalidatePath("/students");
    revalidatePath(`/students/${id}`);
  });
}

export async function moveStudentAction(input: unknown) {
  return runAction(moveStudentSchema, input, async ({ id, halaqaId }, auth) => {
    await studentsService.moveStudent(auth, id, halaqaId);
    revalidatePath("/students");
    revalidatePath(`/students/${id}`);
  });
}

export async function setStudentFeeAction(input: unknown) {
  return runAction(studentFeeSchema, input, async (data, auth) => {
    await studentsService.setStudentFee(auth, data);
    revalidatePath("/students");
    revalidatePath(`/students/${data.id}`);
  });
}

export async function deleteStudentAction(input: unknown) {
  return runAction(deleteStudentSchema, input, async ({ id, password }, auth) => {
    await studentsService.deleteStudent(auth, id, password);
    revalidatePath("/students");
  });
}
