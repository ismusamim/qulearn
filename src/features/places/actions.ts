"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/action";

import { placeIdSchema, placeSchema, updatePlaceSchema } from "./schemas";
import * as placesService from "./service";

export async function createPlaceAction(input: unknown) {
  return runAction(placeSchema, input, async (data, auth) => {
    const place = await placesService.createPlace(auth, data);
    revalidatePath("/halaqat");
    return place;
  });
}

export async function updatePlaceAction(input: unknown) {
  return runAction(updatePlaceSchema, input, async (data, auth) => {
    await placesService.updatePlace(auth, data);
    revalidatePath("/halaqat");
  });
}

export async function deletePlaceAction(input: unknown) {
  return runAction(placeIdSchema, input, async ({ id }, auth) => {
    await placesService.deletePlace(auth, id);
    revalidatePath("/halaqat");
  });
}
