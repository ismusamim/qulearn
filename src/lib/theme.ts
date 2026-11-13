/**
 * Brand colours the administration can change from Settings. They are mapped
 * onto the shadcn CSS variables by `themeCssVariables`.
 */
export interface ThemeColors {
  /** Primary: sidebar, buttons, headings. */
  primary: string;
  /** Accent: borders, active tab, highlights. */
  accent: string;
  /** Page background. */
  background: string;
  /** Body text. */
  text: string;
  /** «حاضر» and other success states. */
  success: string;
  /** «متأخر / معتذر» and other warnings. */
  warning: string;
  /** «غائب», delete buttons and errors. */
  danger: string;
}

export const DEFAULT_THEME: ThemeColors = {
  primary: "#13294b",
  accent: "#b8904f",
  background: "#f8f5ee",
  text: "#1a2333",
  success: "#4e7d45",
  warning: "#b7791f",
  danger: "#b3372f",
};

export const THEME_FIELDS: ReadonlyArray<{ key: keyof ThemeColors; label: string; hint: string }> = [
  { key: "primary", label: "اللون الأساسي", hint: "الشريط الجانبي والأزرار والعناوين" },
  { key: "accent", label: "لون التمييز", hint: "الإطارات والتبويب النشط والتنبيهات" },
  { key: "background", label: "لون الخلفية", hint: "خلفية الصفحات" },
  { key: "text", label: "لون النص", hint: "الكتابة في كل الصفحات" },
  { key: "success", label: "لون «حاضر»", hint: "زر الحضور عند اختياره" },
  { key: "warning", label: "لون «متأخر / معتذر»", hint: "أزرار التأخر والاعتذار" },
  { key: "danger", label: "لون «غائب» والحذف", hint: "زر الغياب وأزرار الحذف" },
];

export const THEME_PRESETS: ReadonlyArray<{ name: string; colors: Partial<ThemeColors> }> = [
  { name: "ألوان الشعار", colors: DEFAULT_THEME },
  { name: "أخضر كلاسيكي", colors: { primary: "#0f6b4f", accent: "#b8892b", success: "#2f8a4f", background: "#f6f7f5", text: "#1d2b25" } },
  { name: "عنابي", colors: { primary: "#6b1d2f", accent: "#c09a5b", background: "#faf6f2", text: "#2a1a1d" } },
  { name: "أزرق وفيروزي", colors: { primary: "#1f4e79", accent: "#2a9d8f", success: "#3a8d4f", background: "#f4f8fb", text: "#16263a" } },
  { name: "رمادي هادئ", colors: { primary: "#2f3a45", accent: "#8a7a5c", background: "#f5f5f3", text: "#1f2328" } },
];

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(rgb: number[]): string {
  return "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

/** Blend `a` towards `b` by `t` (0–1). */
export function mixColors(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex(x.map((v, i) => v + (y[i] - v) * t));
}

/** Relative luminance (WCAG), 0 = black, 1 = white. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Readable text colour on top of `hex`. */
export function onColor(hex: string): string {
  return luminance(hex) > 0.45 ? "#14181f" : "#ffffff";
}

/** shadcn CSS variables derived from the brand colours. */
export function themeCssVariables(t: ThemeColors): Record<string, string> {
  const border = mixColors(t.accent, "#ffffff", 0.72);
  const soft = mixColors(t.accent, "#ffffff", 0.86);
  const onPrimary = onColor(t.primary);
  return {
    "--background": t.background,
    "--foreground": t.text,
    "--card": "#ffffff",
    "--card-foreground": t.text,
    "--popover": "#ffffff",
    "--popover-foreground": t.text,
    "--primary": t.primary,
    "--primary-foreground": onPrimary,
    "--secondary": mixColors(t.primary, "#ffffff", 0.9),
    "--secondary-foreground": t.primary,
    "--muted": mixColors(t.background, t.text, 0.05),
    "--muted-foreground": mixColors(t.text, "#ffffff", 0.38),
    "--accent": soft,
    "--accent-foreground": t.text,
    "--destructive": t.danger,
    "--border": border,
    "--input": mixColors(t.primary, "#ffffff", 0.78),
    "--ring": t.accent,
    "--success": t.success,
    "--warning": t.warning,
    "--gold": t.accent,
    "--sidebar": t.primary,
    "--sidebar-foreground": onPrimary,
    "--sidebar-primary": t.accent,
    "--sidebar-primary-foreground": onColor(t.accent),
    "--sidebar-accent": mixColors(t.primary, onPrimary, 0.14),
    "--sidebar-accent-foreground": onPrimary,
    "--sidebar-border": mixColors(t.primary, onPrimary, 0.18),
    "--sidebar-ring": t.accent,
  };
}
