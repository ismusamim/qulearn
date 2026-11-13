"use server";

import { revalidatePath } from "next/cache";

import { runAction, runSimpleAction } from "@/server/action";

import { blockMessagesSchema, logoSchema, orgSchema, publicNameSearchSchema, themeSchema } from "./schemas";
import * as settingsService from "./service";

/** Name, logo and colours are rendered by the root layout: refresh every page. */
const revalidateBranding = () => revalidatePath("/", "layout");

export async function updateOrgAction(input: unknown) {
  return runAction(orgSchema, input, async (data, auth) => {
    await settingsService.updateOrg(auth, data);
    revalidateBranding();
  });
}

export async function updateLogoAction(input: unknown) {
  return runAction(logoSchema, input, async ({ logo }, auth) => {
    await settingsService.updateLogo(auth, logo);
    revalidateBranding();
  });
}

export async function removeLogoAction() {
  return runSimpleAction(async (auth) => {
    await settingsService.updateLogo(auth, null);
    revalidateBranding();
  });
}

export async function updateThemeAction(input: unknown) {
  return runAction(themeSchema, input, async (data, auth) => {
    await settingsService.updateTheme(auth, data);
    revalidateBranding();
  });
}

export async function resetAppearanceAction() {
  return runSimpleAction(async (auth) => {
    await settingsService.resetAppearance(auth);
    revalidateBranding();
  });
}

export async function updatePublicNameSearchAction(input: unknown) {
  return runAction(publicNameSearchSchema, input, async ({ enabled }, auth) => {
    await settingsService.updatePublicNameSearch(auth, enabled);
    revalidateBranding();
  });
}

export async function updateBlockMessagesAction(input: unknown) {
  return runAction(blockMessagesSchema, input, async (data, auth) => {
    await settingsService.updateBlockMessages(auth, data);
    revalidateBranding();
  });
}
