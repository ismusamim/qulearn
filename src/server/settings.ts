import "server-only";

import { cache } from "react";

import { DEFAULT_ORG_NAME } from "@/lib/constants";
import { DEFAULT_THEME, type ThemeColors } from "@/lib/theme";
import { db } from "@/server/db";

/**
 * Typed access to the key/value `settings` table. Every key and its value
 * type is declared here; nothing else reads or writes that table directly.
 */
export interface AppSettings {
  /** Organisation name shown on the login page and header. */
  org: string;
  /** Custom logo as a data URL; null uses /logo.png. */
  logo: string | null;
  /** Colour overrides on top of DEFAULT_THEME. */
  theme: Partial<ThemeColors>;
  /** Whether the login page suggests names as the user types. */
  publicNameSearch: boolean;
  /** Notices shown to blocked accounts. */
  blockMessages: { student: string; teacher: string };
}

export const DEFAULT_SETTINGS: AppSettings = {
  org: DEFAULT_ORG_NAME,
  logo: null,
  theme: {},
  publicNameSearch: true,
  blockMessages: {
    student: "عذرًا، حسابك موقوف حاليًا لانقطاعك عن الحلقة.\nللعودة يُرجى التواصل مع إدارة التحفيظ.",
    teacher: "عذرًا، حسابك موقوف حاليًا.\nيُرجى التواصل مع إدارة التحفيظ.",
  },
};

export type SettingKey = keyof AppSettings;

/** All settings merged over their defaults. Memoised per request. */
export const getSettings = cache(async (): Promise<AppSettings> => {
  const rows = await db.setting.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<AppSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    theme: { ...(stored.theme ?? {}) },
    blockMessages: { ...DEFAULT_SETTINGS.blockMessages, ...(stored.blockMessages ?? {}) },
  };
});

/** What the UI shell needs: name, logo and resolved colours. Safe to show before login. */
export async function getBranding(): Promise<{ org: string; logo: string; theme: ThemeColors }> {
  const s = await getSettings();
  return { org: s.org, logo: s.logo || "/logo.png", theme: { ...DEFAULT_THEME, ...s.theme } };
}

/** Low-level write. Callers (the settings service) are responsible for authorisation. */
export async function setSetting<K extends SettingKey>(key: K, value: AppSettings[K]): Promise<void> {
  const json = value as unknown as object;
  await db.setting.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
}
