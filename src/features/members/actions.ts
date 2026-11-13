"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/action";

import {
  bulkResetSchema,
  createMemberSchema,
  deleteMembersSchema,
  memberIdSchema,
  setPasswordSchema,
  updateMemberSchema,
} from "./schemas";
import * as membersService from "./service";

export async function createMemberAction(input: unknown) {
  return runAction(createMemberSchema, input, async (data, auth) => {
    const credential = await membersService.createMember(auth, data);
    revalidatePath("/members");
    return credential;
  });
}

export async function updateMemberAction(input: unknown) {
  return runAction(updateMemberSchema, input, async (data, auth) => {
    await membersService.updateMember(auth, data);
    revalidatePath("/members");
  });
}

export async function resetPasswordAction(input: unknown) {
  return runAction(memberIdSchema, input, async ({ id }, auth) => {
    const credential = await membersService.resetPassword(auth, id);
    revalidatePath("/members");
    return credential;
  });
}

export async function setPasswordAction(input: unknown) {
  return runAction(setPasswordSchema, input, async (data, auth) => {
    await membersService.setPassword(auth, data);
    revalidatePath("/members");
  });
}

export async function disableLoginAction(input: unknown) {
  return runAction(memberIdSchema, input, async ({ id }, auth) => {
    await membersService.disableLogin(auth, id);
    revalidatePath("/members");
  });
}

export async function bulkResetPasswordsAction(input: unknown) {
  return runAction(bulkResetSchema, input, async (data, auth) => {
    const result = await membersService.bulkResetPasswords(auth, data);
    revalidatePath("/members");
    return result;
  });
}

export async function deleteMembersAction(input: unknown) {
  return runAction(deleteMembersSchema, input, async (data, auth) => {
    const result = await membersService.deleteMembers(auth, data);
    revalidatePath("/members");
    return result;
  });
}
