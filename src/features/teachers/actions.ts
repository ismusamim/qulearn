"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/action";

import {
  createTeacherSchema,
  myExtraSchema,
  myPersonalSchema,
  myTechnicalSchema,
  teacherWorkingSchema,
  updateTeacherSchema,
} from "./schemas";
import * as teachersService from "./service";

export async function createTeacherAction(input: unknown) {
  return runAction(createTeacherSchema, input, async (data, auth) => {
    const teacher = await teachersService.createTeacher(auth, data);
    revalidatePath("/teachers");
    return teacher;
  });
}

export async function updateTeacherAction(input: unknown) {
  return runAction(updateTeacherSchema, input, async (data, auth) => {
    const result = await teachersService.updateTeacher(auth, data);
    // The teacher's name labels their halaqat all over the app.
    revalidatePath("/", "layout");
    return result;
  });
}

export async function setTeacherWorkingAction(input: unknown) {
  return runAction(teacherWorkingSchema, input, async (data, auth) => {
    const result = await teachersService.setTeacherWorking(auth, data);
    revalidatePath("/", "layout");
    return result;
  });
}

export async function updateMyPersonalAction(input: unknown) {
  return runAction(myPersonalSchema, input, async (data, auth) => {
    await teachersService.updateMyPersonal(auth, data);
    revalidatePath("/profile");
  });
}

export async function updateMyTechnicalAction(input: unknown) {
  return runAction(myTechnicalSchema, input, async (data, auth) => {
    await teachersService.updateMyTechnical(auth, data);
    revalidatePath("/profile");
  });
}

export async function updateMyExtraAction(input: unknown) {
  return runAction(myExtraSchema, input, async (data, auth) => {
    await teachersService.updateMyExtra(auth, data);
    revalidatePath("/profile");
  });
}
