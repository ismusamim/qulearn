"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/action";

import { reviewCollectionSchema, saveCollectionSchema } from "./schemas";
import * as collectionsService from "./service";

export async function saveCollectionAction(input: unknown) {
  return runAction(saveCollectionSchema, input, async (data, auth) => {
    const collection = await collectionsService.saveCollection(auth, data);
    revalidatePath("/collections");
    revalidatePath("/collections/review");
    return collection;
  });
}

export async function reviewCollectionAction(input: unknown) {
  return runAction(reviewCollectionSchema, input, async (data, auth) => {
    const result = await collectionsService.reviewCollection(auth, data);
    revalidatePath("/collections", "layout");
    // Confirmed lines became payments.
    revalidatePath("/fees");
    return result;
  });
}
