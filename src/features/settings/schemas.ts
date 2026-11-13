import { z } from "zod";

import { isHexColor } from "@/lib/theme";

export const orgSchema = z.object({
  org: z.string().trim().min(1, "اكتب اسم المؤسسة").max(120, "الاسم طويل جدًا"),
});
export type OrgInput = z.input<typeof orgSchema>;

/** The built-in logo, used when none was uploaded. */
export const DEFAULT_LOGO_SRC = "/logo.png";

/** The logo is stored inline and sent with every page, so it must stay small. */
export const LOGO_MAX_BYTES = 200 * 1024;
/** Longest side, in pixels, the browser resizes an uploaded logo to. */
export const LOGO_MAX_SIDE = 256;

const LOGO_DATA_URL = /^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Decoded size of a base64 data URL. */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export const logoSchema = z.object({
  logo: z
    .string()
    // Cheap length guard first so the regex never runs on a huge payload.
    .max(Math.ceil((LOGO_MAX_BYTES * 4) / 3) + 64, "حجم الشعار كبير (الحد 200 ك.ب)")
    .regex(LOGO_DATA_URL, "صيغة الشعار غير صالحة")
    .refine((value) => dataUrlBytes(value) <= LOGO_MAX_BYTES, "حجم الشعار كبير (الحد 200 ك.ب)"),
});

const color = z.string().refine(isHexColor, "لون غير صالح");

/** A complete set of brand colours (#rrggbb). They end up inside a <style> tag, hence the strict format. */
export const themeSchema = z.object({
  primary: color,
  accent: color,
  background: color,
  text: color,
  success: color,
  warning: color,
  danger: color,
});

export const publicNameSearchSchema = z.object({ enabled: z.boolean() });

const message = z.string().trim().max(1000, "الرسالة طويلة جدًا (الحد 1000 حرف)");

export const blockMessagesSchema = z.object({ student: message, teacher: message });
export type BlockMessagesInput = z.input<typeof blockMessagesSchema>;
