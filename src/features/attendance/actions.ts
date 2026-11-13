"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/action";

import { markAllPresentSchema, setAttendanceSchema } from "./schemas";
import * as attendanceService from "./service";

function revalidate() {
  revalidatePath("/attendance");
  // Attendance percentages are shown in the students list and each student's record.
  revalidatePath("/my-students");
  revalidatePath("/my-students/[id]", "page");
}

export async function setAttendanceAction(input: unknown) {
  return runAction(setAttendanceSchema, input, async (data, auth) => {
    await attendanceService.setAttendance(auth, data);
    revalidate();
  });
}

export async function markAllPresentAction(input: unknown) {
  return runAction(markAllPresentSchema, input, async (data, auth) => {
    const result = await attendanceService.markAllPresent(auth, data);
    revalidate();
    return result;
  });
}
