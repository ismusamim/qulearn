import "server-only";

import type { z } from "zod";

import { DEFAULT_THEME, type ThemeColors } from "@/lib/theme";
import { type AuthContext, assertRole } from "@/server/auth";
import { DEFAULT_SETTINGS, getSettings, setSetting } from "@/server/settings";

import { themeOverrides } from "./palette";
import type { blockMessagesSchema, orgSchema, themeSchema } from "./schemas";

/** Everything the settings page edits. Admin only. */
export interface SettingsDTO {
  org: string;
  /** Custom logo (data URL) or null when the built-in one is used. */
  logo: string | null;
  /** Resolved colours: the defaults with the stored overrides applied. */
  theme: ThemeColors;
  publicNameSearch: boolean;
  blockMessages: { student: string; teacher: string };
}

export async function getSettingsForAdmin(auth: AuthContext): Promise<SettingsDTO> {
  assertRole(auth, "ADMIN");
  const s = await getSettings();
  return {
    org: s.org,
    logo: s.logo || null,
    theme: { ...DEFAULT_THEME, ...s.theme },
    publicNameSearch: s.publicNameSearch,
    blockMessages: s.blockMessages,
  };
}

export async function updateOrg(auth: AuthContext, input: z.output<typeof orgSchema>): Promise<void> {
  assertRole(auth, "ADMIN");
  await setSetting("org", input.org);
}

/** `null` goes back to the built-in logo. */
export async function updateLogo(auth: AuthContext, logo: string | null): Promise<void> {
  assertRole(auth, "ADMIN");
  await setSetting("logo", logo);
}

export async function updateTheme(auth: AuthContext, input: z.output<typeof themeSchema>): Promise<void> {
  assertRole(auth, "ADMIN");
  await setSetting("theme", themeOverrides(input));
}

/** «استعادة المظهر الافتراضي»: default colours and the default logo. */
export async function resetAppearance(auth: AuthContext): Promise<void> {
  assertRole(auth, "ADMIN");
  await setSetting("theme", {});
  await setSetting("logo", null);
}

export async function updatePublicNameSearch(auth: AuthContext, enabled: boolean): Promise<void> {
  assertRole(auth, "ADMIN");
  await setSetting("publicNameSearch", enabled);
}

/** A message left empty falls back to the built-in wording, so a blocked user never sees a blank page. */
export async function updateBlockMessages(auth: AuthContext, input: z.output<typeof blockMessagesSchema>): Promise<void> {
  assertRole(auth, "ADMIN");
  await setSetting("blockMessages", {
    student: input.student || DEFAULT_SETTINGS.blockMessages.student,
    teacher: input.teacher || DEFAULT_SETTINGS.blockMessages.teacher,
  });
}
