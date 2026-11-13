"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/action";

import { absenceIdSchema, absenceProofSchema, createAbsenceSchema } from "./schemas";
import * as absencesService from "./service";

/** Absences also feed the leave balances shown in payroll. */
function refresh() {
  revalidatePath("/absences");
  revalidatePath("/payroll");
}

export async function createAbsenceAction(input: unknown) {
  return runAction(createAbsenceSchema, input, async (data, auth) => {
    const result = await absencesService.createAbsence(auth, data);
    refresh();
    return result;
  });
}

export async function setAbsenceProofAction(input: unknown) {
  return runAction(absenceProofSchema, input, async ({ id, proof }, auth) => {
    await absencesService.setAbsenceProof(auth, id, proof || null);
    refresh();
  });
}

export async function deleteAbsenceAction(input: unknown) {
  return runAction(absenceIdSchema, input, async ({ id }, auth) => {
    await absencesService.deleteAbsence(auth, id);
    refresh();
  });
}
