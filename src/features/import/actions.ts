"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/action";

import {
  approvePendingSchema, checkImportSchema, customFieldKeySchema, importMembersSchema, pendingIdSchema, savePendingSchema,
  sheetUrlSchema, updateCustomFieldSchema,
} from "./schemas";
import * as pendingService from "./pending-service";
import * as importService from "./service";

export async function fetchSheetAction(input: unknown) {
  return runAction(sheetUrlSchema, input, ({ url }, auth) => importService.fetchSheetTable(auth, url));
}

export async function checkImportAction(input: unknown) {
  return runAction(checkImportSchema, input, (data, auth) => importService.checkImport(auth, data));
}

export async function importMembersAction(input: unknown) {
  return runAction(importMembersSchema, input, async (data, auth) => {
    const result = await importService.importMembers(auth, data);
    // New members, halaqat and pending columns show up all over the app.
    revalidatePath("/", "layout");
    return result;
  });
}

export async function savePendingAction(input: unknown) {
  return runAction(savePendingSchema, input, async (data, auth) => {
    await pendingService.savePendingColumn(auth, data);
    revalidatePath("/import");
  });
}

export async function approvePendingAction(input: unknown) {
  return runAction(approvePendingSchema, input, async (data, auth) => {
    const result = await pendingService.approvePendingColumn(auth, data);
    revalidatePath("/", "layout");
    return result;
  });
}

export async function deletePendingAction(input: unknown) {
  return runAction(pendingIdSchema, input, async ({ id }, auth) => {
    await pendingService.deletePendingColumn(auth, id);
    revalidatePath("/import");
  });
}

export async function updateCustomFieldAction(input: unknown) {
  return runAction(updateCustomFieldSchema, input, async (data, auth) => {
    await pendingService.updateCustomField(auth, data);
    revalidatePath("/", "layout");
  });
}

export async function deleteCustomFieldAction(input: unknown) {
  return runAction(customFieldKeySchema, input, async ({ kind, key }, auth) => {
    await pendingService.deleteCustomField(auth, kind, key);
    revalidatePath("/", "layout");
  });
}
