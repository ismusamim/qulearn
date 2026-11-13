"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/action";

import { halaqaIdSchema, halaqaSchema, updateHalaqaSchema } from "./schemas";
import * as halaqatService from "./service";

// Halaqa counts and labels also appear on the dashboard.
function revalidate() {
  revalidatePath("/halaqat");
  revalidatePath("/dashboard");
}

export async function createHalaqaAction(input: unknown) {
  return runAction(halaqaSchema, input, async (data, auth) => {
    const halaqa = await halaqatService.createHalaqa(auth, data);
    revalidate();
    return halaqa;
  });
}

export async function updateHalaqaAction(input: unknown) {
  return runAction(updateHalaqaSchema, input, async (data, auth) => {
    await halaqatService.updateHalaqa(auth, data);
    revalidate();
  });
}

export async function deleteHalaqaAction(input: unknown) {
  return runAction(halaqaIdSchema, input, async ({ id }, auth) => {
    await halaqatService.deleteHalaqa(auth, id);
    revalidate();
  });
}
