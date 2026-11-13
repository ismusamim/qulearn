"use server";

import { redirect } from "next/navigation";

import type { ActionResult } from "@/lib/action-result";
import { runAction, runPublicAction } from "@/server/action";

import { loginSchema, nameSearchSchema, switchAccountSchema } from "./schemas";
import * as authService from "./service";

export async function searchLoginNamesAction(input: unknown): Promise<ActionResult<authService.LoginNameMatch[]>> {
  return runPublicAction(nameSearchSchema, input, ({ query }) => authService.searchLoginNames(query));
}

export async function loginAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  return runPublicAction(loginSchema, input, (data) => authService.login(data));
}

export async function switchAccountAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(switchAccountSchema, input, (data, auth) => authService.switchAccount(auth, data), {
    allowBlocked: true,
  });
}

export async function logoutAction(): Promise<void> {
  await authService.logout();
  redirect("/login");
}
