"use server";

import { revalidatePath } from "next/cache";

import { runAction, runSimpleAction } from "@/server/action";

import { memberIdSchema, memberPermissionsSchema, rolePermissionsSchema } from "./schemas";
import * as permissionsService from "./service";

/** Permissions decide which menu items and pages people see: refresh everything. */
const revalidate = () => revalidatePath("/", "layout");

export async function setRolePermissionsAction(input: unknown) {
  return runAction(rolePermissionsSchema, input, async (data, auth) => {
    await permissionsService.setRolePermissions(auth, data);
    revalidate();
  });
}

export async function setMemberPermissionsAction(input: unknown) {
  return runAction(memberPermissionsSchema, input, async (data, auth) => {
    await permissionsService.setMemberPermissions(auth, data);
    revalidate();
  });
}

export async function clearMemberOverridesAction(input: unknown) {
  return runAction(memberIdSchema, input, async ({ memberId }, auth) => {
    await permissionsService.clearMemberOverrides(auth, memberId);
    revalidate();
  });
}

export async function resetRolePermissionsAction() {
  return runSimpleAction(async (auth) => {
    await permissionsService.resetRolePermissions(auth);
    revalidate();
  });
}
