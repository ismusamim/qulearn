"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/action";

import { recitationIdSchema, recitationSchema } from "./schemas";
import * as recitationsService from "./service";

function revalidate() {
  revalidatePath("/my-students");
  revalidatePath("/my-students/[id]", "page");
}

export async function createRecitationAction(input: unknown) {
  return runAction(recitationSchema, input, async (data, auth) => {
    const recitation = await recitationsService.createRecitation(auth, data);
    revalidate();
    return recitation;
  });
}

export async function deleteRecitationAction(input: unknown) {
  return runAction(recitationIdSchema, input, async ({ id }, auth) => {
    await recitationsService.deleteRecitation(auth, id);
    revalidate();
  });
}
